
DROP POLICY IF EXISTS "Anyone can view payments" ON public.payments;
DROP POLICY IF EXISTS "Anyone can create payments" ON public.payments;

CREATE POLICY "Admins can view all payments"
ON public.payments FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Link owners can view their payments"
ON public.payments FOR SELECT
USING (EXISTS (SELECT 1 FROM public.links WHERE links.id = payments.link_id AND links.user_id = auth.uid()));

CREATE POLICY "Link owners can create payments"
ON public.payments FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.links WHERE links.id = payments.link_id AND links.user_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can create links" ON public.links;
CREATE POLICY "Authenticated users can create their own links"
ON public.links FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can insert clicks" ON public.link_clicks;

ALTER TABLE public.custom_domains DROP CONSTRAINT IF EXISTS custom_domains_owner_or_public;
ALTER TABLE public.custom_domains
  ADD CONSTRAINT custom_domains_owner_or_public
  CHECK (user_id IS NOT NULL OR (is_verified = true AND is_active = true));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
