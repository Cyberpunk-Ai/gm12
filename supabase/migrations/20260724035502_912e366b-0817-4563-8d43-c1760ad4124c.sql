
-- POSTS
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  caption TEXT,
  location TEXT,
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  reposts_count INT NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_posts_user ON public.posts(user_id, created_at DESC);
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT ON public.posts TO anon;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Posts viewable by everyone" ON public.posts FOR SELECT USING (NOT is_archived OR auth.uid() = user_id);
CREATE POLICY "Users insert own posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own posts" ON public.posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- POST MEDIA
CREATE TABLE public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  media_path TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  position INT NOT NULL DEFAULT 0,
  width INT,
  height INT,
  duration NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_media_post ON public.post_media(post_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_media TO authenticated;
GRANT SELECT ON public.post_media TO anon;
GRANT ALL ON public.post_media TO service_role;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Media viewable by everyone" ON public.post_media FOR SELECT USING (true);
CREATE POLICY "Users manage own post media" ON public.post_media FOR ALL
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.user_id = auth.uid()));

-- POST LIKES
CREATE TABLE public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_likes TO authenticated;
GRANT SELECT ON public.post_likes TO anon;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes viewable by everyone" ON public.post_likes FOR SELECT USING (true);
CREATE POLICY "Users like as self" ON public.post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike as self" ON public.post_likes FOR DELETE USING (auth.uid() = user_id);

-- POST COMMENTS (with replies)
CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_post_comments_post ON public.post_comments(post_id, created_at);
CREATE INDEX idx_post_comments_parent ON public.post_comments(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT SELECT ON public.post_comments TO anon;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by everyone" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Users comment as self" ON public.post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users edit own comment" ON public.post_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own comment" ON public.post_comments FOR DELETE USING (auth.uid() = user_id);

-- COMMENT LIKES
CREATE TABLE public.comment_likes (
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_likes TO authenticated;
GRANT SELECT ON public.comment_likes TO anon;
GRANT ALL ON public.comment_likes TO service_role;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comment likes viewable" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Users like comments as self" ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike comments as self" ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- SAVED POSTS
CREATE TABLE public.saved_posts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_posts TO authenticated;
GRANT ALL ON public.saved_posts TO service_role;
ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own saved" ON public.saved_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users save as self" ON public.saved_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unsave as self" ON public.saved_posts FOR DELETE USING (auth.uid() = user_id);

-- REPOSTS
CREATE TABLE public.post_reposts (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reposts TO authenticated;
GRANT SELECT ON public.post_reposts TO anon;
GRANT ALL ON public.post_reposts TO service_role;
ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reposts viewable" ON public.post_reposts FOR SELECT USING (true);
CREATE POLICY "Users repost as self" ON public.post_reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unrepost as self" ON public.post_reposts FOR DELETE USING (auth.uid() = user_id);

-- HIGHLIGHTS
CREATE TABLE public.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cover_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.highlights TO authenticated;
GRANT SELECT ON public.highlights TO anon;
GRANT ALL ON public.highlights TO service_role;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Highlights viewable" ON public.highlights FOR SELECT USING (true);
CREATE POLICY "Users manage own highlights" ON public.highlights FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.highlight_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  highlight_id UUID NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  status_id UUID REFERENCES public.user_statuses(id) ON DELETE CASCADE,
  media_path TEXT,
  media_type TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.highlight_items TO authenticated;
GRANT SELECT ON public.highlight_items TO anon;
GRANT ALL ON public.highlight_items TO service_role;
ALTER TABLE public.highlight_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Highlight items viewable" ON public.highlight_items FOR SELECT USING (true);
CREATE POLICY "Users manage own highlight items" ON public.highlight_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.highlights h WHERE h.id = highlight_id AND h.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.highlights h WHERE h.id = highlight_id AND h.user_id = auth.uid()));

-- TRIGGERS FOR COUNTS
CREATE OR REPLACE FUNCTION public.update_post_likes_count() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.posts SET likes_count = likes_count+1 WHERE id = NEW.post_id; RETURN NEW;
  ELSIF TG_OP='DELETE' THEN UPDATE public.posts SET likes_count = GREATEST(likes_count-1,0) WHERE id = OLD.post_id; RETURN OLD;
  END IF; RETURN NULL;
END; $$;
CREATE TRIGGER trg_post_likes_count AFTER INSERT OR DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();

CREATE OR REPLACE FUNCTION public.update_post_comments_count() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.posts SET comments_count = comments_count+1 WHERE id = NEW.post_id; RETURN NEW;
  ELSIF TG_OP='DELETE' THEN UPDATE public.posts SET comments_count = GREATEST(comments_count-1,0) WHERE id = OLD.post_id; RETURN OLD;
  END IF; RETURN NULL;
END; $$;
CREATE TRIGGER trg_post_comments_count AFTER INSERT OR DELETE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.update_post_comments_count();

CREATE OR REPLACE FUNCTION public.update_comment_likes_count() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.post_comments SET likes_count = likes_count+1 WHERE id = NEW.comment_id; RETURN NEW;
  ELSIF TG_OP='DELETE' THEN UPDATE public.post_comments SET likes_count = GREATEST(likes_count-1,0) WHERE id = OLD.comment_id; RETURN OLD;
  END IF; RETURN NULL;
END; $$;
CREATE TRIGGER trg_comment_likes_count AFTER INSERT OR DELETE ON public.comment_likes FOR EACH ROW EXECUTE FUNCTION public.update_comment_likes_count();

CREATE OR REPLACE FUNCTION public.update_post_reposts_count() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.posts SET reposts_count = reposts_count+1 WHERE id = NEW.post_id; RETURN NEW;
  ELSIF TG_OP='DELETE' THEN UPDATE public.posts SET reposts_count = GREATEST(reposts_count-1,0) WHERE id = OLD.post_id; RETURN OLD;
  END IF; RETURN NULL;
END; $$;
CREATE TRIGGER trg_post_reposts_count AFTER INSERT OR DELETE ON public.post_reposts FOR EACH ROW EXECUTE FUNCTION public.update_post_reposts_count();

CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- STORAGE POLICIES
CREATE POLICY "Authenticated read social buckets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('posts','avatars','status-media','highlights'));
CREATE POLICY "Public read social buckets anon" ON storage.objects FOR SELECT TO anon
  USING (bucket_id IN ('posts','avatars','status-media','highlights'));
CREATE POLICY "Users upload own files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('posts','avatars','status-media','highlights') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('posts','avatars','status-media','highlights') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('posts','avatars','status-media','highlights') AND (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
