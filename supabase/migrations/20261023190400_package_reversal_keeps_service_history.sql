-- Desfazer o consumo devolve a sessão ao pacote.
-- Não reabre o recebível do serviço: a receita continua na venda do pacote.
-- A comissão já zerada permanece no histórico, sem voltar a ficar devida.

create or replace function app.reverse_package_redemption(
  p_workspace_id uuid,
  p_redemption_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_r public.package_redemptions%rowtype;
  v_item public.client_package_items%rowtype;
  v_cp public.client_packages%rowtype;
  v_appt public.appointments%rowtype;
  v_new_status public.client_package_status;
begin
  perform app.assert_package_manager(p_workspace_id);

  if char_length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'reversal_reason_required' using errcode='22023';
  end if;

  select * into v_r
  from public.package_redemptions
  where id=p_redemption_id
    and workspace_id=p_workspace_id
  for update;

  if v_r.id is null then
    raise exception 'package_redemption_not_found' using errcode='P0002';
  end if;

  if v_r.reversed_at is not null then
    raise exception 'package_redemption_already_reversed' using errcode='22023';
  end if;

  select * into v_item
  from public.client_package_items
  where id=v_r.client_package_item_id
    and workspace_id=p_workspace_id
  for update;

  select * into v_cp
  from public.client_packages
  where id=v_r.client_package_id
    and workspace_id=p_workspace_id
  for update;

  select * into v_appt
  from public.appointments
  where id=v_r.appointment_id
    and workspace_id=p_workspace_id
  for share;

  if v_item.id is null or v_cp.id is null or v_appt.id is null then
    raise exception 'package_redemption_integrity_error' using errcode='22023';
  end if;

  if v_item.used_quantity <= 0 then
    raise exception 'package_item_usage_invalid' using errcode='22023';
  end if;

  update public.client_package_items
  set used_quantity=used_quantity-1
  where id=v_item.id
    and workspace_id=p_workspace_id;

  if v_cp.status='cancelled'::public.client_package_status then
    v_new_status := 'cancelled'::public.client_package_status;
  elsif v_cp.expires_at is not null and v_cp.expires_at <= now() then
    v_new_status := 'expired'::public.client_package_status;
  else
    v_new_status := 'active'::public.client_package_status;
  end if;

  update public.client_packages
  set status=v_new_status
  where id=v_cp.id
    and workspace_id=p_workspace_id;

  perform set_config('app.package_redemption_mutating','on',true);
  update public.package_redemptions
  set reversed_at=now(),
      reversed_by=auth.uid(),
      reversal_reason=btrim(p_reason)
  where id=v_r.id
    and workspace_id=p_workspace_id;
  perform set_config('app.package_redemption_mutating','off',true);

  return jsonb_build_object(
    'redemption_id',v_r.id,
    'client_package_id',v_cp.id,
    'appointment_id',v_appt.id,
    'package_status',v_new_status,
    'remaining_after_reversal',
      v_item.included_quantity-(v_item.used_quantity-1)
  );
end;
$$;

revoke all on function app.reverse_package_redemption(uuid,uuid,text) from public,anon,authenticated;
