-- Proposed only. Do not apply to production or shared staging from this change.
-- Booking creation stays closed for every workspace. An operator may activate one
-- UUID for a dated window. This does not write subscriptions, trial claims, or Stripe.
-- Existing appointments are not deleted when the window ends.

CREATE TABLE app.booking_creation_controls (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  globally_paused boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO app.booking_creation_controls (id, globally_paused)
VALUES (true, true);

COMMENT ON TABLE app.booking_creation_controls IS
  'Single switch. While globally_paused is true, only an unexpired workspace exception may create appointments.';

CREATE TABLE app.booking_workspace_exceptions (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces (id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_workspace_exceptions_window CHECK (expires_at > created_at),
  CONSTRAINT booking_workspace_exceptions_note CHECK (note IS NULL OR char_length(note) <= 200)
);

COMMENT ON TABLE app.booking_workspace_exceptions IS
  'Per-workspace exception to the global booking pause. Empty means every salon stays blocked.';

CREATE TABLE app.complimentary_entitlements (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces (id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  revoked_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT complimentary_entitlements_window CHECK (ends_at > starts_at),
  CONSTRAINT complimentary_entitlements_note CHECK (note IS NULL OR char_length(note) <= 200)
);

COMMENT ON TABLE app.complimentary_entitlements IS
  'Time-boxed free entitlement read by app.workspace_has_entitlement. Does not replace or edit the subscription row.';

ALTER TABLE app.booking_creation_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.booking_creation_controls FORCE ROW LEVEL SECURITY;
ALTER TABLE app.booking_workspace_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.booking_workspace_exceptions FORCE ROW LEVEL SECURITY;
ALTER TABLE app.complimentary_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.complimentary_entitlements FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE app.booking_creation_controls FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE app.booking_workspace_exceptions FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE app.complimentary_entitlements FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app.workspace_has_entitlement(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.workspace_id = p_workspace_id
      AND (
        (
          s.status = 'trialing'::public.subscription_status
          AND s.trial_ends_at IS NOT NULL
          AND s.trial_ends_at > now()
        )
        OR (
          s.status = 'active'::public.subscription_status
          AND (s.current_period_end IS NULL OR s.current_period_end > now())
        )
      )
  )
  OR EXISTS (
    SELECT 1
    FROM app.complimentary_entitlements c
    WHERE c.workspace_id = p_workspace_id
      AND c.revoked_at IS NULL
      AND c.starts_at <= now()
      AND c.ends_at > now()
  );
$$;

COMMENT ON FUNCTION app.workspace_has_entitlement(uuid) IS
  'Trial, paid period, or an unexpired complimentary grant. Complimentary does not change the subscription row.';

CREATE OR REPLACE FUNCTION app.booking_creation_globally_paused()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT c.globally_paused FROM app.booking_creation_controls c WHERE c.id),
    true
  );
$$;

CREATE OR REPLACE FUNCTION app.workspace_booking_exception_active(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM app.booking_workspace_exceptions e
    WHERE e.workspace_id = p_workspace_id
      AND e.enabled
      AND e.revoked_at IS NULL
      AND e.expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION app.workspace_may_create_appointment(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.workspace_has_entitlement(p_workspace_id)
    AND (
      NOT app.booking_creation_globally_paused()
      OR app.workspace_booking_exception_active(p_workspace_id)
    );
$$;

CREATE OR REPLACE FUNCTION app.assert_booking_creation_allowed(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app.workspace_has_entitlement(p_workspace_id) THEN
    RAISE EXCEPTION 'workspace_subscription_inactive' USING ERRCODE = '42501';
  END IF;

  IF app.booking_creation_globally_paused()
     AND NOT app.workspace_booking_exception_active(p_workspace_id) THEN
    RAISE EXCEPTION 'booking_creation_paused' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.enforce_booking_creation_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- app.bypass_entitlement skips the subscription trigger only. It does not open bookings.
  IF TG_OP = 'INSERT' THEN
    PERFORM app.assert_booking_creation_allowed(NEW.workspace_id);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       NEW.starts_at IS DISTINCT FROM OLD.starts_at
       OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
       OR NEW.professional_member_id IS DISTINCT FROM OLD.professional_member_id
       OR NEW.service_id IS DISTINCT FROM OLD.service_id
       OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     ) THEN
    PERFORM app.assert_booking_creation_allowed(NEW.workspace_id);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION app.enforce_booking_creation_gate() IS
  'Blocks new appointments and schedule moves. Status changes and existing rows stay. Ignores app.bypass_entitlement.';

DROP TRIGGER IF EXISTS appointments_booking_creation_gate ON public.appointments;
CREATE TRIGGER appointments_booking_creation_gate
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION app.enforce_booking_creation_gate();

DROP POLICY IF EXISTS appointments_no_direct_insert ON public.appointments;
CREATE POLICY appointments_no_direct_insert
  ON public.appointments
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

COMMENT ON POLICY appointments_no_direct_insert ON public.appointments IS
  'API roles cannot insert appointments directly, including an activated salon. Creation stays on the RPCs, which the trigger still gates.';

CREATE OR REPLACE FUNCTION app.assert_booking_operator()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'booking_activation_denied' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.sync_booking_creation_privileges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  REVOKE ALL ON FUNCTION public.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text, text, text) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, text) FROM PUBLIC, anon;
  REVOKE INSERT ON TABLE public.appointments FROM PUBLIC, anon, authenticated;

  IF NOT app.booking_creation_globally_paused()
     OR EXISTS (
       SELECT 1
       FROM app.booking_workspace_exceptions e
       WHERE e.enabled
         AND e.revoked_at IS NULL
         AND e.expires_at > now()
     ) THEN
    GRANT EXECUTE ON FUNCTION public.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text, text, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, text) TO authenticated;
  ELSE
    REVOKE ALL ON FUNCTION public.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text, text, text) FROM authenticated;
    REVOKE ALL ON FUNCTION public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, text) FROM authenticated;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.activate_workspace_booking(
  p_workspace_id uuid,
  p_expires_at timestamptz,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_note text := nullif(btrim(COALESCE(p_note, '')), '');
BEGIN
  PERFORM app.assert_booking_operator();

  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'workspace_not_found' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'pilot_expiry_required' USING ERRCODE = '22023';
  END IF;
  IF p_expires_at > now() + interval '90 days' THEN
    RAISE EXCEPTION 'pilot_expiry_too_far' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 200 THEN
    RAISE EXCEPTION 'pilot_note_too_long' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace_not_found' USING ERRCODE = '22023';
  END IF;

  INSERT INTO app.booking_workspace_exceptions (
    workspace_id, enabled, expires_at, revoked_at, note
  ) VALUES (
    p_workspace_id, true, p_expires_at, NULL, v_note
  )
  ON CONFLICT (workspace_id) DO UPDATE
  SET enabled = true,
      expires_at = EXCLUDED.expires_at,
      revoked_at = NULL,
      note = EXCLUDED.note,
      updated_at = now();

  INSERT INTO app.complimentary_entitlements (
    workspace_id, starts_at, ends_at, revoked_at, note
  ) VALUES (
    p_workspace_id, now(), p_expires_at, NULL, v_note
  )
  ON CONFLICT (workspace_id) DO UPDATE
  SET ends_at = EXCLUDED.ends_at,
      revoked_at = NULL,
      note = EXCLUDED.note,
      updated_at = now();

  PERFORM app.sync_booking_creation_privileges();
END;
$$;

COMMENT ON FUNCTION app.activate_workspace_booking(uuid, timestamptz, text) IS
  'Operator-only. Opens booking for one workspace until expires_at and grants a complimentary entitlement for the same instant. Maximum window is 90 days. Does not edit subscriptions.';

CREATE OR REPLACE FUNCTION app.deactivate_workspace_booking(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_found boolean := false;
BEGIN
  PERFORM app.assert_booking_operator();

  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'workspace_not_found' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace_not_found' USING ERRCODE = '22023';
  END IF;

  UPDATE app.booking_workspace_exceptions
  SET enabled = false,
      revoked_at = now(),
      updated_at = now()
  WHERE workspace_id = p_workspace_id
  RETURNING true INTO v_found;

  IF NOT COALESCE(v_found, false) THEN
    RAISE EXCEPTION 'booking_exception_missing' USING ERRCODE = '22023';
  END IF;

  UPDATE app.complimentary_entitlements
  SET revoked_at = now(),
      updated_at = now()
  WHERE workspace_id = p_workspace_id
    AND revoked_at IS NULL;

  PERFORM app.sync_booking_creation_privileges();
END;
$$;

COMMENT ON FUNCTION app.deactivate_workspace_booking(uuid) IS
  'Operator-only. Closes new bookings for one workspace and revokes its complimentary entitlement. Does not delete appointments or edit the subscription.';

CREATE OR REPLACE FUNCTION app.suspend_booking_creation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.assert_booking_operator();

  UPDATE app.booking_creation_controls
  SET globally_paused = true,
      updated_at = now()
  WHERE id;

  REVOKE ALL ON FUNCTION public.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
  REVOKE INSERT ON TABLE public.appointments FROM PUBLIC, anon, authenticated;
END;
$$;

COMMENT ON FUNCTION app.suspend_booking_creation() IS
  'Emergency brake. Pauses creation and revokes authenticated execute immediately, even if an exception row still exists. Call activate_workspace_booking again to reopen that UUID.';

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
  PERFORM app.assert_booking_creation_allowed(p_workspace_id);

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
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;
  v_ws := app.resolve_public_workspace(p_slug);
  PERFORM app.assert_booking_creation_allowed(v_ws);
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
  PERFORM app.assert_booking_creation_allowed(p_workspace_id);
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
  PERFORM app.assert_booking_creation_allowed(v_ws);
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

REVOKE ALL ON FUNCTION app.booking_creation_globally_paused() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.workspace_booking_exception_active(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.workspace_may_create_appointment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.assert_booking_creation_allowed(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.enforce_booking_creation_gate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.assert_booking_operator() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.sync_booking_creation_privileges() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION app.activate_workspace_booking(uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.deactivate_workspace_booking(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.suspend_booking_creation() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION app.activate_workspace_booking(uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION app.deactivate_workspace_booking(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION app.suspend_booking_creation() TO service_role;

REVOKE ALL ON FUNCTION app.create_public_appointment(text, uuid, uuid, timestamptz, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.create_appointment(uuid, uuid, uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;

SELECT app.suspend_booking_creation();
