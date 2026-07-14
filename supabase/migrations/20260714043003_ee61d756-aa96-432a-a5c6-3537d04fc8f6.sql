
GRANT SELECT ON public.links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.links TO authenticated;
GRANT ALL ON public.links TO service_role;

GRANT SELECT, INSERT ON public.link_clicks TO anon;
GRANT SELECT, INSERT ON public.link_clicks TO authenticated;
GRANT ALL ON public.link_clicks TO service_role;

GRANT SELECT ON public.custom_domains TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_domains TO authenticated;
GRANT ALL ON public.custom_domains TO service_role;

GRANT SELECT ON public.crypto_wallets TO anon;
GRANT SELECT ON public.crypto_wallets TO authenticated;
GRANT ALL ON public.crypto_wallets TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fund_transactions TO authenticated;
GRANT ALL ON public.fund_transactions TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.user_funds TO authenticated;
GRANT ALL ON public.user_funds TO service_role;
