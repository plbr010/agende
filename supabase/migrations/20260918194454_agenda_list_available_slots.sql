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

