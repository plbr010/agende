CREATE OR REPLACE FUNCTION public.create_workspace(p_name text, p_slug text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT app.create_workspace(p_name, p_slug);
$$;

CREATE OR REPLACE FUNCTION public.create_client_profile()
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT app.create_client_profile();
$$;

CREATE OR REPLACE FUNCTION public.create_workspace_invite(
  p_workspace_id uuid,
  p_role public.member_role,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT app.create_workspace_invite(p_workspace_id, p_role, p_email);
$$;

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT app.accept_workspace_invite(p_token);
$$;

CREATE TRIGGER plans_set_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER profiles_protect_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION app.protect_profile_columns();

CREATE TRIGGER client_profiles_set_updated_at
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER workspaces_set_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER workspaces_protect_columns
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION app.protect_workspace_columns();

CREATE TRIGGER workspace_members_set_updated_at
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER workspace_members_protect_columns
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION app.protect_membership_columns();

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER subscriptions_protect_columns
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION app.protect_subscription_columns();

CREATE TRIGGER professional_trial_claims_protect
  BEFORE UPDATE OR DELETE ON public.professional_trial_claims
  FOR EACH ROW EXECUTE FUNCTION app.protect_trial_claim_columns();

CREATE TRIGGER workspace_invites_set_updated_at
  BEFORE UPDATE ON public.workspace_invites
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app.handle_new_user();

CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app.sync_profile_from_auth();
