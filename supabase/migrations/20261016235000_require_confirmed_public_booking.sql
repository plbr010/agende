-- Additive migration. No production execution authorized.
-- A confirmed Agendê account is required to insert a public appointment.
-- Losing e-mail confirmation mid-request must abort; it must not continue as a guest.

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
  v_uid uuid := app.require_confirmed_email();
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
  SELECT lower(email) INTO v_email FROM auth.users WHERE id=v_uid;
  v_ws := app.resolve_public_workspace(p_slug);
  v_tz := app.workspace_timezone(v_ws);
  v_phone := app.normalize_phone(p_phone);
  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = '22023';
  END IF;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22023';
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT u.email_confirmed_at IS NOT NULL INTO v_confirmed
  FROM auth.users u
  WHERE u.id = v_uid;
  IF NOT COALESCE(v_confirmed, false) THEN
    RAISE EXCEPTION 'email_not_confirmed' USING ERRCODE = '42501';
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
REVOKE ALL ON FUNCTION app.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) TO authenticated;
COMMENT ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) IS 'Authenticated client booking; verified email from Auth. Anonymous and unconfirmed sessions cannot insert. Atomic availability and authoritative pricing.';
