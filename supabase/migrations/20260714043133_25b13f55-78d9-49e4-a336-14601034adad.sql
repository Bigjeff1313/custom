
-- 1) crypto_wallets: restrict public read to authenticated
DROP POLICY IF EXISTS "Anyone can view active wallets" ON public.crypto_wallets;
CREATE POLICY "Authenticated can view active wallets"
  ON public.crypto_wallets FOR SELECT
  TO authenticated
  USING (is_active = true);
REVOKE SELECT ON public.crypto_wallets FROM anon;

-- 2) custom_domains: restrict public read to authenticated
DROP POLICY IF EXISTS "Anyone can view active verified domains" ON public.custom_domains;
CREATE POLICY "Authenticated can view active verified domains"
  ON public.custom_domains FOR SELECT
  TO authenticated
  USING (is_active = true AND is_verified = true);
REVOKE SELECT ON public.custom_domains FROM anon;

-- 3) link_clicks: remove client insert access; only service_role writes clicks
REVOKE INSERT ON public.link_clicks FROM anon, authenticated;

-- 4) debit_user_balance: revoke from public/anon; only authenticated may execute
REVOKE EXECUTE ON FUNCTION public.debit_user_balance(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debit_user_balance(numeric) TO authenticated;
