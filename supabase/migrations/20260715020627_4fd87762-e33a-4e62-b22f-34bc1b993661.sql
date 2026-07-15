DROP POLICY IF EXISTS "Anyone can view active links" ON public.links;
DROP POLICY IF EXISTS "Users can view their own links" ON public.links;

CREATE POLICY "Users can view their own links"
  ON public.links
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE SELECT ON public.links FROM anon;