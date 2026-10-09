-- Forward reconciliation of membership guards observed read-only on 2026-10-09.
-- NOT a reconstruction or repair of 20260919201138. Requires explicit production approval.
-- Refuses unknown definitions; the already-observed remote state is left unchanged.
-- No tables are dropped/recreated and no rows or migration-history entries are changed.

DO $guard$
DECLARE
  v_oid oid := to_regprocedure('app.lock_workspace_membership(uuid)');
  v_expected text := $observed$CREATE OR REPLACE FUNCTION app.lock_workspace_membership(p_workspace_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'workspace_required' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace_id::text, 881001));
  PERFORM 1 FROM public.workspaces w WHERE w.id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$function$
$observed$;
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog,public',true);
  IF v_oid IS NOT NULL AND replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    RAISE EXCEPTION 'unexpected_definition: app.lock_workspace_membership(uuid)';
  END IF;
  IF v_oid IS NULL OR replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    EXECUTE v_expected;
  END IF;
END;
$guard$;
REVOKE ALL ON FUNCTION app.lock_workspace_membership(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.lock_workspace_membership(uuid) TO service_role;

DO $guard$
DECLARE
  v_oid oid := to_regprocedure('app.assert_member_change_allowed(uuid,public.workspace_members,public.member_role,public.member_status)');
  v_expected text := $observed$CREATE OR REPLACE FUNCTION app.assert_member_change_allowed(p_workspace_id uuid, p_member workspace_members, p_next_role member_role, p_next_status member_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM app.lock_workspace_membership(p_workspace_id);
  IF p_member.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_next_role = 'owner'::public.member_role AND p_member.role IS DISTINCT FROM 'owner'::public.member_role THEN
    RAISE EXCEPTION 'owner_transfer_not_supported' USING ERRCODE = '42501';
  END IF;
  IF p_member.role = 'owner'::public.member_role
     AND p_member.status = 'active'::public.member_status
     AND (
       p_next_role IS DISTINCT FROM 'owner'::public.member_role
       OR p_next_status IS DISTINCT FROM 'active'::public.member_status
     )
     AND app.active_owner_count(p_workspace_id) <= 1 THEN
    RAISE EXCEPTION 'last_owner_protected' USING ERRCODE = 'P0001';
  END IF;
END;
$function$
$observed$;
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog,public',true);
  IF v_oid IS NOT NULL AND replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    IF replace(pg_get_functiondef(v_oid),chr(13),'') <> $baseline$CREATE OR REPLACE FUNCTION app.assert_member_change_allowed(p_workspace_id uuid, p_member workspace_members, p_next_role member_role, p_next_status member_status)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF p_member.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_next_role = 'owner'::public.member_role AND p_member.role IS DISTINCT FROM 'owner'::public.member_role THEN
    RAISE EXCEPTION 'owner_transfer_not_supported' USING ERRCODE = '42501';
  END IF;

  IF p_member.role = 'owner'::public.member_role
     AND p_member.status = 'active'::public.member_status
     AND (
       p_next_role IS DISTINCT FROM 'owner'::public.member_role
       OR p_next_status IS DISTINCT FROM 'active'::public.member_status
     )
     AND app.active_owner_count(p_workspace_id) <= 1 THEN
    RAISE EXCEPTION 'last_owner_protected' USING ERRCODE = 'P0001';
  END IF;
END;
$function$
$baseline$ THEN
      RAISE EXCEPTION 'unexpected_definition: app.assert_member_change_allowed(uuid,public.workspace_members,public.member_role,public.member_status)';
    END IF;
  END IF;
  IF v_oid IS NULL OR replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    EXECUTE v_expected;
  END IF;
END;
$guard$;

DO $guard$
DECLARE
  v_oid oid := to_regprocedure('app.update_workspace_member_role(uuid,uuid,public.member_role)');
  v_expected text := $observed$CREATE OR REPLACE FUNCTION app.update_workspace_member_role(p_workspace_id uuid, p_member_id uuid, p_role member_role)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_member public.workspace_members;
  v_needs_seat boolean;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  PERFORM app.lock_workspace_membership(p_workspace_id);
  IF p_role IS NULL OR p_role = 'owner'::public.member_role THEN
    RAISE EXCEPTION 'owner_transfer_not_supported' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_member FROM public.workspace_members m WHERE m.id = p_member_id FOR UPDATE;
  IF v_member.id IS NULL OR v_member.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM app.assert_member_change_allowed(p_workspace_id, v_member, p_role, v_member.status);
  v_needs_seat := p_role IN ('admin'::public.member_role, 'professional'::public.member_role)
    AND v_member.status = 'active'::public.member_status
    AND v_member.role = 'receptionist'::public.member_role;
  IF v_needs_seat THEN
    PERFORM app.assert_professional_seat_available(p_workspace_id);
  END IF;
  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.workspace_members SET role = p_role, updated_at = clock_timestamp() WHERE id = v_member.id;
  RETURN jsonb_build_object('member_id', v_member.id, 'role', p_role);
END;
$function$
$observed$;
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog,public',true);
  IF v_oid IS NOT NULL AND replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    IF replace(pg_get_functiondef(v_oid),chr(13),'') <> $baseline$CREATE OR REPLACE FUNCTION app.update_workspace_member_role(p_workspace_id uuid, p_member_id uuid, p_role member_role)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_member public.workspace_members;
  v_needs_seat boolean;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);

  IF p_role IS NULL OR p_role = 'owner'::public.member_role THEN
    RAISE EXCEPTION 'owner_transfer_not_supported' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_member
  FROM public.workspace_members m
  WHERE m.id = p_member_id
  FOR UPDATE;

  IF v_member.id IS NULL OR v_member.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM app.assert_member_change_allowed(p_workspace_id, v_member, p_role, v_member.status);

  v_needs_seat := p_role IN ('admin'::public.member_role, 'professional'::public.member_role)
    AND v_member.status = 'active'::public.member_status
    AND v_member.role = 'receptionist'::public.member_role;

  IF v_needs_seat THEN
    PERFORM app.assert_professional_seat_available(p_workspace_id);
  END IF;

  PERFORM set_config('app.bypass_protected_columns', 'on', true);

  UPDATE public.workspace_members
  SET role = p_role,
      updated_at = clock_timestamp()
  WHERE id = v_member.id;

  RETURN jsonb_build_object('member_id', v_member.id, 'role', p_role);
END;
$function$
$baseline$ THEN
      RAISE EXCEPTION 'unexpected_definition: app.update_workspace_member_role(uuid,uuid,public.member_role)';
    END IF;
  END IF;
  IF v_oid IS NULL OR replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    EXECUTE v_expected;
  END IF;
END;
$guard$;

DO $guard$
DECLARE
  v_oid oid := to_regprocedure('app.deactivate_workspace_member(uuid,uuid)');
  v_expected text := $observed$CREATE OR REPLACE FUNCTION app.deactivate_workspace_member(p_workspace_id uuid, p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_member public.workspace_members;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  PERFORM app.lock_workspace_membership(p_workspace_id);
  SELECT * INTO v_member FROM public.workspace_members m WHERE m.id = p_member_id FOR UPDATE;
  IF v_member.id IS NULL OR v_member.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM app.assert_member_change_allowed(
    p_workspace_id, v_member, v_member.role, 'inactive'::public.member_status
  );
  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.workspace_members SET status = 'inactive', updated_at = clock_timestamp() WHERE id = v_member.id;
  RETURN jsonb_build_object('member_id', v_member.id, 'status', 'inactive');
END;
$function$
$observed$;
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog,public',true);
  IF v_oid IS NOT NULL AND replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    IF replace(pg_get_functiondef(v_oid),chr(13),'') <> $baseline$CREATE OR REPLACE FUNCTION app.deactivate_workspace_member(p_workspace_id uuid, p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_member public.workspace_members;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);

  SELECT * INTO v_member
  FROM public.workspace_members m
  WHERE m.id = p_member_id
  FOR UPDATE;

  IF v_member.id IS NULL OR v_member.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM app.assert_member_change_allowed(
    p_workspace_id, v_member, v_member.role, 'inactive'::public.member_status
  );

  PERFORM set_config('app.bypass_protected_columns', 'on', true);

  UPDATE public.workspace_members
  SET status = 'inactive',
      updated_at = clock_timestamp()
  WHERE id = v_member.id;

  RETURN jsonb_build_object('member_id', v_member.id, 'status', 'inactive');
END;
$function$
$baseline$ THEN
      RAISE EXCEPTION 'unexpected_definition: app.deactivate_workspace_member(uuid,uuid)';
    END IF;
  END IF;
  IF v_oid IS NULL OR replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    EXECUTE v_expected;
  END IF;
END;
$guard$;

DO $guard$
DECLARE
  v_oid oid := to_regprocedure('app.reactivate_workspace_member(uuid,uuid)');
  v_expected text := $observed$CREATE OR REPLACE FUNCTION app.reactivate_workspace_member(p_workspace_id uuid, p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_member public.workspace_members;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  PERFORM app.lock_workspace_membership(p_workspace_id);
  SELECT * INTO v_member FROM public.workspace_members m WHERE m.id = p_member_id FOR UPDATE;
  IF v_member.id IS NULL OR v_member.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_member.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
     AND v_member.status IS DISTINCT FROM 'active'::public.member_status THEN
    PERFORM app.assert_professional_seat_available(p_workspace_id);
  END IF;
  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.workspace_members SET status = 'active', updated_at = clock_timestamp() WHERE id = v_member.id;
  RETURN jsonb_build_object('member_id', v_member.id, 'status', 'active');
END;
$function$
$observed$;
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog,public',true);
  IF v_oid IS NOT NULL AND replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    IF replace(pg_get_functiondef(v_oid),chr(13),'') <> $baseline$CREATE OR REPLACE FUNCTION app.reactivate_workspace_member(p_workspace_id uuid, p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_member public.workspace_members;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);

  SELECT * INTO v_member
  FROM public.workspace_members m
  WHERE m.id = p_member_id
  FOR UPDATE;

  IF v_member.id IS NULL OR v_member.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_member.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
     AND v_member.status IS DISTINCT FROM 'active'::public.member_status THEN
    PERFORM app.assert_professional_seat_available(p_workspace_id);
  END IF;

  PERFORM set_config('app.bypass_protected_columns', 'on', true);

  UPDATE public.workspace_members
  SET status = 'active',
      updated_at = clock_timestamp()
  WHERE id = v_member.id;

  RETURN jsonb_build_object('member_id', v_member.id, 'status', 'active');
END;
$function$
$baseline$ THEN
      RAISE EXCEPTION 'unexpected_definition: app.reactivate_workspace_member(uuid,uuid)';
    END IF;
  END IF;
  IF v_oid IS NULL OR replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    EXECUTE v_expected;
  END IF;
END;
$guard$;

DO $guard$
DECLARE
  v_oid oid := to_regprocedure('app.remove_workspace_member(uuid,uuid)');
  v_expected text := $observed$CREATE OR REPLACE FUNCTION app.remove_workspace_member(p_workspace_id uuid, p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_member public.workspace_members;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);
  PERFORM app.lock_workspace_membership(p_workspace_id);
  SELECT * INTO v_member FROM public.workspace_members m WHERE m.id = p_member_id FOR UPDATE;
  IF v_member.id IS NULL OR v_member.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM app.assert_member_change_allowed(
    p_workspace_id, v_member, v_member.role, 'removed'::public.member_status
  );
  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.workspace_members SET status = 'removed', updated_at = clock_timestamp() WHERE id = v_member.id;
  RETURN jsonb_build_object('member_id', v_member.id, 'status', 'removed');
END;
$function$
$observed$;
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog,public',true);
  IF v_oid IS NOT NULL AND replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    IF replace(pg_get_functiondef(v_oid),chr(13),'') <> $baseline$CREATE OR REPLACE FUNCTION app.remove_workspace_member(p_workspace_id uuid, p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_member public.workspace_members;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);

  SELECT * INTO v_member
  FROM public.workspace_members m
  WHERE m.id = p_member_id
  FOR UPDATE;

  IF v_member.id IS NULL OR v_member.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM app.assert_member_change_allowed(
    p_workspace_id, v_member, v_member.role, 'removed'::public.member_status
  );

  PERFORM set_config('app.bypass_protected_columns', 'on', true);

  UPDATE public.workspace_members
  SET status = 'removed',
      updated_at = clock_timestamp()
  WHERE id = v_member.id;

  RETURN jsonb_build_object('member_id', v_member.id, 'status', 'removed');
END;
$function$
$baseline$ THEN
      RAISE EXCEPTION 'unexpected_definition: app.remove_workspace_member(uuid,uuid)';
    END IF;
  END IF;
  IF v_oid IS NULL OR replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    EXECUTE v_expected;
  END IF;
END;
$guard$;

DO $guard$
DECLARE
  v_oid oid := to_regprocedure('app.enforce_active_owner()');
  v_expected text := $observed$CREATE OR REPLACE FUNCTION app.enforce_active_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_workspace_id uuid;
BEGIN
  v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);
  PERFORM app.lock_workspace_membership(v_workspace_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = v_workspace_id
      AND m.status = 'active'
      AND m.role = 'owner'::public.member_role
  ) THEN
    RAISE EXCEPTION 'last_owner_protected' USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$
$observed$;
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog,public',true);
  IF v_oid IS NOT NULL AND replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    RAISE EXCEPTION 'unexpected_definition: app.enforce_active_owner()';
  END IF;
  IF v_oid IS NULL OR replace(pg_get_functiondef(v_oid),chr(13),'') <> v_expected THEN
    EXECUTE v_expected;
  END IF;
END;
$guard$;
REVOKE ALL ON FUNCTION app.enforce_active_owner() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.enforce_active_owner() TO service_role;

DO $guard$
DECLARE v_definition text;
BEGIN
  PERFORM pg_catalog.set_config('search_path','pg_catalog,public',true);
  SELECT pg_get_triggerdef(oid) INTO v_definition FROM pg_trigger
  WHERE tgrelid='public.workspace_members'::regclass AND tgname='workspace_members_keep_owner';
  IF v_definition IS NULL THEN
    EXECUTE 'CREATE CONSTRAINT TRIGGER workspace_members_keep_owner AFTER INSERT OR UPDATE OF role, status ON public.workspace_members DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION app.enforce_active_owner()';
  ELSIF v_definition <> 'CREATE CONSTRAINT TRIGGER workspace_members_keep_owner AFTER INSERT OR UPDATE OF role, status ON public.workspace_members DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION app.enforce_active_owner()' THEN
    RAISE EXCEPTION 'unexpected_definition: workspace_members_keep_owner';
  END IF;
END;
$guard$;

