-- Create admin role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Policy for admins to view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Policy for users to view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Add INSERT policy for crypto_wallets (admin only)
CREATE POLICY "Admins can insert wallets"
ON public.crypto_wallets
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add UPDATE policy for crypto_wallets (admin only)
CREATE POLICY "Admins can update wallets"
ON public.crypto_wallets
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Add DELETE policy for crypto_wallets (admin only)
CREATE POLICY "Admins can delete wallets"
ON public.crypto_wallets
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all links
CREATE POLICY "Admins can view all links"
ON public.links
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any link
CREATE POLICY "Admins can update all links"
ON public.links
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete links
CREATE POLICY "Admins can delete links"
ON public.links
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any payment
CREATE POLICY "Admins can update all payments"
ON public.payments
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete payments
CREATE POLICY "Admins can delete payments"
ON public.payments
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));