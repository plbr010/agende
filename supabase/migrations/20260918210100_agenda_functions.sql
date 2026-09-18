-- Agenda helpers, availability, appointment RPCs and protect triggers.
-- Timezone do produto: único lugar no banco (app.product_timezone).
-- Mutação de appointments é atômica (lock + validação + INSERT/UPDATE + EXCLUDE).

CREATE OR REPLACE FUNCTION app.product_timezone()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT 'America/Sao_Paulo'::text;
$$;

COMMENT ON FUNCTION app.product_timezone() IS
  'Fuso padrão do produto. Não hardcode America/Sao_Paulo em RPCs/UI; use este helper e src/lib/time/timezone.ts.';

CREATE OR REPLACE FUNCTION app.time_to_minutes(p_time time)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT (EXTRACT(HOUR FROM p_time)::integer * 60 + EXTRACT(MINUTE FROM p_time)::integer);
$$;

CREATE OR REPLACE FUNCTION app.lock_professional_agenda(p_professional_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_professional_member_id::text, 0));
END;
$$;

CREATE OR REPLACE FUNCTION app.actor_member(p_workspace_id uuid)
RETURNS public.workspace_members
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_row public.workspace_members;
BEGIN
  SELECT m.* INTO v_row
  FROM public.workspace_members m
  WHERE m.workspace_id = p_workspace_id
    AND m.user_id = auth.uid()
    AND m.status = 'active';

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'not_workspace_member' USING ERRCODE = '42501';
  END IF;

  RETURN v_row;
END;
$$;

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

CREATE OR REPLACE FUNCTION app.list_available_slots(
  p_workspace_id uuid,
  p_professional_member_id uuid,
  p_service_id uuid,
  p_local_date date
)
RETURNS TABLE (starts_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tz text := app.product_timezone();
  v_dow integer;
  v_duration integer;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_windows tstzrange[] := ARRAY[]::tstzrange[];
  v_next tstzrange[] := ARRAY[]::tstzrange[];
  v_window tstzrange;
  v_piece tstzrange;
  v_occ tstzrange;
  v_slot timestamptz;
  v_end timestamptz;
  v_local timestamp;
  v_min integer;
  v_aligned integer;
  v_booking boolean;
BEGIN
  PERFORM app.actor_member(p_workspace_id);

  SELECT p.booking_enabled INTO v_booking
  FROM public.professional_profiles p
  WHERE p.member_id = p_professional_member_id
    AND p.workspace_id = p_workspace_id;

  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'professional_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_booking IS NOT TRUE THEN
    RETURN;
  END IF;

  SELECT s.duration_minutes INTO v_duration
  FROM app.resolve_service_snapshot(p_workspace_id, p_professional_member_id, p_service_id) s;

  v_dow := EXTRACT(DOW FROM p_local_date)::integer;
  v_day_start := (p_local_date::timestamp) AT TIME ZONE v_tz;
  v_day_end := ((p_local_date + 1)::timestamp) AT TIME ZONE v_tz;

  SELECT COALESCE(array_agg(tstzrange(
           (p_local_date + h.start_time) AT TIME ZONE v_tz,
           (p_local_date + h.end_time) AT TIME ZONE v_tz,
           '[)'
         ) ORDER BY h.start_time), ARRAY[]::tstzrange[])
    INTO v_windows
  FROM public.professional_working_hours h
  WHERE h.workspace_id = p_workspace_id
    AND h.professional_member_id = p_professional_member_id
    AND h.weekday = v_dow
    AND h.active;

  FOREACH v_occ IN ARRAY COALESCE((
    SELECT array_agg(tstzrange(
             (p_local_date + b.start_time) AT TIME ZONE v_tz,
             (p_local_date + b.end_time) AT TIME ZONE v_tz,
             '[)'
           ))
    FROM public.professional_breaks b
    WHERE b.workspace_id = p_workspace_id
      AND b.professional_member_id = p_professional_member_id
      AND b.weekday = v_dow
      AND b.active
  ), ARRAY[]::tstzrange[])
  LOOP
    v_next := ARRAY[]::tstzrange[];
    FOREACH v_window IN ARRAY v_windows LOOP
      FOREACH v_piece IN ARRAY app.range_subtract(v_window, v_occ) LOOP
        v_next := v_next || v_piece;
      END LOOP;
    END LOOP;
    v_windows := v_next;
  END LOOP;

  FOREACH v_occ IN ARRAY COALESCE((
    SELECT array_agg(tstzrange(blk.starts_at, blk.ends_at, '[)'))
    FROM public.professional_time_blocks blk
    WHERE blk.workspace_id = p_workspace_id
      AND blk.professional_member_id = p_professional_member_id
      AND tstzrange(blk.starts_at, blk.ends_at, '[)') && tstzrange(v_day_start, v_day_end, '[)')
  ), ARRAY[]::tstzrange[])
  LOOP
    v_next := ARRAY[]::tstzrange[];
    FOREACH v_window IN ARRAY v_windows LOOP
      FOREACH v_piece IN ARRAY app.range_subtract(v_window, v_occ) LOOP
        v_next := v_next || v_piece;
      END LOOP;
    END LOOP;
    v_windows := v_next;
  END LOOP;

  FOREACH v_occ IN ARRAY COALESCE((
    SELECT array_agg(tstzrange(a.starts_at, a.ends_at, '[)'))
    FROM public.appointments a
    WHERE a.workspace_id = p_workspace_id
      AND a.professional_member_id = p_professional_member_id
      AND a.status IN (
        'scheduled'::public.appointment_status,
        'confirmed'::public.appointment_status,
        'in_progress'::public.appointment_status,
        'completed'::public.appointment_status
      )
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_day_start, v_day_end, '[)')
  ), ARRAY[]::tstzrange[])
  LOOP
    v_next := ARRAY[]::tstzrange[];
    FOREACH v_window IN ARRAY v_windows LOOP
      FOREACH v_piece IN ARRAY app.range_subtract(v_window, v_occ) LOOP
        v_next := v_next || v_piece;
      END LOOP;
    END LOOP;
    v_windows := v_next;
  END LOOP;

  FOREACH v_window IN ARRAY v_windows LOOP
    v_local := lower(v_window) AT TIME ZONE v_tz;
    v_min := app.time_to_minutes(v_local::time);
    v_aligned := ((v_min + 14) / 15) * 15;
    v_slot := (v_local::date::timestamp + make_interval(mins => v_aligned)) AT TIME ZONE v_tz;
    IF v_slot < lower(v_window) THEN
      v_slot := v_slot + interval '15 minutes';
    END IF;

    WHILE v_slot + make_interval(mins => v_duration) <= upper(v_window) LOOP
      v_end := v_slot + make_interval(mins => v_duration);
      starts_at := v_slot;
      RETURN NEXT;
      v_slot := v_slot + interval '15 minutes';
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION app.create_appointment(
  p_workspace_id uuid,
  p_client_id uuid,
  p_professional_member_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor public.workspace_members;
  v_snapshot record;
  v_ends timestamptz;
  v_notes text;
  v_id uuid;
  v_client_archived timestamptz;
BEGIN
  PERFORM app.require_confirmed_email();
  v_actor := app.actor_member(p_workspace_id);

  IF NOT app.can_write_appointment(p_workspace_id, p_professional_member_id) THEN
    RAISE EXCEPTION 'appointment_write_denied' USING ERRCODE = '42501';
  END IF;

  SELECT c.archived_at INTO v_client_archived
  FROM public.workspace_clients c
  WHERE c.id = p_client_id
    AND c.workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client_not_found' USING ERRCODE = '22023';
  END IF;
  IF v_client_archived IS NOT NULL THEN
    RAISE EXCEPTION 'client_archived' USING ERRCODE = '22023';
  END IF;

  PERFORM app.lock_professional_agenda(p_professional_member_id);

  SELECT s.price_cents, s.duration_minutes
    INTO v_snapshot
  FROM app.resolve_service_snapshot(p_workspace_id, p_professional_member_id, p_service_id) s;

  v_ends := p_starts_at + make_interval(mins => v_snapshot.duration_minutes);
  v_notes := nullif(btrim(COALESCE(p_notes, '')), '');

  PERFORM app.assert_slot_available(
    p_workspace_id,
    p_professional_member_id,
    p_starts_at,
    v_ends,
    NULL
  );

  INSERT INTO public.appointments (
    workspace_id,
    client_id,
    professional_member_id,
    service_id,
    starts_at,
    ends_at,
    status,
    price_cents,
    duration_minutes,
    notes,
    created_by
  ) VALUES (
    p_workspace_id,
    p_client_id,
    p_professional_member_id,
    p_service_id,
    p_starts_at,
    v_ends,
    'scheduled'::public.appointment_status,
    v_snapshot.price_cents,
    v_snapshot.duration_minutes,
    v_notes,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.reschedule_appointment(
  p_appointment_id uuid,
  p_professional_member_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.appointments%ROWTYPE;
  v_snapshot record;
  v_ends timestamptz;
  v_price integer;
  v_duration integer;
  v_notes text;
BEGIN
  PERFORM app.require_confirmed_email();

  SELECT a.* INTO v_row
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = '22023';
  END IF;

  IF NOT app.can_write_appointment(v_row.workspace_id, v_row.professional_member_id)
     OR NOT app.can_write_appointment(v_row.workspace_id, p_professional_member_id) THEN
    RAISE EXCEPTION 'appointment_write_denied' USING ERRCODE = '42501';
  END IF;

  IF v_row.status IN (
    'completed'::public.appointment_status,
    'cancelled'::public.appointment_status,
    'no_show'::public.appointment_status
  ) THEN
    RAISE EXCEPTION 'appointment_terminal' USING ERRCODE = '22023';
  END IF;

  IF v_row.status = 'in_progress'::public.appointment_status THEN
    RAISE EXCEPTION 'appointment_in_progress' USING ERRCODE = '22023';
  END IF;

  PERFORM app.lock_professional_agenda(p_professional_member_id);
  IF p_professional_member_id IS DISTINCT FROM v_row.professional_member_id THEN
    PERFORM app.lock_professional_agenda(v_row.professional_member_id);
  END IF;

  IF p_service_id IS DISTINCT FROM v_row.service_id THEN
    SELECT s.price_cents, s.duration_minutes
      INTO v_snapshot
    FROM app.resolve_service_snapshot(v_row.workspace_id, p_professional_member_id, p_service_id) s;
    v_price := v_snapshot.price_cents;
    v_duration := v_snapshot.duration_minutes;
  ELSE
    PERFORM 1
    FROM app.resolve_service_snapshot(v_row.workspace_id, p_professional_member_id, p_service_id);
    v_price := v_row.price_cents;
    v_duration := v_row.duration_minutes;
  END IF;

  v_ends := p_starts_at + make_interval(mins => v_duration);
  v_notes := CASE
    WHEN p_notes IS NULL THEN v_row.notes
    ELSE nullif(btrim(p_notes), '')
  END;

  PERFORM app.assert_slot_available(
    v_row.workspace_id,
    p_professional_member_id,
    p_starts_at,
    v_ends,
    v_row.id
  );

  PERFORM set_config('app.allow_appointment_snapshot', 'on', true);

  UPDATE public.appointments
  SET professional_member_id = p_professional_member_id,
      service_id = p_service_id,
      starts_at = p_starts_at,
      ends_at = v_ends,
      price_cents = v_price,
      duration_minutes = v_duration,
      notes = v_notes
  WHERE id = v_row.id
    AND workspace_id = v_row.workspace_id;

  PERFORM set_config('app.allow_appointment_snapshot', 'off', true);

  RETURN v_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION app.set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.appointments%ROWTYPE;
  v_actor public.workspace_members;
BEGIN
  PERFORM app.require_confirmed_email();

  SELECT a.* INTO v_row
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = '22023';
  END IF;

  v_actor := app.actor_member(v_row.workspace_id);

  IF NOT app.can_write_appointment(v_row.workspace_id, v_row.professional_member_id) THEN
    RAISE EXCEPTION 'appointment_write_denied' USING ERRCODE = '42501';
  END IF;

  PERFORM app.assert_status_transition(v_row.status, p_status, v_actor.role);

  UPDATE public.appointments
  SET status = p_status
  WHERE id = v_row.id
    AND workspace_id = v_row.workspace_id;

  RETURN v_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION app.protect_working_hours_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;
  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.professional_member_id IS DISTINCT FROM OLD.professional_member_id THEN
    RAISE EXCEPTION 'working_hours_identity_immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.protect_break_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.label := nullif(btrim(COALESCE(NEW.label, '')), '');
    RETURN NEW;
  END IF;
  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.professional_member_id IS DISTINCT FROM OLD.professional_member_id THEN
    RAISE EXCEPTION 'break_identity_immutable' USING ERRCODE = '42501';
  END IF;
  NEW.label := nullif(btrim(COALESCE(NEW.label, '')), '');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.protect_time_block_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.reason := nullif(btrim(COALESCE(NEW.reason, '')), '');
    PERFORM app.lock_professional_agenda(NEW.professional_member_id);
    RETURN NEW;
  END IF;
  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.professional_member_id IS DISTINCT FROM OLD.professional_member_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'time_block_identity_immutable' USING ERRCODE = '42501';
  END IF;
  NEW.reason := nullif(btrim(COALESCE(NEW.reason, '')), '');
  PERFORM app.lock_professional_agenda(NEW.professional_member_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.protect_appointment_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.notes := nullif(btrim(COALESCE(NEW.notes, '')), '');
    RETURN NEW;
  END IF;
  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'appointment_identity_immutable' USING ERRCODE = '42501';
  END IF;
  IF current_setting('app.allow_appointment_snapshot', true) IS DISTINCT FROM 'on' THEN
    IF NEW.price_cents IS DISTINCT FROM OLD.price_cents
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes THEN
      RAISE EXCEPTION 'appointment_snapshot_immutable' USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.notes := nullif(btrim(COALESCE(NEW.notes, '')), '');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.appointments_assert_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at
     AND NEW.ends_at IS NOT DISTINCT FROM OLD.ends_at
     AND NEW.professional_member_id IS NOT DISTINCT FROM OLD.professional_member_id
     AND NEW.service_id IS NOT DISTINCT FROM OLD.service_id THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN (
    'scheduled'::public.appointment_status,
    'confirmed'::public.appointment_status,
    'in_progress'::public.appointment_status
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM app.lock_professional_agenda(NEW.professional_member_id);
  PERFORM app.assert_slot_available(
    NEW.workspace_id,
    NEW.professional_member_id,
    NEW.starts_at,
    NEW.ends_at,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.time_blocks_reject_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.lock_professional_agenda(NEW.professional_member_id);
  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.workspace_id = NEW.workspace_id
      AND a.professional_member_id = NEW.professional_member_id
      AND a.status IN (
        'scheduled'::public.appointment_status,
        'confirmed'::public.appointment_status,
        'in_progress'::public.appointment_status,
        'completed'::public.appointment_status
      )
      AND tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'inside_time_block' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER professional_working_hours_set_updated_at
  BEFORE UPDATE ON public.professional_working_hours
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER professional_working_hours_protect_columns
  BEFORE UPDATE ON public.professional_working_hours
  FOR EACH ROW EXECUTE FUNCTION app.protect_working_hours_columns();

CREATE TRIGGER professional_breaks_set_updated_at
  BEFORE UPDATE ON public.professional_breaks
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER professional_breaks_protect_columns
  BEFORE INSERT OR UPDATE ON public.professional_breaks
  FOR EACH ROW EXECUTE FUNCTION app.protect_break_columns();

CREATE TRIGGER professional_time_blocks_set_updated_at
  BEFORE UPDATE ON public.professional_time_blocks
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER professional_time_blocks_protect_columns
  BEFORE INSERT OR UPDATE ON public.professional_time_blocks
  FOR EACH ROW EXECUTE FUNCTION app.protect_time_block_columns();

CREATE TRIGGER professional_time_blocks_reject_appointment_overlap
  BEFORE INSERT OR UPDATE OF starts_at, ends_at, professional_member_id ON public.professional_time_blocks
  FOR EACH ROW EXECUTE FUNCTION app.time_blocks_reject_appointment_overlap();

CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER appointments_protect_columns
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION app.protect_appointment_columns();

CREATE TRIGGER appointments_assert_availability
  BEFORE INSERT OR UPDATE OF starts_at, ends_at, professional_member_id, service_id, status
  ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION app.appointments_assert_availability();
