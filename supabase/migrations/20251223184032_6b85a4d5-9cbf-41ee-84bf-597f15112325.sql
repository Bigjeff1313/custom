-- Create custom_domains table
CREATE TABLE public.custom_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_domains
CREATE POLICY "Admins can do everything with domains"
ON public.custom_domains
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active verified domains"
ON public.custom_domains
FOR SELECT
USING (is_active = true AND is_verified = true);

-- Trigger for updating updated_at
CREATE TRIGGER update_custom_domains_updated_at
BEFORE UPDATE ON public.custom_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default domain
INSERT INTO public.custom_domains (domain, is_verified, is_active)
VALUES ('customslinks.com', true, true);