
create unique index if not exists appointments_client_service_start_active_unique
  on public.appointments(workspace_id,client_id,service_id,starts_at)
  where status in (
    'scheduled'::public.appointment_status,
    'confirmed'::public.appointment_status,
    'in_progress'::public.appointment_status
  );

create or replace function app.find_or_create_public_client(
  p_workspace_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_name text:=btrim(coalesce(p_full_name,''));
  v_email text:=nullif(lower(btrim(coalesce(p_email,''))),'');
  v_phone text;
begin
  if char_length(v_name)<2 or char_length(v_name)>120 then
    raise exception 'invalid_client_name' using errcode='22023';
  end if;

  if v_email is null or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode='22023';
  end if;

  v_phone:=app.normalize_phone(p_phone);
  if v_phone is null then
    raise exception 'invalid_phone' using errcode='22023';
  end if;

  if p_user_id is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(p_workspace_id::text||'|user|'||p_user_id::text,0)
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text||'|phone|'||v_phone,0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text||'|email|'||v_email,0)
  );

  if p_user_id is not null then
    select c.id into v_id
    from public.workspace_clients c
    where c.workspace_id=p_workspace_id
      and c.linked_user_id=p_user_id
      and c.archived_at is null
    order by c.created_at
    limit 1;
  end if;

  if v_id is null then
    select c.id into v_id
    from public.workspace_clients c
    where c.workspace_id=p_workspace_id
      and c.archived_at is null
      and c.phone=v_phone
    order by c.created_at
    limit 1;
  end if;

  if v_id is null then
    select c.id into v_id
    from public.workspace_clients c
    where c.workspace_id=p_workspace_id
      and c.archived_at is null
      and c.email=v_email
    order by c.created_at
    limit 1;
  end if;

  if v_id is null then
    insert into public.workspace_clients(
      workspace_id,full_name,email,phone
    ) values(
      p_workspace_id,v_name,v_email,v_phone
    )
    returning id into v_id;
  else
    update public.workspace_clients
    set full_name=case
          when char_length(btrim(full_name))<2 then v_name
          else full_name
        end,
        email=coalesce(email,v_email),
        phone=coalesce(phone,v_phone)
    where id=v_id
      and workspace_id=p_workspace_id;
  end if;

  if p_user_id is not null then
    perform set_config('app.bypass_protected_columns','on',true);

    update public.workspace_clients
    set linked_user_id=p_user_id
    where id=v_id
      and workspace_id=p_workspace_id
      and linked_user_id is null;

    perform set_config('app.bypass_protected_columns','off',true);
  end if;

  return v_id;
end;
$$;
