
-- 1) Prevent self role assignment via client policy path
DROP POLICY IF EXISTS "Admins can assign roles" ON public.user_roles;
CREATE POLICY "Admins can assign roles to others"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  private.has_role(auth.uid(), 'admin'::app_role)
  AND user_id <> auth.uid()
);

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update others roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  AND user_id <> auth.uid()
);

DROP POLICY IF EXISTS "Admins can revoke roles" ON public.user_roles;
CREATE POLICY "Admins can revoke others roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  private.has_role(auth.uid(), 'admin'::app_role)
  AND user_id <> auth.uid()
);

-- 2) Public link resolution: allow anon read of active links, but only safe columns
REVOKE SELECT ON public.links FROM anon;
GRANT SELECT (id, short_code, original_url, status, custom_domain, captcha_enabled, analytics_enabled, plan_type)
  ON public.links TO anon;

DROP POLICY IF EXISTS "Public can resolve active links" ON public.links;
CREATE POLICY "Public can resolve active links"
ON public.links
FOR SELECT
TO anon
USING (status = 'active');
