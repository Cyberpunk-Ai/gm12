-- Guarded enum creation
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','moderator','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tournament_status AS ENUM ('upcoming','registration_open','registration_closed','live','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tournament_format AS ENUM ('single_elimination','double_elimination','round_robin','swiss'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.game_type AS ENUM ('fifa','cod','pubg','fortnite','apex','valorant','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.registration_status AS ENUM ('pending','confirmed','cancelled','checked_in'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_status AS ENUM ('pending','verified','rejected','refunded'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.match_status AS ENUM ('scheduled','live','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','resolved','closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_priority AS ENUM ('low','medium','high','urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.listing_status AS ENUM ('active','sold','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.listing_category AS ENUM ('account','items','coaching','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.notification_type AS ENUM ('tournament','payment','match','system','whatsapp'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.reward_type AS ENUM ('prize','bonus','referral','achievement'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.platform_type AS ENUM ('playstation','xbox','pc','mobile'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  username TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  game_handle TEXT,
  wallet_balance DECIMAL(10,2) DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  bio TEXT,
  referral_code TEXT UNIQUE,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  game public.game_type NOT NULL,
  format public.tournament_format NOT NULL DEFAULT 'single_elimination',
  status public.tournament_status NOT NULL DEFAULT 'upcoming',
  entry_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  prize_pool DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_participants INTEGER NOT NULL DEFAULT 16,
  current_participants INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  registration_deadline TIMESTAMPTZ NOT NULL,
  rules TEXT,
  image_url TEXT,
  group_link TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status public.registration_status NOT NULL DEFAULT 'pending',
  payment_id UUID,
  game_handle TEXT NOT NULL,
  seed_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (tournament_id, user_id)
);

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  method TEXT DEFAULT 'mpesa',
  status public.payment_status NOT NULL DEFAULT 'pending',
  transaction_code TEXT,
  screenshot_url TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player1_id UUID REFERENCES auth.users(id),
  player2_id UUID REFERENCES auth.users(id),
  player1_score INTEGER,
  player2_score INTEGER,
  winner_id UUID REFERENCES auth.users(id),
  status public.match_status NOT NULL DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.game_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  room_code TEXT NOT NULL,
  password TEXT,
  platform public.platform_type NOT NULL DEFAULT 'mobile',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE public.rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  type public.reward_type NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category public.listing_category NOT NULL DEFAULT 'other',
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  status public.listing_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phone TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.leaderboard_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  earnings DECIMAL(10,2) DEFAULT 0,
  tournaments_played INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'trophy',
  points INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  bonus_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

CREATE TABLE public.activity_feed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant1_id UUID NOT NULL,
  participant2_id UUID NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(participant1_id, participant2_id)
);

CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_encrypted BOOLEAN DEFAULT true,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT DEFAULT 'text',
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.status_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id UUID NOT NULL REFERENCES public.user_statuses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(status_id, user_id)
);

CREATE TABLE public.status_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id UUID NOT NULL REFERENCES public.user_statuses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_encrypted BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.leaderboard_stats (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_registrations_updated_at BEFORE UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketplace_listings_updated_at BEFORE UPDATE ON public.marketplace_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leaderboard_stats_updated_at BEFORE UPDATE ON public.leaderboard_stats FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Policies (profiles)
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Tournaments are viewable by everyone" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Admins can manage tournaments" ON public.tournaments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own registrations" ON public.registrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own registrations" ON public.registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own registrations" ON public.registrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all registrations" ON public.registrations FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage registrations" ON public.registrations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all payments" ON public.payments FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage payments" ON public.payments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Matches are viewable by everyone" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Admins can manage matches" ON public.matches FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view game rooms" ON public.game_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage game rooms" ON public.game_rooms FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own rewards" ON public.rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own rewards" ON public.rewards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage rewards" ON public.rewards FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tickets" ON public.support_tickets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all tickets" ON public.support_tickets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view messages on own tickets" ON public.ticket_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid())
);
CREATE POLICY "Users can create messages on own tickets" ON public.ticket_messages FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid())
);
CREATE POLICY "Admins can manage all messages" ON public.ticket_messages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Listings are viewable by everyone" ON public.marketplace_listings FOR SELECT USING (true);
CREATE POLICY "Users can create own listings" ON public.marketplace_listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Users can update own listings" ON public.marketplace_listings FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Users can delete own listings" ON public.marketplace_listings FOR DELETE USING (auth.uid() = seller_id);

CREATE POLICY "Admins can manage whatsapp messages" ON public.whatsapp_messages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Leaderboard is viewable by everyone" ON public.leaderboard_stats FOR SELECT USING (true);
CREATE POLICY "Users can update own stats" ON public.leaderboard_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage stats" ON public.leaderboard_stats FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Achievements are viewable by everyone" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "Admins can manage achievements" ON public.achievements FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "User achievements are viewable by everyone" ON public.user_achievements FOR SELECT USING (true);
CREATE POLICY "System can grant achievements" ON public.user_achievements FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage user achievements" ON public.user_achievements FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE POLICY "System can create referrals" ON public.referrals FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage referrals" ON public.referrals FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Public activities are viewable by everyone" ON public.activity_feed FOR SELECT USING (is_public = true);
CREATE POLICY "Users can view own activities" ON public.activity_feed FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create activities" ON public.activity_feed FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage activities" ON public.activity_feed FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);
CREATE POLICY "Admins can manage conversations" ON public.conversations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view messages in own conversations" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND (participant1_id = auth.uid() OR participant2_id = auth.uid()))
);
CREATE POLICY "Users can send messages in own conversations" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND (participant1_id = auth.uid() OR participant2_id = auth.uid()))
);
CREATE POLICY "Users can update own messages" ON public.messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.conversations WHERE id = conversation_id AND (participant1_id = auth.uid() OR participant2_id = auth.uid()))
);
CREATE POLICY "Admins can manage messages" ON public.messages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Statuses are viewable by everyone" ON public.user_statuses FOR SELECT USING (true);
CREATE POLICY "Users can create own statuses" ON public.user_statuses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own statuses" ON public.user_statuses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own statuses" ON public.user_statuses FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage statuses" ON public.user_statuses FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Likes are viewable by everyone" ON public.status_likes FOR SELECT USING (true);
CREATE POLICY "Users can like statuses" ON public.status_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike statuses" ON public.status_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Comments are viewable by everyone" ON public.status_comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.status_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.status_comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Follows are viewable by everyone" ON public.user_follows FOR SELECT USING (true);
CREATE POLICY "Users can follow others" ON public.user_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON public.user_follows FOR DELETE USING (auth.uid() = follower_id);

-- Helper triggers/functions
CREATE OR REPLACE FUNCTION public.update_tournament_participant_count()
RETURNS TRIGGER AS $$ BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    UPDATE public.tournaments SET current_participants = COALESCE(current_participants, 0) + 1 WHERE id = NEW.tournament_id;
  END IF;
  IF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
    UPDATE public.tournaments SET current_participants = GREATEST(COALESCE(current_participants, 0) - 1, 0) WHERE id = NEW.tournament_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER on_registration_status_change AFTER INSERT OR UPDATE OF status ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.update_tournament_participant_count();

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$ BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NEW.user_id::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER generate_referral_code_trigger BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

CREATE OR REPLACE FUNCTION public.update_stats_on_match_complete()
RETURNS TRIGGER AS $$
DECLARE loser_id UUID; points_for_win INTEGER := 10; points_for_loss INTEGER := 2;
BEGIN
  IF NEW.status = 'completed' AND NEW.winner_id IS NOT NULL AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    loser_id := CASE WHEN NEW.winner_id = NEW.player1_id THEN NEW.player2_id ELSE NEW.player1_id END;
    UPDATE public.leaderboard_stats SET wins = COALESCE(wins,0)+1, points = COALESCE(points,0)+points_for_win, updated_at = now() WHERE user_id = NEW.winner_id;
    IF loser_id IS NOT NULL THEN
      UPDATE public.leaderboard_stats SET losses = COALESCE(losses,0)+1, points = COALESCE(points,0)+points_for_loss, updated_at = now() WHERE user_id = loser_id;
    END IF;
    INSERT INTO public.activity_feed (activity_type, title, description, user_id, is_public, metadata)
    VALUES ('match_completed','Match Completed','A match has been completed', NEW.winner_id, true, jsonb_build_object('match_id', NEW.id, 'tournament_id', NEW.tournament_id, 'winner_id', NEW.winner_id));
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER trigger_update_stats_on_match_complete AFTER UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_stats_on_match_complete();

CREATE OR REPLACE FUNCTION public.update_tournaments_played_on_registration()
RETURNS TRIGGER AS $$ BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    UPDATE public.leaderboard_stats SET tournaments_played = COALESCE(tournaments_played,0)+1, updated_at = now() WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER trigger_update_tournaments_played AFTER UPDATE ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.update_tournaments_played_on_registration();

CREATE OR REPLACE FUNCTION public.create_tournament_rewards()
RETURNS TRIGGER AS $$
DECLARE first_place_user UUID; prize_1st NUMERIC;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    prize_1st := NEW.prize_pool * 0.50;
    SELECT winner_id INTO first_place_user FROM public.matches
      WHERE tournament_id = NEW.id AND status = 'completed' AND winner_id IS NOT NULL
      ORDER BY round DESC, match_number ASC LIMIT 1;
    IF first_place_user IS NOT NULL THEN
      INSERT INTO public.rewards (user_id, tournament_id, type, amount, description, status)
      VALUES (first_place_user, NEW.id, 'prize', prize_1st, '1st Place - ' || NEW.title, 'pending');
      UPDATE public.leaderboard_stats SET earnings = COALESCE(earnings,0) + prize_1st, updated_at = now() WHERE user_id = first_place_user;
      INSERT INTO public.activity_feed (activity_type, title, description, user_id, is_public, metadata)
      VALUES ('tournament_win','Tournament Champion!','Won 1st place in ' || NEW.title, first_place_user, true, jsonb_build_object('tournament_id', NEW.id, 'prize', prize_1st));
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER trigger_create_tournament_rewards AFTER UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.create_tournament_rewards();

CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER AS $$ BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles SET followers_count = COALESCE(followers_count,0)+1 WHERE user_id = NEW.following_id;
    UPDATE public.profiles SET following_count = COALESCE(following_count,0)+1 WHERE user_id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET followers_count = GREATEST(COALESCE(followers_count,0)-1,0) WHERE user_id = OLD.following_id;
    UPDATE public.profiles SET following_count = GREATEST(COALESCE(following_count,0)-1,0) WHERE user_id = OLD.follower_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
CREATE TRIGGER update_follow_counts_trigger AFTER INSERT OR DELETE ON public.user_follows FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();

-- Seed achievements
INSERT INTO public.achievements (name, description, icon, points, category, requirement_type, requirement_value) VALUES
('First Win', 'Win your first tournament match', 'trophy', 100, 'competition', 'wins', 1),
('Champion', 'Win 10 tournament matches', 'medal', 500, 'competition', 'wins', 10),
('Legend', 'Win 50 tournament matches', 'crown', 2000, 'competition', 'wins', 50),
('Competitor', 'Participate in 5 tournaments', 'gamepad-2', 200, 'participation', 'tournaments', 5),
('Veteran', 'Participate in 25 tournaments', 'shield', 1000, 'participation', 'tournaments', 25),
('Newcomer', 'Complete your profile', 'user', 50, 'profile', 'profile_complete', 1),
('Influencer', 'Refer 5 friends', 'users', 500, 'social', 'referrals', 5),
('Ambassador', 'Refer 20 friends', 'star', 2000, 'social', 'referrals', 20),
('High Roller', 'Earn KES 10,000 in prizes', 'dollar-sign', 1000, 'earnings', 'earnings', 10000),
('Millionaire', 'Earn KES 100,000 in prizes', 'gem', 5000, 'earnings', 'earnings', 100000);

-- Realtime (idempotent)
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['tournaments','matches','notifications','leaderboard_stats','activity_feed','messages','user_statuses','rewards','status_comments','user_follows']) LOOP
    BEGIN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN others THEN NULL; END;
  END LOOP;
END $$;

-- Grants for every public table
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
  END LOOP;
END $$;