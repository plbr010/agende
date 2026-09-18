CREATE OR REPLACE FUNCTION app.resolve_service_snapshot(
  p_workspace_id uuid,
  p_professional_member_id uuid,
  p_service_id uuid
)
RETURNS TABLE (price_cents integer, duration_minutes integer)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_service public.services%ROWTYPE;
  v_link public.professional_services%ROWTYPE;
BEGIN
  SELECT s.* INTO v_service
  FROM public.services s
  WHERE s.id = p_service_id
    AND s.workspace_id = p_workspace_id;

  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'service_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_service.archived_at IS NOT NULL OR v_service.active IS NOT TRUE THEN
    RAISE EXCEPTION 'service_inactive' USING ERRCODE = '22023';
  END IF;

  SELECT ps.* INTO v_link
  FROM public.professional_services ps
  WHERE ps.workspace_id = p_workspace_id
    AND ps.professional_member_id = p_professional_member_id
    AND ps.service_id = p_service_id
    AND ps.active;

  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'professional_service_inactive' USING ERRCODE = '22023';
  END IF;

  price_cents := COALESCE(v_link.price_override_cents, v_service.price_cents);
  duration_minutes := COALESCE(v_link.duration_override_minutes, v_service.duration_minutes);
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION app.assert_slot_available(
  p_workspace_id uuid,
  p_professional_member_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_ignore_appointment_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_tz text := app.product_timezone();
  v_local_start timestamp;
  v_local_end timestamp;
  v_dow integer;
  v_start_min integer;
  v_end_min integer;
  v_profile public.professional_profiles%ROWTYPE;
  v_member public.workspace_members%ROWTYPE;
BEGIN
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_starts_at >= p_ends_at THEN
    RAISE EXCEPTION 'invalid_appointment_range' USING ERRCODE = '22023';
  END IF;

  v_local_start := p_starts_at AT TIME ZONE v_tz;
  v_local_end := p_ends_at AT TIME ZONE v_tz;
  v_start_min := app.time_to_minutes(v_local_start::time);
  v_end_min := app.time_to_minutes(v_local_end::time);

  IF v_local_end::date > v_local_start::date THEN
    v_end_min := v_end_min + 1440 * (v_local_end::date - v_local_start::date);
  END IF;

  IF v_end_min > 1440 THEN
    RAISE EXCEPTION 'appointment_crosses_local_date' USING ERRCODE = '22023';
  END IF;

  v_dow := EXTRACT(DOW FROM v_local_start)::integer;

  SELECT p.* INTO v_profile
  FROM public.professional_profiles p
  WHERE p.member_id = p_professional_member_id
    AND p.workspace_id = p_workspace_id;

  IF v_profile.member_id IS NULL THEN
    RAISE EXCEPTION 'professional_not_found' USING ERRCODE = '22023';
  END IF;

  IF v_profile.booking_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'professional_booking_disabled' USING ERRCODE = '22023';
  END IF;

  SELECT m.* INTO v_member
  FROM public.workspace_members m
  WHERE m.id = p_professional_member_id
    AND m.workspace_id = p_workspace_id;

  IF v_member.id IS NULL OR v_member.status IS DISTINCT FROM 'active'::public.member_status THEN
    RAISE EXCEPTION 'professional_inactive' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.professional_working_hours h
    WHERE h.workspace_id = p_workspace_id
      AND h.professional_member_id = p_professional_member_id
      AND h.weekday = v_dow
      AND h.active
      AND app.time_to_minutes(h.start_time) <= v_start_min
      AND app.time_to_minutes(h.end_time) >= v_end_min
  ) THEN
    RAISE EXCEPTION 'outside_working_hours' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.professional_breaks b
    WHERE b.workspace_id = p_workspace_id
      AND b.professional_member_id = p_professional_member_id
      AND b.weekday = v_dow
      AND b.active
      AND int4range(app.time_to_minutes(b.start_time), app.time_to_minutes(b.end_time), '[)')
          && int4range(v_start_min, v_end_min, '[)')
  ) THEN
    RAISE EXCEPTION 'inside_break' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.professional_time_blocks blk
    WHERE blk.workspace_id = p_workspace_id
      AND blk.professional_member_id = p_professional_member_id
      AND tstzrange(blk.starts_at, blk.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'inside_time_block' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.workspace_id = p_workspace_id
      AND a.professional_member_id = p_professional_member_id
      AND a.status IN (
        'scheduled'::public.appointment_status,
        'confirmed'::public.appointment_status,
        'in_progress'::public.appointment_status,
        'completed'::public.appointment_status
      )
      AND (p_ignore_appointment_id IS NULL OR a.id <> p_ignore_appointment_id)
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'appointment_overlap' USING ERRCODE = '23P01';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.can_manage_jornada(
  p_workspace_id uuid,
  p_professional_member_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_actor public.workspace_members;
BEGIN
  SELECT m.* INTO v_actor
  FROM public.workspace_members m
  WHERE m.workspace_id = p_workspace_id
    AND m.user_id = auth.uid()
    AND m.status = 'active';
  IF v_actor.id IS NULL THEN
    RETURN false;
  END IF;
  IF v_actor.role IN ('owner'::public.member_role, 'admin'::public.member_role) THEN
    RETURN true;
  END IF;
  RETURN v_actor.role = 'professional'::public.member_role
    AND v_actor.id = p_professional_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.can_manage_time_blocks(
  p_workspace_id uuid,
  p_professional_member_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_actor public.workspace_members;
BEGIN
  SELECT m.* INTO v_actor
  FROM public.workspace_members m
  WHERE m.workspace_id = p_workspace_id
    AND m.user_id = auth.uid()
    AND m.status = 'active';
  IF v_actor.id IS NULL THEN
    RETURN false;
  END IF;
  IF v_actor.role IN (
    'owner'::public.member_role,
    'admin'::public.member_role,
    'receptionist'::public.member_role
  ) THEN
    RETURN true;
  END IF;
  RETURN v_actor.role = 'professional'::public.member_role
    AND v_actor.id = p_professional_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.can_write_appointment(
  p_workspace_id uuid,
  p_professional_member_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_actor public.workspace_members;
BEGIN
  SELECT m.* INTO v_actor
  FROM public.workspace_members m
  WHERE m.workspace_id = p_workspace_id
    AND m.user_id = auth.uid()
    AND m.status = 'active';
  IF v_actor.id IS NULL THEN
    RETURN false;
  END IF;
  IF v_actor.role IN (
    'owner'::public.member_role,
    'admin'::public.member_role,
    'receptionist'::public.member_role
  ) THEN
    RETURN true;
  END IF;
  RETURN v_actor.role = 'professional'::public.member_role
    AND v_actor.id = p_professional_member_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.assert_status_transition(
  p_from public.appointment_status,
  p_to public.appointment_status,
  p_role public.member_role
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_from = p_to THEN
    RETURN;
  END IF;

  IF p_from IN (
    'completed'::public.appointment_status,
    'cancelled'::public.appointment_status,
    'no_show'::public.appointment_status
  ) THEN
    RAISE EXCEPTION 'appointment_terminal' USING ERRCODE = '22023';
  END IF;

  IF p_role = 'receptionist'::public.member_role THEN
    IF p_to NOT IN (
      'confirmed'::public.appointment_status,
      'cancelled'::public.appointment_status,
      'no_show'::public.appointment_status
    ) THEN
      RAISE EXCEPTION 'status_denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_from = 'scheduled'::public.appointment_status
     AND p_to IN (
       'confirmed'::public.appointment_status,
       'in_progress'::public.appointment_status,
       'cancelled'::public.appointment_status,
       'no_show'::public.appointment_status
     ) THEN
    RETURN;
  END IF;

  IF p_from = 'confirmed'::public.appointment_status
     AND p_to IN (
       'in_progress'::public.appointment_status,
       'cancelled'::public.appointment_status,
       'no_show'::public.appointment_status
     ) THEN
    RETURN;
  END IF;

  IF p_from = 'in_progress'::public.appointment_status
     AND p_to IN (
       'completed'::public.appointment_status,
       'cancelled'::public.appointment_status
     ) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'invalid_status_transition' USING ERRCODE = '22023';
END;
$$;

CREATE OR REPLACE FUNCTION app.range_subtract(p_window tstzrange, p_occupied tstzrange)
RETURNS tstzrange[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_occupied IS NULL OR isempty(p_occupied) OR NOT (p_window && p_occupied) THEN ARRAY[p_window]
    WHEN p_occupied @> p_window THEN ARRAY[]::tstzrange[]
    ELSE ARRAY_REMOVE(ARRAY[
      CASE
        WHEN lower(p_window) < lower(p_occupied)
          THEN tstzrange(lower(p_window), lower(p_occupied), '[)')
        ELSE NULL
      END,
      CASE
        WHEN upper(p_window) > upper(p_occupied)
          THEN tstzrange(upper(p_occupied), upper(p_window), '[)')
        ELSE NULL
      END
    ], NULL)
  END;
$$;

