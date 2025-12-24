-- Update the default domain in custom_domains
UPDATE public.custom_domains 
SET domain = 'customtextx.com', is_verified = true, is_active = true 
WHERE domain = 'customslinks.com';

-- Insert if it doesn't exist
INSERT INTO public.custom_domains (domain, is_verified, is_active)
SELECT 'customtextx.com', true, true
WHERE NOT EXISTS (SELECT 1 FROM public.custom_domains WHERE domain = 'customtextx.com');

-- Update default value for links table
ALTER TABLE public.links 
ALTER COLUMN custom_domain SET DEFAULT 'customtextx.com';