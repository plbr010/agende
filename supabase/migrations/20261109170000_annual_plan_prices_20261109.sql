-- Annual list prices approved by the owner on 2026-11-09: 12 months for the
-- price of 10 monthly payments (R$ 399 / 799 / 1.499), charged upfront.
-- Data only: no table, RLS, grant, subscription or seat-limit change.
-- monthly_price_cents (20261109150000) and max_professionals stay as they are.
-- Existing subscriptions keep their Stripe price; nothing here migrates them.
--
-- Reverse (same transaction shape):
--   UPDATE public.plans SET annual_price_cents = CASE code
--     WHEN 'solo' THEN 79900 WHEN 'equipe' THEN 149900 WHEN 'salao' THEN 279900 END,
--     updated_at = now()
--   WHERE code IN ('solo','equipe','salao');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.plans WHERE code IN ('solo', 'equipe', 'salao')) <> 3 THEN
    RAISE EXCEPTION 'annual_plan_prices_precondition: expected the three plans';
  END IF;
END;
$$;

UPDATE public.plans
SET annual_price_cents = CASE code
      WHEN 'solo' THEN 39900
      WHEN 'equipe' THEN 79900
      WHEN 'salao' THEN 149900
    END,
    updated_at = now()
WHERE code IN ('solo', 'equipe', 'salao');
