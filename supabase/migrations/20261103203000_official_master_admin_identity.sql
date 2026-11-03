-- Bind MASTER ADMIN to the existing authenticated identity of plbrpc@gmail.com.
-- Authorization is stored against auth.users.id. The function never trusts an
-- email posted by the browser. No password change and no extra auth user.

CREATE OR REPLACE FUNCTION app.official_platform_admin_email()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 'plbrpc@gmail.com'::text;
$$;

CREATE OR REPLACE FUNCTION app.auth_user_is_official_platform_owner(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_user_id
      AND u.email_confirmed_at IS NOT NULL
      AND lower(u.email) = app.official_platform_admin_email()
  );
$$;

CREATE OR REPLACE FUNCTION app.enforce_official_platform_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app.auth_user_is_official_platform_owner(NEW.user_id) THEN
    RAISE EXCEPTION 'not_official_platform_admin' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS platform_admins_official_owner ON app.platform_admins;
CREATE TRIGGER platform_admins_official_owner
BEFORE INSERT OR UPDATE OF user_id, revoked_at ON app.platform_admins
FOR EACH ROW EXECUTE FUNCTION app.enforce_official_platform_admin();

CREATE OR REPLACE FUNCTION public.is_official_platform_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.auth_user_is_official_platform_owner(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.claim_official_platform_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := app.require_confirmed_email();
BEGIN
  IF NOT app.auth_user_is_official_platform_owner(v_uid) THEN
    RAISE EXCEPTION 'not_official_platform_admin' USING ERRCODE = '42501';
  END IF;

  INSERT INTO app.platform_admins (user_id, granted_by, revoked_at)
  VALUES (v_uid, v_uid, NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET granted_by = EXCLUDED.granted_by,
        revoked_at = NULL,
        created_at = CASE
          WHEN platform_admins.revoked_at IS NULL THEN platform_admins.created_at
          ELSE now()
        END;

  PERFORM app.admin_write_audit(
    v_uid,
    'admin.grant',
    'user',
    v_uid::text,
    jsonb_build_object('source', 'claim', 'official', true)
  );

  RETURN jsonb_build_object('user_id', v_uid, 'granted', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_platform_admin(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF v_role <> 'service_role' THEN
    RAISE EXCEPTION 'not_official_platform_admin' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_admin_grant' USING ERRCODE = '22023';
  END IF;

  IF NOT app.auth_user_is_official_platform_owner(p_user_id) THEN
    RAISE EXCEPTION 'not_official_platform_admin' USING ERRCODE = '42501';
  END IF;

  INSERT INTO app.platform_admins (user_id, granted_by, revoked_at)
  VALUES (p_user_id, p_user_id, NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET granted_by = EXCLUDED.granted_by,
        revoked_at = NULL,
        created_at = CASE
          WHEN platform_admins.revoked_at IS NULL THEN platform_admins.created_at
          ELSE now()
        END;

  PERFORM app.admin_write_audit(
    p_user_id,
    'admin.grant',
    'user',
    p_user_id::text,
    jsonb_build_object('source', 'service_role', 'official', true)
  );

  RETURN jsonb_build_object('user_id', p_user_id, 'granted', true);
END;
$$;

INSERT INTO app.platform_admins (user_id, granted_by, revoked_at)
SELECT u.id, u.id, NULL
FROM auth.users u
WHERE lower(u.email) = app.official_platform_admin_email()
  AND u.email_confirmed_at IS NOT NULL
ORDER BY u.created_at ASC
LIMIT 1
ON CONFLICT (user_id) DO UPDATE
  SET revoked_at = NULL;

INSERT INTO app.platform_audit_events (actor_user_id, action, entity_type, entity_id, metadata)
SELECT
  a.user_id,
  'admin.grant',
  'user',
  a.user_id::text,
  jsonb_build_object('source', 'migration', 'official', true)
FROM app.platform_admins a
WHERE a.revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM app.platform_audit_events e
    WHERE e.action = 'admin.grant'
      AND e.entity_id = a.user_id::text
  );

REVOKE ALL ON FUNCTION public.grant_platform_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_official_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_official_platform_owner() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.grant_platform_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_official_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_official_platform_owner() TO authenticated;
