ALTER TABLE public.links 
ADD COLUMN IF NOT EXISTS captcha_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS analytics_enabled boolean NOT NULL DEFAULT true;