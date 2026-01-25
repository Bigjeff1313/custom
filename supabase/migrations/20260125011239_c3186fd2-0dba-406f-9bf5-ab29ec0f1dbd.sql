-- Fix payments RLS policies to be PERMISSIVE (at least one must pass)
DROP POLICY IF EXISTS "Admins can update all payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;

CREATE POLICY "Admins can update all payments" 
ON public.payments 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete payments" 
ON public.payments 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix links RLS policies to be PERMISSIVE
DROP POLICY IF EXISTS "Admins can update all links" ON public.links;
DROP POLICY IF EXISTS "Admins can delete links" ON public.links;
DROP POLICY IF EXISTS "Admins can view all links" ON public.links;
DROP POLICY IF EXISTS "Users can update their own links" ON public.links;

CREATE POLICY "Admins can update all links" 
ON public.links 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete links" 
ON public.links 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all links" 
ON public.links 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update their own links" 
ON public.links 
FOR UPDATE 
USING (user_id = auth.uid());