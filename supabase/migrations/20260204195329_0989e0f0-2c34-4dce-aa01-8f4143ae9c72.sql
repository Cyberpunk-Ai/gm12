-- Add comments table for social statuses
CREATE TABLE public.status_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    status_id UUID NOT NULL REFERENCES public.user_statuses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    is_encrypted BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.status_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
CREATE POLICY "Comments are viewable by everyone"
ON public.status_comments FOR SELECT
USING (true);

CREATE POLICY "Users can create comments"
ON public.status_comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON public.status_comments FOR DELETE
USING (auth.uid() = user_id);

-- Add comments_count to user_statuses
ALTER TABLE public.user_statuses ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.status_comments;