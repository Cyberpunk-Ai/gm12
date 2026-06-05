-- Add group_link column to tournaments for WhatsApp/Telegram groups
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS group_link TEXT;

-- Add image_url column to marketplace_listings if not exists
ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS image_url TEXT;