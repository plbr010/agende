-- Local proposal only. Requires separate authorization before remote application.
-- Keep the existing administrative model, grants, RLS, benefits and entitlements.
CREATE OR REPLACE FUNCTION app.is_platform_admin(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM app.platform_admins a JOIN auth.users u ON u.id = a.user_id
    WHERE a.user_id = p_user_id AND a.revoked_at IS NULL
      AND u.email_confirmed_at IS NOT NULL
      AND lower(u.email) = app.official_platform_admin_email()
  );
$$;

CREATE OR REPLACE FUNCTION app.require_platform_admin()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := app.require_confirmed_email();
BEGIN
  IF NOT app.is_platform_admin(v_uid) THEN
    RAISE EXCEPTION 'not_platform_admin' USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END;
$$;

-- No self-grant and no resurrection of a revoked grant. Existing valid access
-- remains idempotent; only the pre-existing operator grant API can grant access.
CREATE OR REPLACE FUNCTION public.claim_official_platform_admin()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := app.require_confirmed_email();
BEGIN
  IF NOT app.auth_user_is_official_platform_owner(v_uid) THEN
    RAISE EXCEPTION 'not_official_platform_admin' USING ERRCODE = '42501';
  END IF;
  IF NOT app.is_platform_admin(v_uid) THEN
    RAISE EXCEPTION 'platform_admin_operator_approval_required' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object('user_id', v_uid, 'granted', true);
END;
$$;

-- The existing grant-time trigger must allow revocation of an identity that
-- has just become invalid; it continues to forbid every invalid active grant.
CREATE OR REPLACE FUNCTION app.enforce_official_platform_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.revoked_at IS NULL AND NOT app.auth_user_is_official_platform_owner(NEW.user_id) THEN
    RAISE EXCEPTION 'not_official_platform_admin' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION app.revoke_invalid_platform_admin_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_changed integer;
BEGIN
  IF NEW.email_confirmed_at IS NULL OR NEW.email IS NULL
     OR lower(NEW.email) <> app.official_platform_admin_email() THEN
    UPDATE app.platform_admins SET revoked_at = now()
    WHERE user_id = NEW.id AND revoked_at IS NULL;
    GET DIAGNOSTICS v_changed = ROW_COUNT;
    IF v_changed > 0 THEN
      PERFORM app.admin_write_audit(NEW.id, 'admin.identity_invalidated', 'user', NEW.id::text,
        jsonb_build_object('reason', 'identity_no_longer_authorized'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app.revoke_invalid_platform_admin_identity() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER revoke_invalid_platform_admin_identity
AFTER UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION app.revoke_invalid_platform_admin_identity();

-- CREATE OR REPLACE retains existing function ACLs. No new role is granted,
-- no existing grant row is touched by this migration, and no policy is changed.
