-- Cancellation is a duty toward an existing customer, even after entitlement ends.
-- Only appointments get this narrow exception; no global bypass/GUC is introduced.
CREATE OR REPLACE FUNCTION app.enforce_appointment_entitlement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelled'::public.appointment_status
       AND OLD.status IN ('scheduled', 'confirmed', 'in_progress')
       AND (to_jsonb(NEW) - ARRAY['status', 'updated_at'])
           IS NOT DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'updated_at']) THEN
      RETURN NEW;
    END IF;
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
REVOKE ALL ON FUNCTION app.enforce_appointment_entitlement() FROM PUBLIC, anon, authenticated;

DROP TRIGGER appointments_entitlement_gate ON public.appointments;
CREATE TRIGGER appointments_entitlement_gate
  BEFORE INSERT OR UPDATE OR DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION app.enforce_appointment_entitlement();

CREATE OR REPLACE FUNCTION app.set_appointment_status(
  p_appointment_id uuid, p_status public.appointment_status
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row public.appointments%ROWTYPE;
  v_actor public.workspace_members;
BEGIN
  PERFORM app.require_confirmed_email();
  SELECT a.* INTO v_row FROM public.appointments a
  WHERE a.id = p_appointment_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = '22023';
  END IF;

  IF p_status = 'cancelled'::public.appointment_status THEN
    SELECT m.* INTO v_actor FROM public.workspace_members m
    WHERE m.workspace_id = v_row.workspace_id AND m.user_id = auth.uid()
      AND m.status = 'active';
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
  -- An authorized repeat is idempotent and does not write/audit again after expiry.
  IF v_row.status IS NOT DISTINCT FROM p_status THEN RETURN v_row.id; END IF;
  UPDATE public.appointments SET status = p_status
  WHERE id = v_row.id AND workspace_id = v_row.workspace_id;
  RETURN v_row.id;
END;
$$;
REVOKE ALL ON FUNCTION app.set_appointment_status(uuid, public.appointment_status) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_appointment_status(
  p_appointment_id uuid, p_status public.appointment_status
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_workspace uuid;
  v_status public.appointment_status;
BEGIN
  SELECT workspace_id, status INTO v_workspace, v_status FROM public.appointments WHERE id = p_appointment_id;
  -- Cancellation checks confirmed identity, active membership, permission and scope
  -- inside the locked internal operation, without requiring a paid entitlement.
  IF v_workspace IS NOT NULL AND p_status IS DISTINCT FROM v_status
     AND p_status IS DISTINCT FROM 'cancelled'::public.appointment_status THEN
    PERFORM app.assert_member_permission(v_workspace,
      CASE WHEN p_status = 'no_show'::public.appointment_status
        THEN 'appointments.cancel' ELSE 'appointments.edit' END);
  END IF;
  RETURN app.set_appointment_status(p_appointment_id, p_status);
END;
$$;
REVOKE ALL ON FUNCTION public.set_appointment_status(uuid, public.appointment_status) FROM PUBLIC, anon;
-- Preserve the existing authenticated/service_role grants. No booking grants change.

-- Same client ownership, lead time and terminal-state rules; lock before checking
-- so a concurrent start/completion cannot be overwritten by a stale cancellation.
CREATE OR REPLACE FUNCTION app.cancel_my_appointment(p_appointment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid;
  v_row public.appointments%ROWTYPE;
BEGIN
  v_uid := app.require_confirmed_email();
  PERFORM app.link_workspace_clients_by_confirmed_email();
  SELECT a.* INTO v_row FROM public.appointments a
  JOIN public.workspace_clients c ON c.id = a.client_id AND c.workspace_id = a.workspace_id
  WHERE a.id = p_appointment_id AND c.linked_user_id = v_uid
  FOR UPDATE OF a;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = '42501';
  END IF;
  IF v_row.status IN ('completed', 'cancelled', 'no_show', 'in_progress') THEN
    RAISE EXCEPTION 'appointment_not_cancellable' USING ERRCODE = '22023';
  END IF;
  IF v_row.starts_at < clock_timestamp() + make_interval(mins => app.client_cancel_lead_minutes()) THEN
    RAISE EXCEPTION 'cancel_too_late' USING ERRCODE = '22023';
  END IF;
  UPDATE public.appointments SET status = 'cancelled'::public.appointment_status
  WHERE id = v_row.id AND workspace_id = v_row.workspace_id;
  RETURN jsonb_build_object('id', v_row.id, 'status', 'cancelled');
END;
$$;
REVOKE ALL ON FUNCTION app.cancel_my_appointment(uuid) FROM PUBLIC, anon, authenticated;
