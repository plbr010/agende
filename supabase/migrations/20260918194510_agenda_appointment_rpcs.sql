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

