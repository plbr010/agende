-- Agendê foundation: RLS, grants, deny-by-default.

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_trial_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.client_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.professional_trial_claims FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites FORCE ROW LEVEL SECURITY;

-- Revoke broad defaults. Explicit grants only.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.plans TO anon, authenticated;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (full_name, phone) ON public.profiles TO authenticated;

GRANT SELECT ON public.client_profiles TO authenticated;

GRANT SELECT ON public.workspaces TO authenticated;
GRANT UPDATE (name, slug) ON public.workspaces TO authenticated;

GRANT SELECT ON public.workspace_members TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.professional_trial_claims TO authenticated;
GRANT SELECT ON public.workspace_invites TO authenticated;

GRANT EXECUTE ON FUNCTION app.current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION app.require_authenticated_user() TO authenticated;
GRANT EXECUTE ON FUNCTION app.require_confirmed_email() TO authenticated;
GRANT EXECUTE ON FUNCTION app.normalize_phone(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION app.slugify(text) TO authenticated;
GRANT EXECUTE ON FUNCTION app.is_workspace_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app.has_workspace_role(uuid, public.member_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION app.owns_workspace(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app.workspace_professional_seats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION app.create_workspace(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION app.create_client_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION app.create_workspace_invite(uuid, public.member_role, text, interval) TO authenticated;
GRANT EXECUTE ON FUNCTION app.accept_workspace_invite(text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_workspace(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace_invite(uuid, public.member_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invite(text) TO authenticated;

-- Policies: deny by default, then allow explicitly.

CREATE POLICY plans_public_read
  ON public.plans
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY client_profiles_select_own
  ON public.client_profiles
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY workspaces_select_member
  ON public.workspaces
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(id)));

CREATE POLICY workspaces_update_owner_admin
  ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING ((SELECT app.has_workspace_role(id, VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role])))
  WITH CHECK ((SELECT app.has_workspace_role(id, VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role])));

CREATE POLICY workspace_members_select_same_workspace
  ON public.workspace_members
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)));

CREATE POLICY subscriptions_select_member
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING ((SELECT app.is_workspace_member(workspace_id)));

CREATE POLICY trial_claims_select_own
  ON public.professional_trial_claims
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY workspace_invites_select_owner_admin
  ON public.workspace_invites
  FOR SELECT
  TO authenticated
  USING ((SELECT app.has_workspace_role(workspace_id, VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role])));

-- No INSERT/UPDATE/DELETE policies for:
--   subscriptions, professional_trial_claims, workspace_members, client_profiles, workspace_invites
-- Mutations go through SECURITY DEFINER RPCs. Missing policies = deny.
