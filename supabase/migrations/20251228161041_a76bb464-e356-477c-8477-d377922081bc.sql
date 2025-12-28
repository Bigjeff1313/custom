-- Add user_id column to custom_domains table
ALTER TABLE public.custom_domains ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update RLS policies for custom_domains
-- Drop existing policies first
DROP POLICY IF EXISTS "Admins can do everything with domains " ON public.custom_domains;
DROP POLICY IF EXISTS "Anyone can view active verified domains " ON public.custom_domains;

-- Create new policies
-- Admins can do everything
CREATE POLICY "Admins can manage all domains"
ON public.custom_domains
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own domains
CREATE POLICY "Users can view their own domains"
ON public.custom_domains
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own domains
CREATE POLICY "Users can insert their own domains"
ON public.custom_domains
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own domains
CREATE POLICY "Users can update their own domains"
ON public.custom_domains
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own domains
CREATE POLICY "Users can delete their own domains"
ON public.custom_domains
FOR DELETE
USING (user_id = auth.uid());