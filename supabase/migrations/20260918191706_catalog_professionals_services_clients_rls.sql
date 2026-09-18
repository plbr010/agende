-- Catalog RLS, triggers, grants and professional profile backfill.
-- Does not rewrite previously applied migrations.

CREATE POLICY profiles_select_workspace_colleague
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members me
      JOIN public.workspace_members them
        ON them.workspace_id = me.workspace_id
      WHERE me.user_id = (SELECT auth.uid())
        AND me.status = 'active'
        AND them.user_id = profiles.user_id
    )
  );

CREATE OR REPLACE FUNCTION app.sync_professional_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text;
  v_qualifies boolean;
  v_was_qualified boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  v_qualifies := NEW.status = 'active'
    AND NEW.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role);

  IF TG_OP = 'UPDATE' THEN
    v_was_qualified := OLD.status = 'active'
      AND OLD.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role);
  END IF;

  IF v_qualifies THEN
    SELECT p.full_name INTO v_name
    FROM public.profiles p
    WHERE p.user_id = NEW.user_id;

    INSERT INTO public.professional_profiles (member_id, workspace_id, display_name, booking_enabled)
    VALUES (
      NEW.id,
      NEW.workspace_id,
      COALESCE(nullif(btrim(v_name), ''), 'Profissional'),
      true
    )
    ON CONFLICT (member_id) DO NOTHING;

    IF TG_OP = 'UPDATE' AND NOT v_was_qualified THEN
      UPDATE public.professional_profiles
      SET booking_enabled = true,
          updated_at = now()
      WHERE member_id = NEW.id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND v_was_qualified THEN
    UPDATE public.professional_profiles
    SET booking_enabled = false,
        updated_at = now()
    WHERE member_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER workspace_members_sync_professional_profile
  AFTER INSERT OR UPDATE OF role, status ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION app.sync_professional_profile();

CREATE OR REPLACE FUNCTION app.protect_professional_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.member_id IS DISTINCT FROM OLD.member_id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    RAISE EXCEPTION 'professional_profile_identity_immutable' USING ERRCODE = '42501';
  END IF;

  IF NEW.booking_enabled IS DISTINCT FROM OLD.booking_enabled THEN
    IF NOT app.has_workspace_role(
      NEW.workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ) THEN
      RAISE EXCEPTION 'booking_enabled_denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.display_name := btrim(NEW.display_name);
  NEW.bio := nullif(btrim(COALESCE(NEW.bio, '')), '');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.protect_service_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.name := btrim(NEW.name);
    NEW.description := nullif(btrim(COALESCE(NEW.description, '')), '');
    IF NEW.archived_at IS NOT NULL THEN
      NEW.active := false;
    END IF;
    RETURN NEW;
  END IF;

  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'service_identity_immutable' USING ERRCODE = '42501';
  END IF;

  NEW.name := btrim(NEW.name);
  NEW.description := nullif(btrim(COALESCE(NEW.description, '')), '');
  IF NEW.archived_at IS NOT NULL THEN
    NEW.active := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.protect_professional_service_columns()
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

  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.professional_member_id IS DISTINCT FROM OLD.professional_member_id
     OR NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'professional_service_identity_immutable' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.protect_workspace_client_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.full_name := btrim(NEW.full_name);
    NEW.email := nullif(lower(btrim(COALESCE(NEW.email, ''))), '');
    NEW.notes := nullif(btrim(COALESCE(NEW.notes, '')), '');
    NEW.linked_user_id := NULL;

    IF NEW.phone IS NOT NULL AND btrim(NEW.phone) <> '' THEN
      v_phone := app.normalize_phone(NEW.phone);
      IF v_phone IS NULL THEN
        RAISE EXCEPTION 'invalid_phone' USING ERRCODE = '22023';
      END IF;
      NEW.phone := v_phone;
    ELSE
      NEW.phone := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF current_setting('app.bypass_protected_columns', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'client_identity_immutable' USING ERRCODE = '42501';
  END IF;

  IF NEW.linked_user_id IS DISTINCT FROM OLD.linked_user_id THEN
    RAISE EXCEPTION 'linked_user_id_immutable' USING ERRCODE = '42501';
  END IF;

  NEW.full_name := btrim(NEW.full_name);
  NEW.email := nullif(lower(btrim(COALESCE(NEW.email, ''))), '');
  NEW.notes := nullif(btrim(COALESCE(NEW.notes, '')), '');

  IF NEW.phone IS NOT NULL AND btrim(NEW.phone) <> '' THEN
    v_phone := app.normalize_phone(NEW.phone);
    IF v_phone IS NULL THEN
      RAISE EXCEPTION 'invalid_phone' USING ERRCODE = '22023';
    END IF;
    NEW.phone := v_phone;
  ELSE
    NEW.phone := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER professional_profiles_set_updated_at
  BEFORE UPDATE ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER professional_profiles_protect_columns
  BEFORE UPDATE ON public.professional_profiles
  FOR EACH ROW EXECUTE FUNCTION app.protect_professional_profile_columns();

CREATE TRIGGER services_set_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER services_protect_columns
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION app.protect_service_columns();

CREATE TRIGGER professional_services_set_updated_at
  BEFORE UPDATE ON public.professional_services
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER professional_services_protect_columns
  BEFORE UPDATE ON public.professional_services
  FOR EACH ROW EXECUTE FUNCTION app.protect_professional_service_columns();

CREATE TRIGGER workspace_clients_set_updated_at
  BEFORE UPDATE ON public.workspace_clients
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER workspace_clients_protect_columns
  BEFORE INSERT OR UPDATE ON public.workspace_clients
  FOR EACH ROW EXECUTE FUNCTION app.protect_workspace_client_columns();

INSERT INTO public.professional_profiles (member_id, workspace_id, display_name, booking_enabled)
SELECT
  m.id,
  m.workspace_id,
  COALESCE(nullif(btrim(p.full_name), ''), 'Profissional'),
  true
FROM public.workspace_members m
JOIN public.profiles p ON p.user_id = m.user_id
WHERE m.status = 'active'
  AND m.role IN ('owner', 'admin', 'professional')
ON CONFLICT (member_id) DO NOTHING;

ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_clients ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.professional_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.services FORCE ROW LEVEL SECURITY;
ALTER TABLE public.professional_services FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_clients FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.professional_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.services FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.professional_services FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.workspace_clients FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.professional_profiles TO authenticated;
GRANT UPDATE (display_name, bio, booking_enabled) ON public.professional_profiles TO authenticated;

GRANT SELECT ON public.services TO authenticated;
GRANT INSERT (workspace_id, name, description, duration_minutes, price_cents, active) ON public.services TO authenticated;
GRANT UPDATE (name, description, duration_minutes, price_cents, active, archived_at) ON public.services TO authenticated;

GRANT SELECT ON public.professional_services TO authenticated;
GRANT INSERT (
  workspace_id, professional_member_id, service_id,
  price_override_cents, duration_override_minutes, active
) ON public.professional_services TO authenticated;
GRANT UPDATE (price_override_cents, duration_override_minutes, active) ON public.professional_services TO authenticated;

GRANT SELECT ON public.workspace_clients TO authenticated;
GRANT INSERT (workspace_id, full_name, email, phone, birth_date, notes) ON public.workspace_clients TO authenticated;
GRANT UPDATE (full_name, email, phone, birth_date, notes, archived_at) ON public.workspace_clients TO authenticated;

CREATE POLICY professional_profiles_select_member
  ON public.professional_profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)));

CREATE POLICY professional_profiles_update_owner_admin
  ON public.professional_profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
  )
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
  );

CREATE POLICY professional_profiles_update_own
  ON public.professional_profiles
  FOR UPDATE
  TO authenticated
  USING (
    member_id IN (
      SELECT m.id
      FROM public.workspace_members m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
    )
  )
  WITH CHECK (
    member_id IN (
      SELECT m.id
      FROM public.workspace_members m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
    )
  );

CREATE POLICY services_select_member
  ON public.services
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)));

CREATE POLICY services_insert_owner_admin
  ON public.services
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
  );

CREATE POLICY services_update_owner_admin
  ON public.services
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
  )
  WITH CHECK (
    (SELECT app.has_workspace_role(
      workspace_id,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
  );

CREATE POLICY professional_services_select_member
  ON public.professional_services
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)));

CREATE POLICY professional_services_insert_manager_or_own
  ON public.professional_services
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT app.is_workspace_member(workspace_id))
    AND (
      (SELECT app.has_workspace_role(
        workspace_id,
        VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
      ))
      OR professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_services.workspace_id
          AND m.status = 'active'
          AND m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
      )
    )
  );

CREATE POLICY professional_services_update_manager_or_own
  ON public.professional_services
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT app.is_workspace_member(workspace_id))
    AND (
      (SELECT app.has_workspace_role(
        workspace_id,
        VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
      ))
      OR professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_services.workspace_id
          AND m.status = 'active'
          AND m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
      )
    )
  )
  WITH CHECK (
    (SELECT app.is_workspace_member(workspace_id))
    AND (
      (SELECT app.has_workspace_role(
        workspace_id,
        VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
      ))
      OR professional_member_id IN (
        SELECT m.id
        FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = professional_services.workspace_id
          AND m.status = 'active'
          AND m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
      )
    )
  );

CREATE POLICY workspace_clients_select_member
  ON public.workspace_clients
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)));

CREATE POLICY workspace_clients_insert_member
  ON public.workspace_clients
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT app.is_workspace_member(workspace_id)));

CREATE POLICY workspace_clients_update_member
  ON public.workspace_clients
  FOR UPDATE
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)))
  WITH CHECK ((SELECT app.is_workspace_member(workspace_id)));

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO postgres, service_role;
REVOKE ALL ON FUNCTION app.sync_professional_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_professional_profile_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_service_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_professional_service_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_workspace_client_columns() FROM PUBLIC, anon, authenticated;
