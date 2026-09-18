-- Public booking engine: workspace timezone, guest clients, public slots and create.
-- Replaces list_available_slots / assert_slot_available timezone source without editing old files.

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
    NEW.customer_note := nullif(btrim(COALESCE(NEW.customer_note, '')), '');
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
  NEW.customer_note := nullif(btrim(COALESCE(NEW.customer_note, '')), '');
  RETURN NEW;
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
  v_tz text := app.workspace_timezone(p_workspace_id);
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

CREATE OR REPLACE FUNCTION app.compute_available_slots(
  p_workspace_id uuid,
  p_professional_member_id uuid,
  p_service_id uuid,
  p_local_date date
)
RETURNS TABLE (starts_at timestamptz)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_tz text := app.workspace_timezone(p_workspace_id);
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
BEGIN
  PERFORM app.actor_member(p_workspace_id);
  RETURN QUERY
  SELECT s.starts_at
  FROM app.compute_available_slots(
    p_workspace_id,
    p_professional_member_id,
    p_service_id,
    p_local_date
  ) s;
END;
$$;

CREATE OR REPLACE FUNCTION app.resolve_public_workspace(p_slug text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_slug text := lower(btrim(COALESCE(p_slug, '')));
BEGIN
  IF v_slug = '' THEN
    RAISE EXCEPTION 'workspace_not_found' USING ERRCODE = '22023';
  END IF;
  SELECT w.id INTO v_id
  FROM public.workspaces w
  WHERE w.slug = v_slug;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'workspace_not_found' USING ERRCODE = '22023';
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.assert_public_booking_window(
  p_workspace_id uuid,
  p_starts_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_tz text := app.workspace_timezone(p_workspace_id);
  v_local_date date;
  v_today date;
BEGIN
  v_local_date := (p_starts_at AT TIME ZONE v_tz)::date;
  v_today := (clock_timestamp() AT TIME ZONE v_tz)::date;

  IF v_local_date < v_today THEN
    RAISE EXCEPTION 'slot_in_past' USING ERRCODE = '22023';
  END IF;
  IF v_local_date > v_today + app.booking_horizon_days() THEN
    RAISE EXCEPTION 'slot_too_far' USING ERRCODE = '22023';
  END IF;
  IF p_starts_at < clock_timestamp() + make_interval(mins => app.booking_min_lead_minutes()) THEN
    RAISE EXCEPTION 'slot_too_soon' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.assert_public_booking_rate(
  p_workspace_id uuid,
  p_email text,
  p_phone text,
  p_ip_hash text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_hour integer;
  v_day integer;
BEGIN
  SELECT count(*)::int INTO v_hour
  FROM public.public_booking_rate_events e
  WHERE e.workspace_id = p_workspace_id
    AND e.created_at > clock_timestamp() - interval '1 hour';
  IF v_hour >= app.public_booking_max_workspace_per_hour() THEN
    RAISE EXCEPTION 'booking_rate_limited' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::int INTO v_day
  FROM public.public_booking_rate_events e
  WHERE e.workspace_id = p_workspace_id
    AND e.created_at > clock_timestamp() - interval '24 hours';
  IF v_day >= app.public_booking_max_workspace_per_day() THEN
    RAISE EXCEPTION 'booking_rate_limited' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::int INTO v_hour
  FROM public.public_booking_rate_events e
  WHERE e.workspace_id = p_workspace_id
    AND e.created_at > clock_timestamp() - interval '1 hour'
    AND (
      (p_email IS NOT NULL AND e.email = p_email)
      OR (p_phone IS NOT NULL AND e.phone = p_phone)
      OR (p_ip_hash IS NOT NULL AND e.ip_hash = p_ip_hash)
    );
  IF v_hour >= app.public_booking_max_per_hour() THEN
    RAISE EXCEPTION 'booking_rate_limited' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*)::int INTO v_day
  FROM public.public_booking_rate_events e
  WHERE e.workspace_id = p_workspace_id
    AND e.created_at > clock_timestamp() - interval '24 hours'
    AND (
      (p_email IS NOT NULL AND e.email = p_email)
      OR (p_phone IS NOT NULL AND e.phone = p_phone)
      OR (p_ip_hash IS NOT NULL AND e.ip_hash = p_ip_hash)
    );
  IF v_day >= app.public_booking_max_per_day() THEN
    RAISE EXCEPTION 'booking_rate_limited' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.find_or_create_public_client(
  p_workspace_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_name text := btrim(COALESCE(p_full_name, ''));
  v_email text := nullif(lower(btrim(COALESCE(p_email, ''))), '');
  v_phone text;
BEGIN
  IF char_length(v_name) < 2 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'invalid_client_name' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NULL OR v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  v_phone := app.normalize_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = '22023';
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT c.id INTO v_id
    FROM public.workspace_clients c
    WHERE c.workspace_id = p_workspace_id
      AND c.linked_user_id = p_user_id
      AND c.archived_at IS NULL
    ORDER BY c.created_at
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    SELECT c.id INTO v_id
    FROM public.workspace_clients c
    WHERE c.workspace_id = p_workspace_id
      AND c.archived_at IS NULL
      AND c.phone = v_phone
    ORDER BY c.created_at
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    SELECT c.id INTO v_id
    FROM public.workspace_clients c
    WHERE c.workspace_id = p_workspace_id
      AND c.archived_at IS NULL
      AND c.email = v_email
    ORDER BY c.created_at
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.workspace_clients (workspace_id, full_name, email, phone)
    VALUES (p_workspace_id, v_name, v_email, v_phone)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.workspace_clients
    SET full_name = CASE WHEN char_length(btrim(full_name)) < 2 THEN v_name ELSE full_name END,
        email = COALESCE(email, v_email),
        phone = COALESCE(phone, v_phone)
    WHERE id = v_id
      AND workspace_id = p_workspace_id;
  END IF;

  IF p_user_id IS NOT NULL THEN
    PERFORM set_config('app.bypass_protected_columns', 'on', true);
    UPDATE public.workspace_clients
    SET linked_user_id = p_user_id
    WHERE id = v_id
      AND workspace_id = p_workspace_id
      AND linked_user_id IS NULL;
    PERFORM set_config('app.bypass_protected_columns', 'off', true);
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.link_workspace_clients_by_confirmed_email()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_email text;
  v_count integer := 0;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;
  IF NOT COALESCE((auth.jwt() ->> 'email_verified')::boolean, false)
     AND NOT EXISTS (
       SELECT 1 FROM auth.users u
       WHERE u.id = v_uid AND u.email_confirmed_at IS NOT NULL
     ) THEN
    RETURN 0;
  END IF;

  SELECT lower(u.email) INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.workspace_clients c
  SET linked_user_id = v_uid
  WHERE c.linked_user_id IS NULL
    AND c.archived_at IS NULL
    AND c.email = v_email;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION app.create_client_profile()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := app.require_confirmed_email();

  INSERT INTO public.client_profiles (user_id)
  VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM app.link_workspace_clients_by_confirmed_email();
  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION app.pick_professional_for_slot(
  p_workspace_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_professional_member_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_local_date date;
  v_tz text := app.workspace_timezone(p_workspace_id);
BEGIN
  IF p_professional_member_id IS NOT NULL THEN
    PERFORM 1
    FROM app.resolve_service_snapshot(p_workspace_id, p_professional_member_id, p_service_id);
    RETURN p_professional_member_id;
  END IF;

  v_local_date := (p_starts_at AT TIME ZONE v_tz)::date;

  SELECT p.member_id INTO v_id
  FROM public.professional_profiles p
  JOIN public.workspace_members m
    ON m.id = p.member_id
   AND m.workspace_id = p.workspace_id
  JOIN public.professional_services ps
    ON ps.professional_member_id = p.member_id
   AND ps.workspace_id = p.workspace_id
   AND ps.service_id = p_service_id
   AND ps.active
  WHERE p.workspace_id = p_workspace_id
    AND p.booking_enabled
    AND m.status = 'active'
    AND m.role IN (
      'owner'::public.member_role,
      'admin'::public.member_role,
      'professional'::public.member_role
    )
    AND EXISTS (
      SELECT 1
      FROM app.compute_available_slots(p_workspace_id, p.member_id, p_service_id, v_local_date) s
      WHERE s.starts_at = p_starts_at
    )
  ORDER BY p.member_id
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'slot_unavailable' USING ERRCODE = '22023';
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.list_public_booking_catalog(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid;
  v_name text;
  v_slug text;
  v_logo text;
  v_tz text;
BEGIN
  v_ws := app.resolve_public_workspace(p_slug);
  SELECT w.name, w.slug INTO v_name, v_slug FROM public.workspaces w WHERE w.id = v_ws;
  SELECT s.logo_path, s.timezone INTO v_logo, v_tz
  FROM public.workspace_settings s WHERE s.workspace_id = v_ws;
  v_tz := COALESCE(v_tz, app.product_timezone());

  RETURN jsonb_build_object(
    'name', v_name,
    'slug', v_slug,
    'timezone', v_tz,
    'logo_path', v_logo,
    'horizon_days', app.booking_horizon_days(),
    'min_lead_minutes', app.booking_min_lead_minutes(),
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', svc.id,
        'name', svc.name,
        'description', svc.description,
        'duration_minutes', svc.duration_minutes,
        'price_cents', svc.price_cents,
        'min_price_cents', svc.min_price,
        'max_price_cents', svc.max_price
      ) ORDER BY svc.name)
      FROM (
        SELECT
          s.id,
          s.name,
          s.description,
          s.duration_minutes,
          s.price_cents,
          COALESCE(min(COALESCE(ps.price_override_cents, s.price_cents)), s.price_cents) AS min_price,
          COALESCE(max(COALESCE(ps.price_override_cents, s.price_cents)), s.price_cents) AS max_price
        FROM public.services s
        JOIN public.professional_services ps
          ON ps.service_id = s.id AND ps.workspace_id = s.workspace_id AND ps.active
        JOIN public.professional_profiles p
          ON p.member_id = ps.professional_member_id AND p.workspace_id = s.workspace_id AND p.booking_enabled
        JOIN public.workspace_members m
          ON m.id = p.member_id AND m.workspace_id = s.workspace_id AND m.status = 'active'
        WHERE s.workspace_id = v_ws
          AND s.active
          AND s.archived_at IS NULL
        GROUP BY s.id, s.name, s.description, s.duration_minutes, s.price_cents
      ) svc
    ), '[]'::jsonb),
    'professionals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.member_id,
        'display_name', p.display_name,
        'bio', p.bio,
        'service_ids', COALESCE((
          SELECT jsonb_agg(ps.service_id ORDER BY ps.service_id)
          FROM public.professional_services ps
          JOIN public.services s ON s.id = ps.service_id AND s.workspace_id = p.workspace_id
          WHERE ps.professional_member_id = p.member_id
            AND ps.workspace_id = p.workspace_id
            AND ps.active
            AND s.active
            AND s.archived_at IS NULL
        ), '[]'::jsonb),
        'offerings', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'service_id', ps.service_id,
            'price_cents', COALESCE(ps.price_override_cents, s.price_cents),
            'duration_minutes', COALESCE(ps.duration_override_minutes, s.duration_minutes)
          ) ORDER BY s.name)
          FROM public.professional_services ps
          JOIN public.services s ON s.id = ps.service_id AND s.workspace_id = p.workspace_id
          WHERE ps.professional_member_id = p.member_id
            AND ps.workspace_id = p.workspace_id
            AND ps.active
            AND s.active
            AND s.archived_at IS NULL
        ), '[]'::jsonb)
      ) ORDER BY p.display_name)
      FROM public.professional_profiles p
      JOIN public.workspace_members m
        ON m.id = p.member_id AND m.workspace_id = p.workspace_id
      WHERE p.workspace_id = v_ws
        AND p.booking_enabled
        AND m.status = 'active'
        AND m.role IN (
          'owner'::public.member_role,
          'admin'::public.member_role,
          'professional'::public.member_role
        )
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.list_public_available_slots(
  p_slug text,
  p_service_id uuid,
  p_professional_member_id uuid,
  p_local_date date
)
RETURNS TABLE (starts_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid;
  v_tz text;
  v_today date;
  v_lead timestamptz;
BEGIN
  v_ws := app.resolve_public_workspace(p_slug);
  v_tz := app.workspace_timezone(v_ws);
  v_today := (clock_timestamp() AT TIME ZONE v_tz)::date;
  v_lead := clock_timestamp() + make_interval(mins => app.booking_min_lead_minutes());

  IF NOT EXISTS (
    SELECT 1
    FROM public.services s
    WHERE s.id = p_service_id
      AND s.workspace_id = v_ws
      AND s.active
      AND s.archived_at IS NULL
  ) THEN
    RETURN;
  END IF;

  IF p_local_date IS NULL OR p_local_date < v_today THEN
    RETURN;
  END IF;
  IF p_local_date > v_today + app.booking_horizon_days() THEN
    RETURN;
  END IF;

  IF p_professional_member_id IS NOT NULL THEN
    RETURN QUERY
    SELECT s.starts_at
    FROM app.compute_available_slots(v_ws, p_professional_member_id, p_service_id, p_local_date) s
    WHERE s.starts_at >= v_lead;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT s.starts_at
  FROM public.professional_profiles p
  JOIN public.workspace_members m
    ON m.id = p.member_id AND m.workspace_id = p.workspace_id
  JOIN public.professional_services ps
    ON ps.professional_member_id = p.member_id
   AND ps.workspace_id = p.workspace_id
   AND ps.service_id = p_service_id
   AND ps.active
  JOIN LATERAL app.compute_available_slots(v_ws, p.member_id, p_service_id, p_local_date) s ON true
  WHERE p.workspace_id = v_ws
    AND p.booking_enabled
    AND m.status = 'active'
    AND s.starts_at >= v_lead
  ORDER BY 1;
END;
$$;

CREATE OR REPLACE FUNCTION app.create_public_appointment(
  p_slug text,
  p_service_id uuid,
  p_professional_member_id uuid,
  p_starts_at timestamptz,
  p_full_name text,
  p_phone text,
  p_email text,
  p_customer_note text DEFAULT NULL,
  p_ip_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ws uuid;
  v_pro uuid;
  v_client uuid;
  v_snapshot record;
  v_ends timestamptz;
  v_note text;
  v_id uuid;
  v_uid uuid := auth.uid();
  v_email text := nullif(lower(btrim(COALESCE(p_email, ''))), '');
  v_phone text;
  v_confirmed boolean := false;
  v_ws_name text;
  v_slug text;
  v_service_name text;
  v_pro_name text;
  v_phone_biz text;
  v_tz text;
BEGIN
  v_ws := app.resolve_public_workspace(p_slug);
  v_tz := app.workspace_timezone(v_ws);
  v_phone := app.normalize_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  IF v_uid IS NOT NULL THEN
    SELECT u.email_confirmed_at IS NOT NULL INTO v_confirmed
    FROM auth.users u WHERE u.id = v_uid;
    IF NOT COALESCE(v_confirmed, false) THEN
      v_uid := NULL;
    END IF;
  END IF;

  PERFORM app.assert_public_booking_rate(v_ws, v_email, v_phone, nullif(btrim(COALESCE(p_ip_hash, '')), ''));
  PERFORM app.assert_public_booking_window(v_ws, p_starts_at);

  v_pro := app.pick_professional_for_slot(v_ws, p_service_id, p_starts_at, p_professional_member_id);

  SELECT s.price_cents, s.duration_minutes
    INTO v_snapshot
  FROM app.resolve_service_snapshot(v_ws, v_pro, p_service_id) s;

  v_ends := p_starts_at + make_interval(mins => v_snapshot.duration_minutes);
  v_note := nullif(btrim(COALESCE(p_customer_note, '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'customer_note_too_long' USING ERRCODE = '22023';
  END IF;

  v_client := app.find_or_create_public_client(
    v_ws,
    p_full_name,
    v_email,
    v_phone,
    v_uid
  );

  PERFORM app.lock_professional_agenda(v_pro);

  BEGIN
    PERFORM app.assert_slot_available(v_ws, v_pro, p_starts_at, v_ends, NULL);
  EXCEPTION
    WHEN SQLSTATE '23P01' THEN
      RAISE EXCEPTION 'slot_taken' USING ERRCODE = '23P01';
  END;

  BEGIN
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
      customer_note,
      created_by
    ) VALUES (
      v_ws,
      v_client,
      v_pro,
      p_service_id,
      p_starts_at,
      v_ends,
      'scheduled'::public.appointment_status,
      v_snapshot.price_cents,
      v_snapshot.duration_minutes,
      v_note,
      v_uid
    )
    RETURNING id INTO v_id;
  EXCEPTION
    WHEN exclusion_violation OR SQLSTATE '23P01' THEN
      RAISE EXCEPTION 'slot_taken' USING ERRCODE = '23P01';
  END;

  INSERT INTO public.public_booking_rate_events (workspace_id, email, phone, ip_hash)
  VALUES (v_ws, v_email, v_phone, nullif(btrim(COALESCE(p_ip_hash, '')), ''));

  SELECT w.name, w.slug INTO v_ws_name, v_slug FROM public.workspaces w WHERE w.id = v_ws;
  SELECT s.name INTO v_service_name FROM public.services s WHERE s.id = p_service_id;
  SELECT p.display_name INTO v_pro_name FROM public.professional_profiles p WHERE p.member_id = v_pro;
  SELECT st.business_phone INTO v_phone_biz FROM public.workspace_settings st WHERE st.workspace_id = v_ws;

  RETURN jsonb_build_object(
    'appointment_id', v_id,
    'workspace_name', v_ws_name,
    'slug', v_slug,
    'service_name', v_service_name,
    'professional_name', v_pro_name,
    'starts_at', p_starts_at,
    'ends_at', v_ends,
    'duration_minutes', v_snapshot.duration_minutes,
    'price_cents', v_snapshot.price_cents,
    'timezone', v_tz,
    'status', 'scheduled',
    'business_phone', v_phone_biz,
    'guest', v_uid IS NULL
  );
END;
$$;

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

CREATE OR REPLACE FUNCTION app.cancel_my_appointment(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_row public.appointments%ROWTYPE;
BEGIN
  v_uid := app.require_confirmed_email();
  PERFORM app.link_workspace_clients_by_confirmed_email();

  SELECT a.* INTO v_row
  FROM public.appointments a
  JOIN public.workspace_clients c
    ON c.id = a.client_id AND c.workspace_id = a.workspace_id
  WHERE a.id = p_appointment_id
    AND c.linked_user_id = v_uid;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = '42501';
  END IF;

  IF v_row.status IN (
    'completed'::public.appointment_status,
    'cancelled'::public.appointment_status,
    'no_show'::public.appointment_status,
    'in_progress'::public.appointment_status
  ) THEN
    RAISE EXCEPTION 'appointment_not_cancellable' USING ERRCODE = '22023';
  END IF;

  IF v_row.starts_at < clock_timestamp() + make_interval(mins => app.client_cancel_lead_minutes()) THEN
    RAISE EXCEPTION 'cancel_too_late' USING ERRCODE = '22023';
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled'::public.appointment_status
  WHERE id = v_row.id
    AND workspace_id = v_row.workspace_id;

  RETURN jsonb_build_object('id', v_row.id, 'status', 'cancelled');
END;
$$;
