-- Workspace settings 1:1, reserved slugs, and auto-provision.

CREATE TABLE public.workspace_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces (id) ON DELETE CASCADE,
  business_phone text,
  business_email text,
  description text,
  address text,
  city text,
  state text,
  postal_code text,
  instagram text,
  logo_path text,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_settings_phone_format CHECK (
    business_phone IS NULL
    OR (
      business_phone ~ '^\+55[0-9]+$'
      AND app.is_valid_br_national(substr(business_phone, 4))
    )
  ),
  CONSTRAINT workspace_settings_email_format CHECK (
    business_email IS NULL OR business_email = lower(business_email)
  ),
  CONSTRAINT workspace_settings_description_len CHECK (
    description IS NULL OR char_length(description) <= 1000
  ),
  CONSTRAINT workspace_settings_address_len CHECK (
    address IS NULL OR char_length(address) <= 160
  ),
  CONSTRAINT workspace_settings_city_len CHECK (
    city IS NULL OR char_length(btrim(city)) BETWEEN 2 AND 80
  ),
  CONSTRAINT workspace_settings_state_format CHECK (
    state IS NULL OR state ~ '^[A-Z]{2}$'
  ),
  CONSTRAINT workspace_settings_postal_code CHECK (
    postal_code IS NULL OR postal_code ~ '^[0-9]{8}$'
  ),
  CONSTRAINT workspace_settings_instagram_len CHECK (
    instagram IS NULL OR char_length(instagram) BETWEEN 1 AND 30
  ),
  CONSTRAINT workspace_settings_timezone_allowed CHECK (
    timezone IN (
      'America/Sao_Paulo',
      'America/Fortaleza',
      'America/Recife',
      'America/Bahia',
      'America/Belem',
      'America/Manaus',
      'America/Cuiaba',
      'America/Porto_Velho',
      'America/Boa_Vista',
      'America/Rio_Branco',
      'America/Noronha'
    )
  )
);

COMMENT ON TABLE public.workspace_settings IS
  'Public-facing and operational settings for a workspace. 1:1 with workspaces. Mutations go through SECURITY DEFINER RPCs.';

CREATE OR REPLACE FUNCTION app.is_reserved_workspace_slug(p_slug text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_slug IN (
    'app', 'api', 'auth', 'login', 'cadastro', 'cliente', 'onboarding',
    'admin', 'www', 'static', 'assets', 'termos', 'privacidade',
    'verificar-email', 'agende', 'suporte', 'billing', 'faturamento',
    'p', 'convite', 'configuracoes', 'equipe', 'servicos', 'clientes',
    'assinatura', 'perfil'
  );
$$;

ALTER TABLE public.workspaces DROP CONSTRAINT workspaces_slug_reserved;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_slug_reserved CHECK (
  NOT app.is_reserved_workspace_slug(slug)
);

CREATE OR REPLACE FUNCTION app.allocate_workspace_slug(p_name text, p_slug text)
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_base text;
  v_slug text;
  v_suffix integer := 2;
BEGIN
  IF p_slug IS NOT NULL AND length(trim(p_slug)) > 0 THEN
    v_base := app.slugify(p_slug);
  ELSE
    v_base := app.slugify(p_name);
  END IF;

  IF v_base IS NULL OR char_length(v_base) < 3 THEN
    v_base := 'negocio-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  END IF;

  IF char_length(v_base) > 50 THEN
    v_base := substr(v_base, 1, 50);
    v_base := trim(both '-' FROM v_base);
  END IF;

  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.workspaces w WHERE w.slug = v_slug)
     OR app.is_reserved_workspace_slug(v_slug)
  LOOP
    v_slug := v_base || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  END LOOP;

  RETURN v_slug;
END;
$$;

CREATE OR REPLACE FUNCTION app.provision_workspace_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.workspace_settings (workspace_id)
  VALUES (NEW.id)
  ON CONFLICT (workspace_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER workspaces_provision_settings
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION app.provision_workspace_settings();

INSERT INTO public.workspace_settings (workspace_id)
SELECT w.id
FROM public.workspaces w
ON CONFLICT (workspace_id) DO NOTHING;

CREATE TRIGGER workspace_settings_set_updated_at
  BEFORE UPDATE ON public.workspace_settings
  FOR EACH ROW
  EXECUTE FUNCTION app.set_updated_at();
