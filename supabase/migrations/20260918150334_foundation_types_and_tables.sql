-- Agendê foundation: schemas, enums, tables, indexes, constraints.
-- The `app` schema holds SECURITY DEFINER helpers and is NOT exposed via the Data API.

CREATE SCHEMA IF NOT EXISTS app;

REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO postgres, service_role, authenticated;

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE public.signup_intent AS ENUM ('client', 'professional');
CREATE TYPE public.member_role AS ENUM ('owner', 'admin', 'professional', 'receptionist');
CREATE TYPE public.member_status AS ENUM ('invited', 'active', 'inactive', 'removed');
CREATE TYPE public.subscription_plan AS ENUM ('solo', 'equipe', 'salao');
CREATE TYPE public.subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'expired',
  'canceled'
);

CREATE TABLE public.plans (
  code public.subscription_plan PRIMARY KEY,
  name text NOT NULL,
  monthly_price_cents integer NOT NULL CHECK (monthly_price_cents >= 0),
  max_professionals integer NOT NULL CHECK (max_professionals >= 1),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plans IS
  'Catalog of Agendê plans. Seat limits must be enforced in the database, never only in the UI.';

INSERT INTO public.plans (code, name, monthly_price_cents, max_professionals, description)
VALUES
  ('solo', 'Plano Solo', 8990, 1, 'Até 1 profissional'),
  ('equipe', 'Plano Equipe', 16990, 5, 'Até 5 profissionais'),
  ('salao', 'Plano Salão', 29990, 15, 'Até 15 profissionais');

CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 120),
  email text NOT NULL,
  phone text,
  intended_use public.signup_intent NOT NULL,
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_email_lowercase CHECK (email = lower(email)),
  CONSTRAINT profiles_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT profiles_phone_e164 CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$')
);

CREATE UNIQUE INDEX profiles_email_key ON public.profiles (email);
CREATE INDEX profiles_phone_idx ON public.profiles (phone);

COMMENT ON TABLE public.profiles IS
  '1:1 with auth.users. Identity profile. intended_use is signup routing, not authorization.';
COMMENT ON COLUMN public.profiles.email IS
  'Denormalized copy of auth.users.email, always lowercase. Source of truth is auth.users. Synced by trigger app.sync_profile_from_auth. Users cannot update this column.';
COMMENT ON COLUMN public.profiles.intended_use IS
  'Initial product intent collected at signup. A user may later be client and professional at the same time via client_profiles + workspace_members.';

CREATE TABLE public.client_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_profiles IS
  'Capability flag: this user can use the client area. Not exclusive with professional memberships.';

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspaces_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT workspaces_slug_length CHECK (char_length(slug) BETWEEN 3 AND 60),
  CONSTRAINT workspaces_slug_reserved CHECK (
    slug NOT IN (
      'app', 'api', 'auth', 'login', 'cadastro', 'cliente', 'onboarding',
      'admin', 'www', 'static', 'assets', 'termos', 'privacidade',
      'verificar-email', 'agende', 'suporte', 'billing', 'faturamento'
    )
  )
);

CREATE UNIQUE INDEX workspaces_slug_key ON public.workspaces (slug);
CREATE INDEX workspaces_owner_user_id_idx ON public.workspaces (owner_user_id);

COMMENT ON TABLE public.workspaces IS
  'Tenant/business. Subscriptions belong to the workspace, not to the user.';

CREATE TABLE public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  role public.member_role NOT NULL,
  status public.member_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_members_unique UNIQUE (workspace_id, user_id)
);

CREATE INDEX workspace_members_user_id_idx ON public.workspace_members (user_id);
CREATE INDEX workspace_members_workspace_id_idx ON public.workspace_members (workspace_id);
CREATE INDEX workspace_members_active_idx
  ON public.workspace_members (workspace_id, user_id)
  WHERE status = 'active';

COMMENT ON TABLE public.workspace_members IS
  'Membership of a user in a workspace. Duplicate memberships are forbidden.';

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL REFERENCES public.plans (code),
  status public.subscription_status NOT NULL,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_workspace_unique UNIQUE (workspace_id),
  CONSTRAINT subscriptions_trial_window CHECK (
    trial_ends_at IS NULL
    OR (trial_started_at IS NOT NULL AND trial_ends_at > trial_started_at)
  ),
  CONSTRAINT subscriptions_trialing_requires_dates CHECK (
    status <> 'trialing'
    OR (trial_started_at IS NOT NULL AND trial_ends_at IS NOT NULL)
  ),
  CONSTRAINT subscriptions_canceled_requires_timestamp CHECK (
    status <> 'canceled' OR canceled_at IS NOT NULL
  )
);

CREATE INDEX subscriptions_status_idx ON public.subscriptions (status);
CREATE INDEX subscriptions_trial_ends_at_idx ON public.subscriptions (trial_ends_at);

COMMENT ON TABLE public.subscriptions IS
  'Billing state for a workspace. Mutated only by SECURITY DEFINER functions. No payment gateway in this stage.';

CREATE TABLE public.professional_trial_claims (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (user_id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE RESTRICT,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX professional_trial_claims_workspace_id_idx
  ON public.professional_trial_claims (workspace_id);

COMMENT ON TABLE public.professional_trial_claims IS
  'One professional trial per auth user. Survives workspace deletion attempts via RESTRICT + no user DELETE grants.';

CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  email text,
  role public.member_role NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles (user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_invites_role_not_owner CHECK (role <> 'owner'),
  CONSTRAINT workspace_invites_token_hash_unique UNIQUE (token_hash),
  CONSTRAINT workspace_invites_email_lowercase CHECK (email IS NULL OR email = lower(email))
);

CREATE INDEX workspace_invites_workspace_id_idx ON public.workspace_invites (workspace_id);
CREATE INDEX workspace_invites_email_idx ON public.workspace_invites (email);

COMMENT ON TABLE public.workspace_invites IS
  'Team invites. Stores only SHA-256 of the secret token. Never accept invites that carry only workspace_id.';
COMMENT ON COLUMN public.workspace_invites.token_hash IS
  'hex(sha256(raw_token)). The raw token is returned once at creation and never stored.';
