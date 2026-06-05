-- Add bio column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- Create conversations table for direct messaging
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant1_id UUID NOT NULL,
  participant2_id UUID NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(participant1_id, participant2_id)
);

-- Create messages table with encryption support
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_encrypted BOOLEAN DEFAULT true,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user statuses/reels table
CREATE TABLE public.user_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT DEFAULT 'text',
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create status likes table
CREATE TABLE public.status_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id UUID NOT NULL REFERENCES public.user_statuses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(status_id, user_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_likes ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Users can view own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = participant1_id OR auth.uid() = participant2_id);

CREATE POLICY "Users can create conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = participant1_id OR auth.uid() = participant2_id);

CREATE POLICY "Admins can manage conversations" ON public.conversations
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Messages policies
CREATE POLICY "Users can view messages in own conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE id = conversation_id 
      AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in own conversations" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE id = conversation_id 
      AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
    )
  );

CREATE POLICY "Users can update own messages" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations 
      WHERE id = conversation_id 
      AND (participant1_id = auth.uid() OR participant2_id = auth.uid())
    )
  );

CREATE POLICY "Admins can manage messages" ON public.messages
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- User statuses policies
CREATE POLICY "Statuses are viewable by everyone" ON public.user_statuses
  FOR SELECT USING (true);

CREATE POLICY "Users can create own statuses" ON public.user_statuses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own statuses" ON public.user_statuses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own statuses" ON public.user_statuses
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage statuses" ON public.user_statuses
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Status likes policies
CREATE POLICY "Likes are viewable by everyone" ON public.status_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can like statuses" ON public.status_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike statuses" ON public.status_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for messages and statuses
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_statuses;

-- Create storage bucket for status media
INSERT INTO storage.buckets (id, name, public) VALUES ('status-media', 'status-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for status media
CREATE POLICY "Status media is publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'status-media');

CREATE POLICY "Users can upload status media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'status-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own status media" ON storage.objects
  FOR DELETE USING (bucket_id = 'status-media' AND auth.uid()::text = (storage.foldername(name))[1]);