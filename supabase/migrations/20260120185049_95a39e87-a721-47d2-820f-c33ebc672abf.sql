-- Create achievements table for gamification
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'trophy',
  points INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'general',
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User achievements (earned badges)
CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Referral system
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  bonus_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referred_id)
);

-- Add referral code to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Generate referral codes for existing users
UPDATE public.profiles 
SET referral_code = UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))
WHERE referral_code IS NULL;

-- Activity feed
CREATE TABLE public.activity_feed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;

-- Achievements policies
CREATE POLICY "Achievements are viewable by everyone" ON public.achievements
FOR SELECT USING (true);

CREATE POLICY "Admins can manage achievements" ON public.achievements
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- User achievements policies
CREATE POLICY "User achievements are viewable by everyone" ON public.user_achievements
FOR SELECT USING (true);

CREATE POLICY "System can grant achievements" ON public.user_achievements
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage user achievements" ON public.user_achievements
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Referrals policies
CREATE POLICY "Users can view own referrals" ON public.referrals
FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "System can create referrals" ON public.referrals
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage referrals" ON public.referrals
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Activity feed policies
CREATE POLICY "Public activities are viewable by everyone" ON public.activity_feed
FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view own activities" ON public.activity_feed
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create activities" ON public.activity_feed
FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage activities" ON public.activity_feed
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Function to generate referral code on new user signup
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NEW.user_id::TEXT) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER generate_referral_code_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.generate_referral_code();

-- Insert default achievements
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

-- Enable realtime for activity feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_feed;