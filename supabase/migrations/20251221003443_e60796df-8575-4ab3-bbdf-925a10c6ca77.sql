-- Fix security issue: Remove overly permissive UPDATE policies on links and payments tables
-- These allow anyone to update any record, bypassing intended access controls

-- Drop the overly permissive "Anyone can update links" policy
DROP POLICY IF EXISTS "Anyone can update links" ON public.links;

-- Drop the overly permissive "Anyone can update payments" policy  
DROP POLICY IF EXISTS "Anyone can update payments" ON public.payments;

-- Add INSERT policy for user_roles (admin only)
CREATE POLICY "Admins can assign roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add UPDATE policy for user_roles (admin only)
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Add DELETE policy for user_roles (admin only)
CREATE POLICY "Admins can revoke roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));