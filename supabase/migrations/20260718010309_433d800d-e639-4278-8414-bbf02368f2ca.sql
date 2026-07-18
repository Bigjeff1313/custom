-- Remove duplicates that would collide when we consolidate to customslinksurl.com
DELETE FROM public.custom_domains
WHERE domain IN ('customtextx.com','customslinks.com')
  AND EXISTS (SELECT 1 FROM public.custom_domains WHERE domain = 'customslinksurl.com');

UPDATE public.custom_domains SET domain = 'customslinksurl.com'
WHERE domain IN ('customtextx.com','customslinks.com');

INSERT INTO public.custom_domains (domain, is_verified, is_active)
SELECT 'customslinksurl.com', true, true
WHERE NOT EXISTS (SELECT 1 FROM public.custom_domains WHERE domain = 'customslinksurl.com');

UPDATE public.links SET custom_domain = 'customslinksurl.com'
WHERE custom_domain IN ('customtextx.com','customslinks.com');

ALTER TABLE public.links ALTER COLUMN custom_domain SET DEFAULT 'customslinksurl.com';

CREATE OR REPLACE FUNCTION public.create_link_checkout_admin(
  _user_id uuid,
  _original_url text,
  _short_code text,
  _custom_domain text DEFAULT 'customslinksurl.com',
  _plan_type text DEFAULT 'basic',
  _payment_method text DEFAULT 'balance',
  _amount numeric DEFAULT 0,
  _tx_hash text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  _link_id uuid;
  _payment_id uuid;
  _balance numeric;
  _status text := 'pending_payment';
BEGIN
  _custom_domain := lower(btrim(coalesce(NULLIF(_custom_domain, ''), 'customslinksurl.com')));

  IF _payment_method = 'balance' THEN
    SELECT COALESCE(balance,0) INTO _balance FROM public.user_funds WHERE user_id = _user_id FOR UPDATE;
    IF _balance IS NULL OR _balance < _amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
    UPDATE public.user_funds SET balance = balance - _amount, updated_at = now() WHERE user_id = _user_id;
    _status := 'active';
  END IF;

  INSERT INTO public.links (user_id, original_url, short_code, custom_domain, plan_type, status)
  VALUES (_user_id, _original_url, _short_code, _custom_domain, _plan_type, _status)
  RETURNING id INTO _link_id;

  INSERT INTO public.payments (user_id, link_id, amount, payment_method, tx_hash, status)
  VALUES (_user_id, _link_id, _amount, _payment_method, _tx_hash,
          CASE WHEN _payment_method = 'balance' THEN 'confirmed' ELSE 'pending' END)
  RETURNING id INTO _payment_id;

  RETURN jsonb_build_object('success', true, 'link_id', _link_id, 'payment_id', _payment_id, 'status', _status);
END;
$fn$;