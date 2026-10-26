-- Local fix. Do not apply to production or shared staging from this change.
-- After trial and complimentary entitlement both end, the older appointments
-- entitlement trigger rejected every update, including cancellation.
-- Cancellation of an existing open appointment stays allowed. Inserts, deletes,
-- reschedules, completions, no-shows and any other column change stay blocked.
-- This does not write booking exceptions, complimentary grants, subscriptions or Stripe.

CREATE OR REPLACE FUNCTION app.appointment_update_is_cancellation(
  p_old public.appointments,
  p_new public.appointments
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT p_new.status = 'cancelled'::public.appointment_status
    AND p_old.status IN (
      'scheduled'::public.appointment_status,
      'confirmed'::public.appointment_status,
      'in_progress'::public.appointment_status,
      'cancelled'::public.appointment_status
    )
    AND (to_jsonb(p_old) - 'status' - 'updated_at')
      = (to_jsonb(p_new) - 'status' - 'updated_at');
$$;

COMMENT ON FUNCTION app.appointment_update_is_cancellation(public.appointments, public.appointments) IS
  'True only when an open or already cancelled appointment changes nothing except status to cancelled. updated_at may move. Completed and no_show rows are not cancellations.';

REVOKE ALL ON FUNCTION app.appointment_update_is_cancellation(public.appointments, public.appointments)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app.enforce_appointment_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.bypass_entitlement', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'UPDATE' AND app.appointment_update_is_cancellation(OLD, NEW) THEN
    RETURN NEW;
  END IF;

  PERFORM app.assert_workspace_entitled(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.workspace_id ELSE NEW.workspace_id END
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

COMMENT ON FUNCTION app.enforce_appointment_entitlement() IS
  'Same entitlement gate as the other product tables, except a pure cancellation of an existing appointment. app.bypass_entitlement still does not open the booking-creation gate.';

REVOKE ALL ON FUNCTION app.enforce_appointment_entitlement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS appointments_entitlement_gate ON public.appointments;
CREATE TRIGGER appointments_entitlement_gate
  BEFORE INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION app.enforce_appointment_entitlement();

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

  -- Cancellation is the only mutation that remains after entitlement ends.
  -- Membership and the existing write rules still apply. Other statuses keep
  -- the entitlement check inside app.actor_member.
  IF p_status = 'cancelled'::public.appointment_status
     AND v_row.status IN (
       'scheduled'::public.appointment_status,
       'confirmed'::public.appointment_status,
       'in_progress'::public.appointment_status,
       'cancelled'::public.appointment_status
     ) THEN
    SELECT m.* INTO v_actor
    FROM public.workspace_members m
    WHERE m.workspace_id = v_row.workspace_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'::public.member_status;

    IF v_actor.id IS NULL THEN
      RAISE EXCEPTION 'not_workspace_member' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_actor := app.actor_member(v_row.workspace_id);
  END IF;

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

CREATE OR REPLACE FUNCTION public.set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workspace uuid;
  v_status public.appointment_status;
BEGIN
  SELECT workspace_id, status INTO v_workspace, v_status
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_workspace IS NOT NULL AND p_status IS DISTINCT FROM v_status THEN
    IF p_status = 'cancelled'::public.appointment_status
       AND v_status IN (
         'scheduled'::public.appointment_status,
         'confirmed'::public.appointment_status,
         'in_progress'::public.appointment_status
       ) THEN
      PERFORM app.require_confirmed_email();
      IF NOT app.member_has_permission(v_workspace, 'appointments.cancel') THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
      END IF;
    ELSIF p_status IN (
      'cancelled'::public.appointment_status,
      'no_show'::public.appointment_status
    ) THEN
      PERFORM app.assert_member_permission(v_workspace, 'appointments.cancel');
    ELSE
      PERFORM app.assert_member_permission(v_workspace, 'appointments.edit');
    END IF;
  END IF;

  RETURN app.set_appointment_status(p_appointment_id, p_status);
END;
$$;

COMMENT ON FUNCTION public.set_appointment_status(uuid, public.appointment_status) IS
  'Staff status change. Cancelling an open appointment does not require a live entitlement. Creating, rescheduling, completing and no-show still do.';

CREATE OR REPLACE FUNCTION public.create_appointment(
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
BEGIN
  PERFORM app.require_confirmed_email();
  IF NOT EXISTS (
    SELECT 1
    FROM public.workspace_members m
    WHERE m.workspace_id = p_workspace_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'::public.member_status
  ) THEN
    RAISE EXCEPTION 'not_workspace_member' USING ERRCODE = '42501';
  END IF;
  PERFORM app.assert_member_permission(p_workspace_id, 'appointments.create');
  RETURN app.create_appointment(
    p_workspace_id,
    p_client_id,
    p_professional_member_id,
    p_service_id,
    p_starts_at,
    p_notes
  );
END;
$$;

COMMENT ON FUNCTION public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, text) IS
  'Creates an appointment for an active member. Someone from another salon gets not_workspace_member before any entitlement or booking detail is checked.';
