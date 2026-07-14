
CREATE OR REPLACE FUNCTION public.debit_user_balance(_amount numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_balance numeric;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  INSERT INTO public.user_funds (user_id, balance, total_deposited)
  VALUES (_uid, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_funds
  SET balance = balance - _amount,
      updated_at = now()
  WHERE user_id = _uid
    AND balance >= _amount
  RETURNING balance INTO _new_balance;

  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  RETURN _new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.debit_user_balance(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debit_user_balance(numeric) TO authenticated;

-- Ensure user_funds has a unique constraint on user_id (needed for ON CONFLICT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_funds'::regclass
      AND contype IN ('u','p')
      AND conname = 'user_funds_user_id_key'
  ) THEN
    BEGIN
      ALTER TABLE public.user_funds ADD CONSTRAINT user_funds_user_id_key UNIQUE (user_id);
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
    END;
  END IF;
END $$;
