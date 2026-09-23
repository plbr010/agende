
create type public.billing_interval as enum ('monthly','annual');

alter table public.plans
  add column annual_price_cents integer;

alter table public.plans
  add constraint plans_annual_price_check
  check (annual_price_cents is null or annual_price_cents > 0);

alter table public.subscriptions
  add column billing_interval public.billing_interval not null default 'monthly';

comment on column public.plans.annual_price_cents is
  'Annual price in cents. Nullable until the annual commercial price is defined.';

comment on column public.subscriptions.billing_interval is
  'Billing cadence selected for the workspace subscription.';
