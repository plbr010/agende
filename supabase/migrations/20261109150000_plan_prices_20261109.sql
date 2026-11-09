-- Monthly list prices approved by the owner on 2026-11-09.
-- Data only: no table, RLS, grant, subscription or seat-limit change.
-- annual_price_cents is intentionally untouched (new annual offers are
-- suspended in the app and the billing Edge Function until approved).
-- Existing subscriptions keep their Stripe price; nothing here migrates them.
--
-- Reverse (same transaction shape):
--   UPDATE public.plans SET monthly_price_cents = CASE code
--     WHEN 'solo' THEN 8990 WHEN 'equipe' THEN 16990 WHEN 'salao' THEN 29990 END,
--     updated_at = now()
--   WHERE code IN ('solo','equipe','salao');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.plans WHERE code IN ('solo', 'equipe', 'salao')) <> 3 THEN
    RAISE EXCEPTION 'plan_prices_precondition: expected the three plans';
  END IF;
END;
$$;

UPDATE public.plans
SET monthly_price_cents = CASE code
      WHEN 'solo' THEN 3990
      WHEN 'equipe' THEN 7990
      WHEN 'salao' THEN 14990
    END,
    updated_at = now()
WHERE code IN ('solo', 'equipe', 'salao');
