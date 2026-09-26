
create or replace function app.get_stripe_api_key()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select s.decrypted_secret
    into v_secret
  from vault.decrypted_secrets s
  where s.name = 'stripe_api_key'
  order by s.created_at desc
  limit 1;

  if v_secret is null or v_secret = '' then
    raise exception 'stripe_api_key_missing' using errcode = 'P0001';
  end if;

  return v_secret;
end;
$$;

create or replace function public.get_stripe_api_key()
returns text
language sql
security definer
set search_path = ''
as $$
  select app.get_stripe_api_key();
$$;

revoke all on function app.get_stripe_api_key()
  from public, anon, authenticated;
revoke all on function public.get_stripe_api_key()
  from public, anon, authenticated;
grant execute on function public.get_stripe_api_key()
  to service_role;
