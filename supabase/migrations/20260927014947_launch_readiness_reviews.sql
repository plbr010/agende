-- Additive launch readiness: immutable appointment reviews and client read model.
-- No history repair, no billing changes; apply only after review.
create table public.appointment_reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id),
  workspace_id uuid not null references public.workspaces(id),
  client_user_id uuid not null references auth.users(id),
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index appointment_reviews_workspace_idx on public.appointment_reviews(workspace_id, created_at desc);
create index appointment_reviews_client_idx on public.appointment_reviews(client_user_id);
alter table public.appointment_reviews enable row level security;
revoke all on public.appointment_reviews from public, anon, authenticated;
grant select on public.appointment_reviews to authenticated;
grant all on public.appointment_reviews to service_role;
create policy appointment_reviews_read on public.appointment_reviews for select to authenticated
using (client_user_id = (select auth.uid()) or (select app.is_workspace_member(workspace_id)));

create function public.submit_appointment_review(p_appointment_id uuid, p_rating integer, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_appointment public.appointments%rowtype;
  v_review public.appointment_reviews%rowtype;
begin
  v_uid := app.require_confirmed_email();
  perform app.link_workspace_clients_by_confirmed_email();
  select a.* into v_appointment from public.appointments a
  join public.workspace_clients c on c.id=a.client_id and c.workspace_id=a.workspace_id
  where a.id=p_appointment_id and c.linked_user_id=v_uid for update of a;
  if v_appointment.id is null then raise exception 'appointment_not_found' using errcode='42501'; end if;
  if v_appointment.status <> 'completed' then raise exception 'appointment_not_completed' using errcode='22023'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'invalid_rating' using errcode='22023'; end if;
  if char_length(btrim(p_comment)) > 500 then raise exception 'review_comment_too_long' using errcode='22023'; end if;
  insert into public.appointment_reviews(appointment_id,workspace_id,client_user_id,rating,comment)
  values(v_appointment.id,v_appointment.workspace_id,v_uid,p_rating,nullif(btrim(p_comment),''))
  on conflict (appointment_id) do nothing returning * into v_review;
  if v_review.id is null then raise exception 'appointment_already_reviewed' using errcode='23505'; end if;
  return jsonb_build_object('appointment_id',v_review.appointment_id,'rating',v_review.rating,'comment',v_review.comment,'created_at',v_review.created_at);
end;
$$;
revoke all on function public.submit_appointment_review(uuid,integer,text) from public,anon;
grant execute on function public.submit_appointment_review(uuid,integer,text) to authenticated;
comment on table public.appointment_reviews is 'One immutable review per completed appointment. Clients cannot edit or delete. No anonymous/public exposure.';


CREATE OR REPLACE FUNCTION app.list_my_appointments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := app.require_confirmed_email();
  PERFORM app.link_workspace_clients_by_confirmed_email();

  RETURN COALESCE((
    SELECT jsonb_agg(row_data ORDER BY (row_data->>'starts_at'))
    FROM (
      SELECT jsonb_build_object(
        'id', a.id,
        'service_id', a.service_id,
        'professional_member_id', a.professional_member_id,
        'workspace_name', w.name,
        'slug', w.slug,
        'service_name', s.name,
        'professional_name', p.display_name,
        'starts_at', a.starts_at,
        'ends_at', a.ends_at,
        'duration_minutes', a.duration_minutes,
        'price_cents', a.price_cents,
        'status', a.status,
        'timezone', app.workspace_timezone(a.workspace_id),
        'customer_note', a.customer_note,
        'business_phone', st.business_phone
      ) AS row_data
      FROM public.appointments a
      JOIN public.workspace_clients c ON c.id = a.client_id AND c.workspace_id = a.workspace_id
      JOIN public.workspaces w ON w.id = a.workspace_id
      JOIN public.services s ON s.id = a.service_id
      JOIN public.professional_profiles p ON p.member_id = a.professional_member_id
      LEFT JOIN public.workspace_settings st ON st.workspace_id = a.workspace_id
      WHERE c.linked_user_id = v_uid
    ) listed
  ), '[]'::jsonb);
END;
$$;


-- Availability for rescheduling uses the appointment's preserved duration and
-- excludes the appointment itself. Current catalog durations may have changed.
create function public.list_my_reschedule_slots(p_appointment_id uuid, p_professional_member_id uuid, p_local_date date)
returns table(starts_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid;
  v_a public.appointments%rowtype;
  v_tz text;
  v_slot timestamptz;
begin
  v_uid := app.require_confirmed_email();
  perform app.link_workspace_clients_by_confirmed_email();
  select a.* into v_a from public.appointments a join public.workspace_clients c
    on c.id=a.client_id and c.workspace_id=a.workspace_id
    where a.id=p_appointment_id and c.linked_user_id=v_uid;
  if v_a.id is null then raise exception 'appointment_not_found' using errcode='42501'; end if;
  perform app.assert_workspace_entitled(v_a.workspace_id);
  if v_a.status not in ('scheduled','confirmed') then raise exception 'appointment_not_reschedulable' using errcode='22023'; end if;
  if v_a.starts_at < clock_timestamp()+make_interval(mins=>app.client_cancel_lead_minutes()) then raise exception 'reschedule_too_late' using errcode='22023'; end if;
  perform 1 from app.resolve_service_snapshot(v_a.workspace_id,p_professional_member_id,v_a.service_id);
  v_tz := app.workspace_timezone(v_a.workspace_id);
  if p_local_date is null then raise exception 'invalid_date' using errcode='22023'; end if;
  for v_slot in select (p_local_date::timestamp + make_interval(mins=>n)) at time zone v_tz from generate_series(0,1425,15) n loop
    begin
      perform app.assert_public_booking_window(v_a.workspace_id,v_slot);
      perform app.assert_slot_available(v_a.workspace_id,p_professional_member_id,v_slot,v_slot+make_interval(mins=>v_a.duration_minutes),v_a.id);
      starts_at := v_slot;
      return next;
    exception when sqlstate '22023' or sqlstate '23P01' then
      -- Expected closed windows, occupied slots and cutoffs; all other errors propagate.
      null;
    end;
  end loop;
end;
$$;
revoke all on function public.list_my_reschedule_slots(uuid,uuid,date) from public,anon;
grant execute on function public.list_my_reschedule_slots(uuid,uuid,date) to authenticated;

