-- Reconciles 20261026091115 and 20261026180100 without editing either file.
-- The later of those two replaced the locked cancellation path. A completed
-- appointment then failed with workspace_subscription_inactive instead of
-- appointment_terminal, and a repeat cancel rewrote updated_at.
-- Open appointments (scheduled, confirmed, in_progress) can still be cancelled
-- after trial and courtesy expire when the caller is allowed to cancel them.
-- Inserts, reschedules, completions, no-shows, reopenings and any other column
-- change stay blocked. This does not write exceptions, complimentary grants,
-- subscriptions or Stripe, and it does not replace public.create_appointment:
-- someone from another salon still receives not_workspace_member there, before
-- entitlement is considered. A member who lacks appointments.cancel still
-- receives not_authorized.

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
      'in_progress'::public.appointment_status
    )
    AND (to_jsonb(p_old) - 'status' - 'updated_at')
      = (to_jsonb(p_new) - 'status' - 'updated_at');
$$;

COMMENT ON FUNCTION app.appointment_update_is_cancellation(public.appointments, public.appointments) IS
  'True only when a scheduled, confirmed or in-progress appointment changes nothing except status to cancelled. updated_at may move. Completed, no-show and already cancelled rows are not cancellations.';

REVOKE ALL ON FUNCTION app.appointment_update_is_cancellation(public.appointments, public.appointments)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION app.enforce_appointment_entitlement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND app.appointment_update_is_cancellation(OLD, NEW) THEN
    RETURN NEW;
  END IF;

  IF current_setting('app.bypass_entitlement', true) = 'on' THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  PERFORM app.assert_workspace_entitled(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.workspace_id ELSE NEW.workspace_id END
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

COMMENT ON FUNCTION app.enforce_appointment_entitlement() IS
  'Entitlement gate for appointments. A pure cancellation of an open appointment skips it. app.bypass_entitlement still does not open the booking-creation gate. Completed and no-show rows stay subject to the gate.';

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
  WHERE a.id = p_appointment_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = '22023';
  END IF;

  -- Cancellation does not require a live entitlement. Membership, the cancel
  -- permission and the professional scope are still checked on the locked row,
  -- so a concurrent completion is visible before the status changes.
  -- A missing membership and a denied permission both use not_authorized here.
  -- Cross-salon creation uses not_workspace_member in public.create_appointment.
  IF p_status = 'cancelled'::public.appointment_status THEN
    SELECT m.* INTO v_actor
    FROM public.workspace_members m
    WHERE m.workspace_id = v_row.workspace_id
      AND m.user_id = auth.uid()
      AND m.status = 'active'::public.member_status;

    IF v_actor.id IS NULL OR NOT app.member_has_permission(v_row.workspace_id, 'appointments.cancel') THEN
      RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_actor := app.actor_member(v_row.workspace_id);
  END IF;

  IF NOT app.can_write_appointment(v_row.workspace_id, v_row.professional_member_id) THEN
    RAISE EXCEPTION 'appointment_write_denied' USING ERRCODE = '42501';
  END IF;

  PERFORM app.assert_status_transition(v_row.status, p_status, v_actor.role);

  -- An authorized repeat does not write again, so updated_at stays put after expiry.
  IF v_row.status IS NOT DISTINCT FROM p_status THEN
    RETURN v_row.id;
  END IF;

  UPDATE public.appointments
  SET status = p_status
  WHERE id = v_row.id
    AND workspace_id = v_row.workspace_id;

  RETURN v_row.id;
END;
$$;

REVOKE ALL ON FUNCTION app.set_appointment_status(uuid, public.appointment_status)
  FROM PUBLIC, anon, authenticated;

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

  -- Any change to cancelled is decided inside the locked function: permission
  -- without entitlement, then appointment_terminal for a completed or no-show row.
  IF v_workspace IS NOT NULL
     AND p_status IS DISTINCT FROM v_status
     AND p_status IS DISTINCT FROM 'cancelled'::public.appointment_status THEN
    PERFORM app.assert_member_permission(
      v_workspace,
      CASE
        WHEN p_status = 'no_show'::public.appointment_status THEN 'appointments.cancel'
        ELSE 'appointments.edit'
      END
    );
  END IF;

  RETURN app.set_appointment_status(p_appointment_id, p_status);
END;
$$;

COMMENT ON FUNCTION public.set_appointment_status(uuid, public.appointment_status) IS
  'Staff status change. Cancelling does not require a live entitlement. Completing, confirming, no-show and reopening still do. A completed appointment raises appointment_terminal.';

REVOKE ALL ON FUNCTION public.set_appointment_status(uuid, public.appointment_status)
  FROM PUBLIC, anon;
-- Existing authenticated and service_role grants stay. No booking grant changes.
