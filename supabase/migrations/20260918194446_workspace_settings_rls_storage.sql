-- RLS, public wrappers, grants, and logo storage for workspace settings.
--
-- Public vs private:
-- Anon cannot SELECT workspaces, workspace_settings, members, subscriptions,
-- invites, clients or profiles. The public establishment page is served only by
-- public.get_public_workspace_profile(slug), a SECURITY DEFINER RPC that returns
-- name, description, city, state, instagram, logo_path, active services and
-- bookable professionals. No emails, phones, member roles, client notes,
-- subscription fields or internal IDs. Invite preview uses peek_workspace_invite
-- (status + workspace name + role + email_bound boolean — never the bound email
-- or raw token). Mutations go through authenticated DEFINER RPCs with
-- owner/admin checks and last-owner protection.

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.workspace_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.workspace_settings TO authenticated;

CREATE POLICY workspace_settings_select_member
  ON public.workspace_settings
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)));

REVOKE UPDATE (name, slug) ON public.workspaces FROM authenticated;
GRANT UPDATE (name) ON public.workspaces TO authenticated;

CREATE OR REPLACE FUNCTION public.update_workspace_settings(
  p_workspace_id uuid,
  p_name text,
  p_slug text,
  p_business_phone text DEFAULT NULL,
  p_business_email text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_instagram text DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_logo_path text DEFAULT NULL,
  p_clear_logo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.update_workspace_settings(
    p_workspace_id, p_name, p_slug, p_business_phone, p_business_email,
    p_description, p_address, p_city, p_state, p_postal_code, p_instagram,
    p_timezone, p_logo_path, p_clear_logo
  );
$$;

CREATE OR REPLACE FUNCTION public.deactivate_workspace_member(p_workspace_id uuid, p_member_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.deactivate_workspace_member(p_workspace_id, p_member_id);
$$;

CREATE OR REPLACE FUNCTION public.reactivate_workspace_member(p_workspace_id uuid, p_member_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.reactivate_workspace_member(p_workspace_id, p_member_id);
$$;

CREATE OR REPLACE FUNCTION public.remove_workspace_member(p_workspace_id uuid, p_member_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.remove_workspace_member(p_workspace_id, p_member_id);
$$;

CREATE OR REPLACE FUNCTION public.update_workspace_member_role(
  p_workspace_id uuid,
  p_member_id uuid,
  p_role public.member_role
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.update_workspace_member_role(p_workspace_id, p_member_id, p_role);
$$;

CREATE OR REPLACE FUNCTION public.revoke_workspace_invite(p_workspace_id uuid, p_invite_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.revoke_workspace_invite(p_workspace_id, p_invite_id);
$$;

CREATE OR REPLACE FUNCTION public.peek_workspace_invite(p_token text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.peek_workspace_invite(p_token);
$$;

CREATE OR REPLACE FUNCTION public.get_public_workspace_profile(p_slug text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.get_public_workspace_profile(p_slug);
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_seat_usage(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app.get_workspace_seat_usage(p_workspace_id);
$$;

REVOKE ALL ON FUNCTION public.update_workspace_settings(uuid, text, text, text, text, text, text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.deactivate_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reactivate_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_workspace_member_role(uuid, uuid, public.member_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_workspace_invite(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.peek_workspace_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_workspace_profile(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_workspace_seat_usage(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_workspace_settings(uuid, text, text, text, text, text, text, text, text, text, text, text, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.deactivate_workspace_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reactivate_workspace_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_workspace_member_role(uuid, uuid, public.member_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_workspace_invite(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.peek_workspace_invite(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_workspace_profile(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_seat_usage(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION app.update_workspace_settings(uuid, text, text, text, text, text, text, text, text, text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.deactivate_workspace_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.reactivate_workspace_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.remove_workspace_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.update_workspace_member_role(uuid, uuid, public.member_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.revoke_workspace_invite(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.peek_workspace_invite(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.get_public_workspace_profile(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.get_workspace_seat_usage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.require_workspace_manager(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.active_owner_count(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.assert_member_change_allowed(uuid, public.workspace_members, public.member_role, public.member_status) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.is_reserved_workspace_slug(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app.provision_workspace_settings() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION app.is_reserved_workspace_slug(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app.is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app.has_workspace_role(uuid, public.member_role[]) TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-logos',
  'workspace-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS workspace_logos_select ON storage.objects;
DROP POLICY IF EXISTS workspace_logos_insert ON storage.objects;
DROP POLICY IF EXISTS workspace_logos_update ON storage.objects;
DROP POLICY IF EXISTS workspace_logos_delete ON storage.objects;

CREATE POLICY workspace_logos_select
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'workspace-logos');

CREATE POLICY workspace_logos_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'workspace-logos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (SELECT app.has_workspace_role(
      ((storage.foldername(name))[1])::uuid,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
  );

CREATE POLICY workspace_logos_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'workspace-logos'
    AND (SELECT app.has_workspace_role(
      ((storage.foldername(name))[1])::uuid,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
  )
  WITH CHECK (
    bucket_id = 'workspace-logos'
    AND (SELECT app.has_workspace_role(
      ((storage.foldername(name))[1])::uuid,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
  );

CREATE POLICY workspace_logos_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'workspace-logos'
    AND (SELECT app.has_workspace_role(
      ((storage.foldername(name))[1])::uuid,
      VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
    ))
  );
