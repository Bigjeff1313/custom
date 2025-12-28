-- Add user_id column to links table for user ownership
ALTER TABLE public.links 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create link_clicks table to track individual clicks with device/location info
CREATE TABLE public.link_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id UUID REFERENCES public.links(id) ON DELETE CASCADE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  region TEXT,
  clicked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on link_clicks
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

-- RLS policies for link_clicks
-- Users can view clicks for their own links
CREATE POLICY "Users can view clicks for their own links"
ON public.link_clicks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.links 
    WHERE links.id = link_clicks.link_id 
    AND links.user_id = auth.uid()
  )
);

-- Admins can view all clicks
CREATE POLICY "Admins can view all clicks"
ON public.link_clicks
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can insert clicks (for tracking purposes via edge function)
CREATE POLICY "Anyone can insert clicks"
ON public.link_clicks
FOR INSERT
WITH CHECK (true);

-- Update RLS policies for links table to support user ownership
-- Drop existing "Anyone can view their pending links" policy since it's too permissive
DROP POLICY IF EXISTS "Anyone can view their pending links" ON public.links;

-- Create new policy for users to view their own links
CREATE POLICY "Users can view their own links"
ON public.links
FOR SELECT
USING (user_id = auth.uid() OR status = 'active'::link_status);

-- Users can update their own links
CREATE POLICY "Users can update their own links"
ON public.links
FOR UPDATE
USING (user_id = auth.uid());

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_links_user_id ON public.links(user_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON public.link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON public.link_clicks(clicked_at);