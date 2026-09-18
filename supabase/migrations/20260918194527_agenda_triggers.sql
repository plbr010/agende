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
