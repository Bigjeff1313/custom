ALTER TABLE public.fund_transactions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'fund_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fund_transactions;
  END IF;
END $$;