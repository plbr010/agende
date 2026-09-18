-- Agendê foundation: helper functions (part 1).
-- SECURITY DEFINER functions live in `app` with a fixed empty search_path.

CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION app.require_authenticated_user()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION app.require_confirmed_email()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_confirmed timestamptz;
BEGIN
  v_uid := app.require_authenticated_user();
  SELECT u.email_confirmed_at
    INTO v_confirmed
  FROM auth.users u
  WHERE u.id = v_uid;

  IF v_confirmed IS NULL THEN
    RAISE EXCEPTION 'email_not_confirmed'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION app.normalize_phone(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  digits text;
BEGIN
  digits := regexp_replace(coalesce(input, ''), '\D', '', 'g');
  IF digits = '' THEN
    RETURN NULL;
  END IF;
  IF left(digits, 2) = '55' AND length(digits) BETWEEN 12 AND 13 THEN
    RETURN '+' || digits;
  END IF;
  IF length(digits) BETWEEN 10 AND 11 THEN
    RETURN '+55' || digits;
  END IF;
  IF length(digits) BETWEEN 8 AND 15 THEN
    RETURN '+' || digits;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app.slugify(input text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT trim(both '-' FROM
    regexp_replace(
      regexp_replace(
        lower(extensions.unaccent(coalesce(input, ''))),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$$;

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
     OR v_slug IN (
      'app', 'api', 'auth', 'login', 'cadastro', 'cliente', 'onboarding',
      'admin', 'www', 'static', 'assets', 'termos', 'privacidade',
      'verificar-email', 'agende', 'suporte', 'billing', 'faturamento'
     )
  LOOP
    v_slug := v_base || '-' || v_suffix::text;
    v_suffix := v_suffix + 1;
  END LOOP;

  RETURN v_slug;
END;
$$;

CREATE OR REPLACE FUNCTION app.is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members m
    WHERE m.workspace_id = p_workspace_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION app.has_workspace_role(p_workspace_id uuid, VARIADIC p_roles public.member_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members m
    WHERE m.workspace_id = p_workspace_id
      AND m.user_id = (SELECT auth.uid())
      AND m.status = 'active'
      AND m.role = ANY (p_roles)
  );
$$;

CREATE OR REPLACE FUNCTION app.owns_workspace(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspaces w
    WHERE w.id = p_workspace_id
      AND w.owner_user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION app.workspace_professional_seats(p_workspace_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT count(*)::integer
  FROM public.workspace_members m
  WHERE m.workspace_id = p_workspace_id
    AND m.status = 'active'
    AND m.role IN ('owner', 'admin', 'professional');
$$;
