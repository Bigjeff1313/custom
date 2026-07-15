DROP FUNCTION IF EXISTS public.create_link_checkout(text, text, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.submit_link_payment_hash(uuid, text);

CREATE OR REPLACE FUNCTION public.create_link_checkout_admin(
  _user_id uuid,
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
  _price numeric;
  _code text;
  _link public.links%ROWTYPE;
  _payment public.payments%ROWTYPE;
  _new_balance numeric := NULL;
  _attempts integer := 0;
  _chars text := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  _i integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User is required';
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
    VALUES (_user_id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_funds
    SET balance = balance - _price,
        updated_at = now()
    WHERE user_id = _user_id
      AND balance >= _price
    RETURNING balance INTO _new_balance;

    IF _new_balance IS NULL THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;

    INSERT INTO public.links (original_url, short_code, custom_domain, plan_type, status, user_id)
    VALUES (_original_url, _code, _custom_domain, _plan_type, 'active', _user_id)
    RETURNING * INTO _link;

    INSERT INTO public.payments (link_id, amount, currency, wallet_address, status, expires_at, transaction_hash)
    VALUES (_link.id, _price, 'BALANCE', 'user_balance', 'confirmed', now() + interval '15 minutes', 'balance_' || extract(epoch from clock_timestamp())::bigint::text)
    RETURNING * INTO _payment;
  ELSIF _payment_method = 'crypto' THEN
    IF coalesce(btrim(_wallet_currency), '') = '' OR coalesce(btrim(_wallet_address), '') = '' THEN
      RAISE EXCEPTION 'Payment wallet is required';
    END IF;

    INSERT INTO public.links (original_url, short_code, custom_domain, plan_type, status, user_id)
    VALUES (_original_url, _code, _custom_domain, _plan_type, 'pending_payment', _user_id)
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

REVOKE ALL ON FUNCTION public.create_link_checkout_admin(uuid, text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_link_checkout_admin(uuid, text, text, text, text, text, text, text, text) TO service_role;