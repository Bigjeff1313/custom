REVOKE ALL ON FUNCTION public.debit_user_balance(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_user_balance(numeric) TO service_role;