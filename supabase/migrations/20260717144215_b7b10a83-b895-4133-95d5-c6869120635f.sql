
-- User analytics / data collection
CREATE TABLE IF NOT EXISTS public.user_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL DEFAULT 'pageview', -- pageview, click, custom
  path TEXT,
  referrer TEXT,
  page_title TEXT,
  device_type TEXT,       -- mobile / tablet / desktop
  device_vendor TEXT,     -- Apple, Samsung, etc
  device_model TEXT,
  os_name TEXT,
  os_version TEXT,
  browser_name TEXT,
  browser_version TEXT,
  screen_resolution TEXT,
  viewport TEXT,
  language TEXT,
  timezone TEXT,
  user_agent TEXT,
  ip_address TEXT,
  isp TEXT,
  country TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  connection_type TEXT,   -- 4g/wifi/etc
  duration_ms INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON public.user_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_created_at ON public.user_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_analytics_path ON public.user_analytics(path);
CREATE INDEX IF NOT EXISTS idx_user_analytics_session ON public.user_analytics(session_id);

GRANT SELECT, INSERT ON public.user_analytics TO anon, authenticated;
GRANT ALL ON public.user_analytics TO service_role;

ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can insert their own analytics events
CREATE POLICY "Anyone can insert analytics"
  ON public.user_analytics FOR INSERT
  WITH CHECK (true);

-- Users can view their own analytics
CREATE POLICY "Users view own analytics"
  ON public.user_analytics FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all analytics
CREATE POLICY "Admins view all analytics"
  ON public.user_analytics FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete analytics (cleanup)
CREATE POLICY "Admins delete analytics"
  ON public.user_analytics FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
