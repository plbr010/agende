
create type public.privacy_request_type as enum ('export','deletion','correction');
create type public.privacy_request_status as enum ('pending','processing','completed','rejected','cancelled');

create table public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_type public.privacy_request_type not null,
  status public.privacy_request_status not null default 'pending',
  reason text,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint privacy_requests_reason_len
    check (reason is null or char_length(reason)<=1000),
  constraint privacy_requests_resolution_len
    check (resolution_note is null or char_length(resolution_note)<=2000),
  constraint privacy_requests_resolution_shape
    check (
      (status in ('pending','processing') and resolved_at is null)
      or
      (status in ('completed','rejected','cancelled') and resolved_at is not null)
    )
);

create unique index privacy_requests_one_open_type_idx
  on public.privacy_requests(user_id,request_type)
  where status in ('pending','processing');

create index privacy_requests_user_created_idx
  on public.privacy_requests(user_id,created_at desc);

create index privacy_requests_status_created_idx
  on public.privacy_requests(status,created_at);

alter table public.privacy_requests enable row level security;
alter table public.privacy_requests force row level security;

revoke all on public.privacy_requests from public,anon,authenticated;
grant select on public.privacy_requests to authenticated;

create policy privacy_requests_select_own
on public.privacy_requests
for select to authenticated
using ((select auth.uid())=user_id);

create or replace function app.touch_privacy_request_updated_at()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  new.updated_at:=now();
  return new;
end;
$$;

create trigger privacy_requests_touch_updated_at
before update on public.privacy_requests
for each row execute function app.touch_privacy_request_updated_at();

create or replace function app.create_privacy_request(
  p_request_type public.privacy_request_type,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid;
  v_id uuid;
begin
  v_uid:=app.require_confirmed_email();

  select id into v_id
  from public.privacy_requests
  where user_id=v_uid
    and request_type=p_request_type
    and status in ('pending','processing')
  order by created_at desc
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.privacy_requests(
    user_id,request_type,status,reason
  ) values(
    v_uid,p_request_type,'pending',
    nullif(btrim(coalesce(p_reason,'')),'')
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function app.cancel_my_privacy_request(
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_uid uuid;
begin
  v_uid:=app.require_confirmed_email();

  update public.privacy_requests
  set status='cancelled'::public.privacy_request_status,
      resolved_at=now()
  where id=p_request_id
    and user_id=v_uid
    and status='pending'::public.privacy_request_status;

  if not found then
    raise exception 'privacy_request_not_cancellable' using errcode='22023';
  end if;

  return p_request_id;
end;
$$;

create or replace function app.export_my_personal_data()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid;
  v_email text;
  v_auth_created timestamptz;
begin
  v_uid:=app.require_confirmed_email();
  perform app.link_workspace_clients_by_confirmed_email();

  select u.email,u.created_at
  into v_email,v_auth_created
  from auth.users u
  where u.id=v_uid;

  return jsonb_build_object(
    'generated_at',now(),
    'account',jsonb_build_object(
      'user_id',v_uid,
      'email',v_email,
      'created_at',v_auth_created,
      'profile',(
        select to_jsonb(p)
        from public.profiles p
        where p.user_id=v_uid
      ),
      'client_profile',(
        select to_jsonb(cp)
        from public.client_profiles cp
        where cp.user_id=v_uid
      )
    ),
    'professional_memberships',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'workspace_id',m.workspace_id,
            'workspace_name',w.name,
            'role',m.role,
            'status',m.status,
            'joined_at',m.created_at,
            'professional_profile',
              case when pp.member_id is null then null
                   else jsonb_build_object(
                     'display_name',pp.display_name,
                     'bio',pp.bio,
                     'booking_enabled',pp.booking_enabled
                   )
              end
          )
          order by m.created_at
        )
        from public.workspace_members m
        join public.workspaces w on w.id=m.workspace_id
        left join public.professional_profiles pp
          on pp.member_id=m.id
         and pp.workspace_id=m.workspace_id
        where m.user_id=v_uid
      ),'[]'::jsonb),
    'client_records',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'workspace_id',c.workspace_id,
            'workspace_name',w.name,
            'client_record',to_jsonb(c),
            'appointments',
              coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id',a.id,
                    'service_name',s.name,
                    'professional_name',pp.display_name,
                    'starts_at',a.starts_at,
                    'ends_at',a.ends_at,
                    'status',a.status,
                    'price_cents',a.price_cents,
                    'duration_minutes',a.duration_minutes,
                    'customer_note',a.customer_note,
                    'created_at',a.created_at
                  )
                  order by a.starts_at
                )
                from public.appointments a
                left join public.services s
                  on s.id=a.service_id and s.workspace_id=a.workspace_id
                left join public.professional_profiles pp
                  on pp.member_id=a.professional_member_id
                 and pp.workspace_id=a.workspace_id
                where a.client_id=c.id
                  and a.workspace_id=c.workspace_id
              ),'[]'::jsonb),
            'packages',
              coalesce((
                select jsonb_agg(
                  jsonb_build_object(
                    'id',pkg.id,
                    'name',pkg.package_name_snapshot,
                    'price_cents',pkg.price_cents,
                    'purchased_at',pkg.purchased_at,
                    'expires_at',pkg.expires_at,
                    'status',pkg.status,
                    'items',coalesce((
                      select jsonb_agg(
                        jsonb_build_object(
                          'service_name',s2.name,
                          'included_quantity',i.included_quantity,
                          'used_quantity',i.used_quantity
                        )
                      )
                      from public.client_package_items i
                      left join public.services s2
                        on s2.id=i.service_id
                       and s2.workspace_id=i.workspace_id
                      where i.client_package_id=pkg.id
                        and i.workspace_id=pkg.workspace_id
                    ),'[]'::jsonb)
                  )
                  order by pkg.purchased_at
                )
                from public.client_packages pkg
                where pkg.client_id=c.id
                  and pkg.workspace_id=c.workspace_id
              ),'[]'::jsonb)
          )
          order by c.created_at
        )
        from public.workspace_clients c
        join public.workspaces w on w.id=c.workspace_id
        where c.linked_user_id=v_uid
      ),'[]'::jsonb),
    'privacy_requests',
      coalesce((
        select jsonb_agg(to_jsonb(r) order by r.created_at)
        from public.privacy_requests r
        where r.user_id=v_uid
      ),'[]'::jsonb)
  );
end;
$$;

create or replace function public.create_privacy_request(
  p_request_type public.privacy_request_type,
  p_reason text default null
)
returns uuid
language sql
security definer
set search_path=''
as $$
  select app.create_privacy_request(p_request_type,p_reason);
$$;

create or replace function public.cancel_my_privacy_request(
  p_request_id uuid
)
returns uuid
language sql
security definer
set search_path=''
as $$
  select app.cancel_my_privacy_request(p_request_id);
$$;

create or replace function public.export_my_personal_data()
returns jsonb
language sql
security definer
set search_path=''
as $$
  select app.export_my_personal_data();
$$;

revoke all on function app.touch_privacy_request_updated_at() from public,anon,authenticated;
revoke all on function app.create_privacy_request(public.privacy_request_type,text) from public,anon,authenticated;
revoke all on function app.cancel_my_privacy_request(uuid) from public,anon,authenticated;
revoke all on function app.export_my_personal_data() from public,anon,authenticated;

revoke all on function public.create_privacy_request(public.privacy_request_type,text) from public,anon;
revoke all on function public.cancel_my_privacy_request(uuid) from public,anon;
revoke all on function public.export_my_personal_data() from public,anon;

grant execute on function public.create_privacy_request(public.privacy_request_type,text) to authenticated;
grant execute on function public.cancel_my_privacy_request(uuid) to authenticated;
grant execute on function public.export_my_personal_data() to authenticated;

create or replace function app.audit_sanitize(p_row jsonb)
returns jsonb
language sql
immutable
set search_path=''
as $$
  select case
    when p_row is null then null
    else p_row-array[
      'email','phone','full_name','birth_date','notes','customer_note',
      'description','address','business_email','business_phone',
      'postal_code','instagram','token_hash','bio','reason','resolution_note'
    ]::text[]
  end;
$$;

create trigger appointments_audit
after insert or update or delete on public.appointments
for each row execute function app.capture_audit_event();

create trigger workspace_settings_audit
after insert or update or delete on public.workspace_settings
for each row execute function app.capture_audit_event();

create trigger workspace_clients_audit
after insert or update or delete on public.workspace_clients
for each row execute function app.capture_audit_event();

create trigger professional_profiles_audit
after insert or update or delete on public.professional_profiles
for each row execute function app.capture_audit_event();

create trigger professional_working_hours_audit
after insert or update or delete on public.professional_working_hours
for each row execute function app.capture_audit_event();

create trigger professional_breaks_audit
after insert or update or delete on public.professional_breaks
for each row execute function app.capture_audit_event();

create trigger professional_time_blocks_audit
after insert or update or delete on public.professional_time_blocks
for each row execute function app.capture_audit_event();

create trigger financial_refunds_audit
after insert or update or delete on public.financial_refunds
for each row execute function app.capture_audit_event();
