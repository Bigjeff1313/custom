ALTER TABLE public.fund_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.user_funds REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='fund_transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fund_transactions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='user_funds') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_funds;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='payments') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
END $$;