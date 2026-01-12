-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Anyone can create links" ON public.links;

-- Create a new permissive INSERT policy (default is PERMISSIVE)
CREATE POLICY "Anyone can create links" 
ON public.links 
FOR INSERT 
TO public
WITH CHECK (true);