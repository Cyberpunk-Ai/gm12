-- Function to update leaderboard stats when a match is completed
CREATE OR REPLACE FUNCTION public.update_stats_on_match_complete()
RETURNS TRIGGER AS $$
DECLARE
  winner_stats_id UUID;
  loser_stats_id UUID;
  loser_id UUID;
  points_for_win INTEGER := 10;
  points_for_loss INTEGER := 2;
BEGIN
  -- Only process when status changes to 'completed' and winner is set
  IF NEW.status = 'completed' AND NEW.winner_id IS NOT NULL AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Determine loser
    IF NEW.winner_id = NEW.player1_id THEN
      loser_id := NEW.player2_id;
    ELSE
      loser_id := NEW.player1_id;
    END IF;
    
    -- Update winner stats
    UPDATE public.leaderboard_stats
    SET 
      wins = COALESCE(wins, 0) + 1,
      points = COALESCE(points, 0) + points_for_win,
      updated_at = now()
    WHERE user_id = NEW.winner_id;
    
    -- Update loser stats (if loser exists)
    IF loser_id IS NOT NULL THEN
      UPDATE public.leaderboard_stats
      SET 
        losses = COALESCE(losses, 0) + 1,
        points = COALESCE(points, 0) + points_for_loss,
        updated_at = now()
      WHERE user_id = loser_id;
    END IF;
    
    -- Log activity for match completion
    INSERT INTO public.activity_feed (activity_type, title, description, user_id, is_public, metadata)
    VALUES (
      'match_completed',
      'Match Completed',
      'A match has been completed',
      NEW.winner_id,
      true,
      jsonb_build_object('match_id', NEW.id, 'tournament_id', NEW.tournament_id, 'winner_id', NEW.winner_id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check and grant achievements
CREATE OR REPLACE FUNCTION public.check_and_grant_achievements()
RETURNS TRIGGER AS $$
DECLARE
  achievement RECORD;
  user_wins INTEGER;
  user_earnings NUMERIC;
  user_tournaments INTEGER;
  user_referrals INTEGER;
  profile_complete BOOLEAN;
BEGIN
  -- Get user stats
  SELECT wins, earnings, tournaments_played INTO user_wins, user_earnings, user_tournaments
  FROM public.leaderboard_stats WHERE user_id = NEW.user_id;
  
  -- Get referral count
  SELECT COUNT(*) INTO user_referrals
  FROM public.referrals WHERE referrer_id = NEW.user_id AND status = 'completed';
  
  -- Check profile completeness
  SELECT (username IS NOT NULL AND bio IS NOT NULL AND avatar_url IS NOT NULL) INTO profile_complete
  FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- Loop through all achievements and check if user qualifies
  FOR achievement IN SELECT * FROM public.achievements LOOP
    -- Skip if already earned
    IF EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = NEW.user_id AND achievement_id = achievement.id) THEN
      CONTINUE;
    END IF;
    
    -- Check based on requirement type
    IF achievement.requirement_type = 'wins' AND COALESCE(user_wins, 0) >= achievement.requirement_value THEN
      INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.user_id, achievement.id);
      
      -- Log achievement earned
      INSERT INTO public.activity_feed (activity_type, title, description, user_id, is_public, metadata)
      VALUES (
        'achievement_earned',
        'Achievement Unlocked: ' || achievement.name,
        achievement.description,
        NEW.user_id,
        true,
        jsonb_build_object('achievement_id', achievement.id, 'points', achievement.points)
      );
    ELSIF achievement.requirement_type = 'earnings' AND COALESCE(user_earnings, 0) >= achievement.requirement_value THEN
      INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.user_id, achievement.id);
      
      INSERT INTO public.activity_feed (activity_type, title, description, user_id, is_public, metadata)
      VALUES ('achievement_earned', 'Achievement Unlocked: ' || achievement.name, achievement.description, NEW.user_id, true, jsonb_build_object('achievement_id', achievement.id, 'points', achievement.points));
    ELSIF achievement.requirement_type = 'tournaments' AND COALESCE(user_tournaments, 0) >= achievement.requirement_value THEN
      INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.user_id, achievement.id);
      
      INSERT INTO public.activity_feed (activity_type, title, description, user_id, is_public, metadata)
      VALUES ('achievement_earned', 'Achievement Unlocked: ' || achievement.name, achievement.description, NEW.user_id, true, jsonb_build_object('achievement_id', achievement.id, 'points', achievement.points));
    ELSIF achievement.requirement_type = 'referrals' AND COALESCE(user_referrals, 0) >= achievement.requirement_value THEN
      INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.user_id, achievement.id);
      
      INSERT INTO public.activity_feed (activity_type, title, description, user_id, is_public, metadata)
      VALUES ('achievement_earned', 'Achievement Unlocked: ' || achievement.name, achievement.description, NEW.user_id, true, jsonb_build_object('achievement_id', achievement.id, 'points', achievement.points));
    ELSIF achievement.requirement_type = 'profile_complete' AND profile_complete = true THEN
      INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.user_id, achievement.id);
      
      INSERT INTO public.activity_feed (activity_type, title, description, user_id, is_public, metadata)
      VALUES ('achievement_earned', 'Achievement Unlocked: ' || achievement.name, achievement.description, NEW.user_id, true, jsonb_build_object('achievement_id', achievement.id, 'points', achievement.points));
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check achievements when profile is updated
CREATE OR REPLACE FUNCTION public.check_achievements_on_profile_update()
RETURNS TRIGGER AS $$
DECLARE
  achievement RECORD;
  profile_complete BOOLEAN;
BEGIN
  -- Check profile completeness
  profile_complete := (NEW.username IS NOT NULL AND NEW.bio IS NOT NULL AND NEW.avatar_url IS NOT NULL);
  
  IF profile_complete THEN
    FOR achievement IN SELECT * FROM public.achievements WHERE requirement_type = 'profile_complete' LOOP
      IF NOT EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = NEW.user_id AND achievement_id = achievement.id) THEN
        INSERT INTO public.user_achievements (user_id, achievement_id) VALUES (NEW.user_id, achievement.id);
        
        INSERT INTO public.activity_feed (activity_type, title, description, user_id, is_public, metadata)
        VALUES ('achievement_earned', 'Achievement Unlocked: ' || achievement.name, achievement.description, NEW.user_id, true, jsonb_build_object('achievement_id', achievement.id, 'points', achievement.points));
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to update tournaments_played when registration is confirmed
CREATE OR REPLACE FUNCTION public.update_tournaments_played_on_registration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    UPDATE public.leaderboard_stats
    SET 
      tournaments_played = COALESCE(tournaments_played, 0) + 1,
      updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to create pending rewards when tournament completes
CREATE OR REPLACE FUNCTION public.create_tournament_rewards()
RETURNS TRIGGER AS $$
DECLARE
  first_place_user UUID;
  second_place_user UUID;
  third_place_user UUID;
  prize_1st NUMERIC;
  prize_2nd NUMERIC;
  prize_3rd NUMERIC;
BEGIN
  -- Only process when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Calculate prizes (50% 1st, 30% 2nd, 20% 3rd)
    prize_1st := NEW.prize_pool * 0.50;
    prize_2nd := NEW.prize_pool * 0.30;
    prize_3rd := NEW.prize_pool * 0.20;
    
    -- Get top 3 from final rounds (simplified - gets winners from completed matches ordered by round desc)
    SELECT winner_id INTO first_place_user
    FROM public.matches
    WHERE tournament_id = NEW.id AND status = 'completed' AND winner_id IS NOT NULL
    ORDER BY round DESC, match_number ASC
    LIMIT 1;
    
    -- Create rewards if we have winners
    IF first_place_user IS NOT NULL THEN
      INSERT INTO public.rewards (user_id, tournament_id, type, amount, description, status)
      VALUES (first_place_user, NEW.id, 'prize', prize_1st, '1st Place - ' || NEW.title, 'pending');
      
      -- Update earnings
      UPDATE public.leaderboard_stats
      SET earnings = COALESCE(earnings, 0) + prize_1st, updated_at = now()
      WHERE user_id = first_place_user;
      
      -- Log tournament win
      INSERT INTO public.activity_feed (activity_type, title, description, user_id, is_public, metadata)
      VALUES ('tournament_win', 'Tournament Champion!', 'Won 1st place in ' || NEW.title, first_place_user, true, jsonb_build_object('tournament_id', NEW.id, 'prize', prize_1st));
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_stats_on_match_complete ON public.matches;
CREATE TRIGGER trigger_update_stats_on_match_complete
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stats_on_match_complete();

DROP TRIGGER IF EXISTS trigger_check_achievements_on_stats_update ON public.leaderboard_stats;
CREATE TRIGGER trigger_check_achievements_on_stats_update
  AFTER UPDATE ON public.leaderboard_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_grant_achievements();

DROP TRIGGER IF EXISTS trigger_check_achievements_on_profile_update ON public.profiles;
CREATE TRIGGER trigger_check_achievements_on_profile_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_achievements_on_profile_update();

DROP TRIGGER IF EXISTS trigger_update_tournaments_played ON public.registrations;
CREATE TRIGGER trigger_update_tournaments_played
  AFTER UPDATE ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tournaments_played_on_registration();

DROP TRIGGER IF EXISTS trigger_create_tournament_rewards ON public.tournaments;
CREATE TRIGGER trigger_create_tournament_rewards
  AFTER UPDATE ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_tournament_rewards();