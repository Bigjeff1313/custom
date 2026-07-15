CREATE OR REPLACE FUNCTION public.create_link_checkout(
  _original_url text,
  _short_code text DEFAULT NULL,
  _custom_domain text DEFAULT 'customtextx.com',
  _plan_type text DEFAULT 'basic',
  _payment_method text DEFAULT 'crypto',
  _wallet_currency text DEFAULT NULL,
  _wallet_address text DEFAULT NULL,
  _transaction_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _price numeric;
  _code text;
  _link public.links%ROWTYPE;
  _payment public.payments%ROWTYPE;
  _new_balance numeric := NULL;
  _attempts integer := 0;
  _chars text := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  _i integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  _original_url := btrim(coalesce(_original_url, ''));
  _custom_domain := lower(btrim(coalesce(NULLIF(_custom_domain, ''), 'customtextx.com')));
  _plan_type := lower(btrim(coalesce(NULLIF(_plan_type, ''), 'basic')));
  _payment_method := lower(btrim(coalesce(NULLIF(_payment_method, ''), 'crypto')));

  IF _original_url = '' OR _original_url !~* '^https?://.+' THEN
    RAISE EXCEPTION 'Invalid URL';
  END IF;

  IF _plan_type NOT IN ('basic', 'pro') THEN
    RAISE EXCEPTION 'Invalid plan';
  END IF;

  _price := CASE WHEN _plan_type = 'pro' THEN 10 ELSE 5 END;

  IF _short_code IS NOT NULL AND btrim(_short_code) <> '' THEN
    _code := btrim(_short_code);
    IF _code !~ '^[A-Za-z0-9_-]{1,20}$' THEN
      RAISE EXCEPTION 'Invalid short code';
    END IF;
    IF EXISTS (SELECT 1 FROM public.links WHERE short_code = _code) THEN
      RAISE EXCEPTION 'This short code is already taken';
    END IF;
  ELSE
    LOOP
      _code := '';
      FOR _i IN 1..6 LOOP
        _code := _code || substr(_chars, floor(random() * length(_chars) + 1)::integer, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.links WHERE short_code = _code);
      _attempts := _attempts + 1;
      IF _attempts >= 20 THEN
        RAISE EXCEPTION 'Could not generate a unique short code';
      END IF;
    END LOOP;
  END IF;

  IF _payment_method = 'balance' THEN
    INSERT INTO public.user_funds (user_id, balance, total_deposited)
    VALUES (_uid, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_funds
    SET balance = balance - _price,
        updated_at = now()
    WHERE user_id = _uid
      AND balance >= _price
    RETURNING balance INTO _new_balance;

    IF _new_balance IS NULL THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;

    INSERT INTO public.links (original_url, short_code, custom_domain, plan_type, status, user_id)
    VALUES (_original_url, _code, _custom_domain, _plan_type, 'active', _uid)
    RETURNING * INTO _link;

    INSERT INTO public.payments (link_id, amount, currency, wallet_address, status, expires_at, transaction_hash)
    VALUES (_link.id, _price, 'BALANCE', 'user_balance', 'confirmed', now() + interval '15 minutes', 'balance_' || extract(epoch from clock_timestamp())::bigint::text)
    RETURNING * INTO _payment;
  ELSIF _payment_method = 'crypto' THEN
    IF coalesce(btrim(_wallet_currency), '') = '' OR coalesce(btrim(_wallet_address), '') = '' THEN
      RAISE EXCEPTION 'Payment wallet is required';
    END IF;

    INSERT INTO public.links (original_url, short_code, custom_domain, plan_type, status, user_id)
    VALUES (_original_url, _code, _custom_domain, _plan_type, 'pending_payment', _uid)
    RETURNING * INTO _link;

    INSERT INTO public.payments (link_id, amount, currency, wallet_address, status, expires_at, transaction_hash)
    VALUES (_link.id, _price, btrim(_wallet_currency), btrim(_wallet_address), 'pending', now() + interval '24 hours', NULLIF(btrim(coalesce(_transaction_hash, '')), ''))
    RETURNING * INTO _payment;
  ELSE
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  RETURN jsonb_build_object(
    'linkId', _link.id,
    'shortCode', _link.short_code,
    'shortUrl', _link.custom_domain || '/' || _link.short_code,
    'status', _link.status,
    'paymentId', _payment.id,
    'paymentStatus', _payment.status,
    'amount', _price,
    'newBalance', _new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_link_checkout(text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_link_checkout(text, text, text, text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_link_payment_hash(
  _payment_id uuid,
  _transaction_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _payment public.payments%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.* INTO _payment
  FROM public.payments p
  JOIN public.links l ON l.id = p.link_id
  WHERE p.id = _payment_id
    AND l.user_id = _uid;

  IF _payment.id IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF _payment.status <> 'pending' THEN
    RAISE EXCEPTION 'Payment already processed';
  END IF;

  UPDATE public.payments
  SET transaction_hash = NULLIF(btrim(coalesce(_transaction_hash, '')), ''),
      updated_at = now()
  WHERE id = _payment_id
  RETURNING * INTO _payment;

  RETURN jsonb_build_object(
    'paymentId', _payment.id,
    'status', _payment.status,
    'transactionHash', _payment.transaction_hash
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_link_payment_hash(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_link_payment_hash(uuid, text) TO authenticated;

ALTER TABLE public.payments REPLICA IDENTITY FULL;
ALTER TABLE public.user_funds REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_funds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_funds;
  END IF;
END $$;