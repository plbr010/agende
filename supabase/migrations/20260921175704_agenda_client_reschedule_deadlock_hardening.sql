
create or replace function app.lock_professional_pair(
  p_a uuid,
  p_b uuid
)
returns void
language plpgsql
set search_path=''
as $$
begin
  if p_a is null or p_b is null then
    raise exception 'invalid_professional_lock' using errcode='22023';
  end if;

  if p_a=p_b then
    perform app.lock_professional_agenda(p_a);
  elsif p_a::text < p_b::text then
    perform app.lock_professional_agenda(p_a);
    perform app.lock_professional_agenda(p_b);
  else
    perform app.lock_professional_agenda(p_b);
    perform app.lock_professional_agenda(p_a);
  end if;
end;
$$;

create or replace function app.reschedule_appointment(
  p_appointment_id uuid,
  p_professional_member_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row public.appointments%rowtype;
  v_snapshot record;
  v_ends timestamptz;
  v_price integer;
  v_duration integer;
  v_notes text;
begin
  perform app.require_confirmed_email();

  select a.* into v_row
  from public.appointments a
  where a.id=p_appointment_id
  for update;

  if v_row.id is null then
    raise exception 'appointment_not_found' using errcode='22023';
  end if;

  perform app.assert_workspace_entitled(v_row.workspace_id);

  if not app.can_write_appointment(v_row.workspace_id,v_row.professional_member_id)
     or not app.can_write_appointment(v_row.workspace_id,p_professional_member_id) then
    raise exception 'appointment_write_denied' using errcode='42501';
  end if;

  if v_row.status in (
    'completed'::public.appointment_status,
    'cancelled'::public.appointment_status,
    'no_show'::public.appointment_status
  ) then
    raise exception 'appointment_terminal' using errcode='22023';
  end if;

  if v_row.status='in_progress'::public.appointment_status then
    raise exception 'appointment_in_progress' using errcode='22023';
  end if;

  perform app.lock_professional_pair(
    v_row.professional_member_id,
    p_professional_member_id
  );

  if p_service_id is distinct from v_row.service_id
     or p_professional_member_id is distinct from v_row.professional_member_id then
    select s.price_cents,s.duration_minutes
    into v_snapshot
    from app.resolve_service_snapshot(
      v_row.workspace_id,p_professional_member_id,p_service_id
    ) s;

    v_price:=v_snapshot.price_cents;
    v_duration:=v_snapshot.duration_minutes;
  else
    perform 1
    from app.resolve_service_snapshot(
      v_row.workspace_id,p_professional_member_id,p_service_id
    );

    v_price:=v_row.price_cents;
    v_duration:=v_row.duration_minutes;
  end if;

  v_ends:=p_starts_at+make_interval(mins=>v_duration);
  v_notes:=case
    when p_notes is null then v_row.notes
    else nullif(btrim(p_notes),'')
  end;

  perform app.assert_slot_available(
    v_row.workspace_id,
    p_professional_member_id,
    p_starts_at,
    v_ends,
    v_row.id
  );

  perform set_config('app.allow_appointment_snapshot','on',true);

  update public.appointments
  set professional_member_id=p_professional_member_id,
      service_id=p_service_id,
      starts_at=p_starts_at,
      ends_at=v_ends,
      price_cents=v_price,
      duration_minutes=v_duration,
      notes=v_notes
  where id=v_row.id
    and workspace_id=v_row.workspace_id;

  perform set_config('app.allow_appointment_snapshot','off',true);

  return v_row.id;
end;
$$;

create or replace function app.reschedule_my_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_professional_member_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid;
  v_row public.appointments%rowtype;
  v_target_professional uuid;
  v_ends timestamptz;
  v_workspace_name text;
  v_slug text;
  v_service_name text;
  v_professional_name text;
  v_timezone text;
begin
  v_uid:=app.require_confirmed_email();
  perform app.link_workspace_clients_by_confirmed_email();

  select a.* into v_row
  from public.appointments a
  join public.workspace_clients c
    on c.id=a.client_id
   and c.workspace_id=a.workspace_id
  where a.id=p_appointment_id
    and c.linked_user_id=v_uid
  for update of a;

  if v_row.id is null then
    raise exception 'appointment_not_found' using errcode='42501';
  end if;

  perform app.assert_workspace_entitled(v_row.workspace_id);

  if v_row.status not in (
    'scheduled'::public.appointment_status,
    'confirmed'::public.appointment_status
  ) then
    raise exception 'appointment_not_reschedulable' using errcode='22023';
  end if;

  if v_row.starts_at <
     clock_timestamp()+make_interval(mins=>app.client_cancel_lead_minutes()) then
    raise exception 'reschedule_too_late' using errcode='22023';
  end if;

  perform app.assert_public_booking_window(v_row.workspace_id,p_starts_at);

  v_target_professional:=coalesce(
    p_professional_member_id,
    v_row.professional_member_id
  );

  perform 1
  from app.resolve_service_snapshot(
    v_row.workspace_id,
    v_target_professional,
    v_row.service_id
  );

  perform app.lock_professional_pair(
    v_row.professional_member_id,
    v_target_professional
  );

  v_ends:=p_starts_at+make_interval(mins=>v_row.duration_minutes);

  perform app.assert_slot_available(
    v_row.workspace_id,
    v_target_professional,
    p_starts_at,
    v_ends,
    v_row.id
  );

  perform set_config('app.allow_appointment_snapshot','on',true);

  update public.appointments
  set professional_member_id=v_target_professional,
      starts_at=p_starts_at,
      ends_at=v_ends
  where id=v_row.id
    and workspace_id=v_row.workspace_id;

  perform set_config('app.allow_appointment_snapshot','off',true);

  select w.name,w.slug,app.workspace_timezone(w.id)
  into v_workspace_name,v_slug,v_timezone
  from public.workspaces w
  where w.id=v_row.workspace_id;

  select s.name into v_service_name
  from public.services s
  where s.id=v_row.service_id
    and s.workspace_id=v_row.workspace_id;

  select p.display_name into v_professional_name
  from public.professional_profiles p
  where p.member_id=v_target_professional
    and p.workspace_id=v_row.workspace_id;

  return jsonb_build_object(
    'id',v_row.id,
    'workspace_name',v_workspace_name,
    'slug',v_slug,
    'service_name',v_service_name,
    'professional_name',v_professional_name,
    'starts_at',p_starts_at,
    'ends_at',v_ends,
    'duration_minutes',v_row.duration_minutes,
    'price_cents',v_row.price_cents,
    'status',v_row.status,
    'timezone',v_timezone
  );
end;
$$;

create or replace function public.reschedule_my_appointment(
  p_appointment_id uuid,
  p_starts_at timestamptz,
  p_professional_member_id uuid default null
)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select app.reschedule_my_appointment(
    p_appointment_id,p_starts_at,p_professional_member_id
  );
$$;

revoke all on function app.lock_professional_pair(uuid,uuid) from public,anon,authenticated;
revoke all on function app.reschedule_my_appointment(uuid,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.reschedule_my_appointment(uuid,timestamptz,uuid) from public,anon;
grant execute on function public.reschedule_my_appointment(uuid,timestamptz,uuid) to authenticated;
