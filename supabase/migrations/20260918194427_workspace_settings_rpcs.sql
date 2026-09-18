-- Workspace settings, slug, member management, invite peek, and public profile RPCs.

CREATE OR REPLACE FUNCTION app.require_workspace_manager(p_workspace_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := app.require_confirmed_email();
  IF NOT app.has_workspace_role(
    p_workspace_id,
    VARIADIC ARRAY['owner'::public.member_role, 'admin'::public.member_role]
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION app.active_owner_count(p_workspace_id uuid)
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
    AND m.role = 'owner'::public.member_role;
$$;

CREATE OR REPLACE FUNCTION app.assert_member_change_allowed(
  p_workspace_id uuid,
  p_member public.workspace_members,
  p_next_role public.member_role,
  p_next_status public.member_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION app.update_workspace_settings(
  p_workspace_id uuid,
  p_name text,
  p_slug text,
  p_business_phone text,
  p_business_email text,
  p_description text,
  p_address text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_instagram text,
  p_timezone text,
  p_logo_path text DEFAULT NULL,
  p_clear_logo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text;
  v_slug text;
  v_phone text;
  v_email text;
  v_instagram text;
  v_postal text;
  v_state text;
  v_workspace public.workspaces;
  v_settings public.workspace_settings;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);

  v_name := btrim(p_name);
  IF char_length(v_name) < 2 OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'invalid_workspace_name' USING ERRCODE = '22023';
  END IF;

  v_slug := app.slugify(p_slug);
  IF v_slug IS NULL OR char_length(v_slug) < 3 OR char_length(v_slug) > 60 THEN
    RAISE EXCEPTION 'invalid_slug' USING ERRCODE = '22023';
  END IF;
  IF v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'invalid_slug' USING ERRCODE = '22023';
  END IF;
  IF app.is_reserved_workspace_slug(v_slug) THEN
    RAISE EXCEPTION 'reserved_slug' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.slug = v_slug AND w.id IS DISTINCT FROM p_workspace_id
  ) THEN
    RAISE EXCEPTION 'slug_taken' USING ERRCODE = '23505';
  END IF;

  v_phone := app.normalize_phone(p_business_phone);
  IF p_business_phone IS NOT NULL AND btrim(p_business_phone) <> '' AND v_phone IS NULL THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = '22023';
  END IF;

  v_email := nullif(lower(btrim(coalesce(p_business_email, ''))), '');
  v_instagram := nullif(btrim(regexp_replace(coalesce(p_instagram, ''), '^@+', '')), '');
  v_postal := regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g');
  IF v_postal = '' THEN
    v_postal := NULL;
  END IF;
  v_state := nullif(upper(btrim(coalesce(p_state, ''))), '');

  IF p_logo_path IS NOT NULL AND split_part(p_logo_path, '/', 1) IS DISTINCT FROM p_workspace_id::text THEN
    RAISE EXCEPTION 'invalid_logo_path' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.bypass_protected_columns', 'on', true);

  UPDATE public.workspaces
  SET name = v_name,
      slug = v_slug,
      updated_at = clock_timestamp()
  WHERE id = p_workspace_id
  RETURNING * INTO v_workspace;

  UPDATE public.workspace_settings
  SET business_phone = v_phone,
      business_email = v_email,
      description = nullif(btrim(coalesce(p_description, '')), ''),
      address = nullif(btrim(coalesce(p_address, '')), ''),
      city = nullif(btrim(coalesce(p_city, '')), ''),
      state = v_state,
      postal_code = v_postal,
      instagram = v_instagram,
      timezone = coalesce(nullif(btrim(coalesce(p_timezone, '')), ''), 'America/Sao_Paulo'),
      logo_path = CASE
        WHEN p_clear_logo THEN NULL
        WHEN p_logo_path IS NOT NULL THEN p_logo_path
        ELSE logo_path
      END,
      updated_at = clock_timestamp()
  WHERE workspace_id = p_workspace_id
  RETURNING * INTO v_settings;

  RETURN jsonb_build_object(
    'workspace_id', v_workspace.id,
    'name', v_workspace.name,
    'slug', v_workspace.slug,
    'timezone', v_settings.timezone
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.deactivate_workspace_member(
  p_workspace_id uuid,
  p_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION app.reactivate_workspace_member(
  p_workspace_id uuid,
  p_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION app.remove_workspace_member(
  p_workspace_id uuid,
  p_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION app.update_workspace_member_role(
  p_workspace_id uuid,
  p_member_id uuid,
  p_role public.member_role
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION app.revoke_workspace_invite(
  p_workspace_id uuid,
  p_invite_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invite public.workspace_invites;
BEGIN
  PERFORM app.require_workspace_manager(p_workspace_id);

  SELECT * INTO v_invite
  FROM public.workspace_invites i
  WHERE i.id = p_invite_id
  FOR UPDATE;

  IF v_invite.id IS NULL OR v_invite.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RAISE EXCEPTION 'invite_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.workspace_invites
  SET revoked_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE id = v_invite.id
    AND revoked_at IS NULL
    AND accepted_at IS NULL;

  RETURN jsonb_build_object('invite_id', v_invite.id, 'revoked', true);
END;
$$;

CREATE OR REPLACE FUNCTION app.peek_workspace_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash text;
  v_invite public.workspace_invites;
  v_name text;
  v_status text;
BEGIN
  IF p_token IS NULL OR char_length(p_token) < 16 THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT * INTO v_invite
  FROM public.workspace_invites i
  WHERE i.token_hash = v_hash;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  SELECT w.name INTO v_name
  FROM public.workspaces w
  WHERE w.id = v_invite.workspace_id;

  IF v_invite.revoked_at IS NOT NULL THEN
    v_status := 'revoked';
  ELSIF v_invite.accepted_at IS NOT NULL THEN
    v_status := 'accepted';
  ELSIF v_invite.expires_at <= clock_timestamp() THEN
    v_status := 'expired';
  ELSE
    v_status := 'valid';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'workspace_name', v_name,
    'role', v_invite.role,
    'email_bound', v_invite.email IS NOT NULL,
    'expires_at', v_invite.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.get_public_workspace_profile(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_workspace public.workspaces;
  v_settings public.workspace_settings;
  v_services jsonb;
  v_professionals jsonb;
BEGIN
  SELECT * INTO v_workspace
  FROM public.workspaces w
  WHERE w.slug = p_slug;

  IF v_workspace.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_settings
  FROM public.workspace_settings s
  WHERE s.workspace_id = v_workspace.id;

  SELECT coalesce(jsonb_agg(item ORDER BY item->>'name'), '[]'::jsonb)
    INTO v_services
  FROM (
    SELECT jsonb_build_object(
      'name', s.name,
      'description', s.description,
      'duration_minutes', s.duration_minutes,
      'price_cents', s.price_cents,
      'min_price_cents', coalesce((
        SELECT min(coalesce(ps.price_override_cents, s.price_cents))
        FROM public.professional_services ps
        JOIN public.professional_profiles pp ON pp.member_id = ps.professional_member_id
        JOIN public.workspace_members m ON m.id = pp.member_id
        WHERE ps.service_id = s.id
          AND ps.workspace_id = s.workspace_id
          AND ps.active
          AND pp.booking_enabled
          AND m.status = 'active'
          AND m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
      ), s.price_cents),
      'max_price_cents', coalesce((
        SELECT max(coalesce(ps.price_override_cents, s.price_cents))
        FROM public.professional_services ps
        JOIN public.professional_profiles pp ON pp.member_id = ps.professional_member_id
        JOIN public.workspace_members m ON m.id = pp.member_id
        WHERE ps.service_id = s.id
          AND ps.workspace_id = s.workspace_id
          AND ps.active
          AND pp.booking_enabled
          AND m.status = 'active'
          AND m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
      ), s.price_cents)
    ) AS item
    FROM public.services s
    WHERE s.workspace_id = v_workspace.id
      AND s.active
      AND s.archived_at IS NULL
  ) priced;

  SELECT coalesce(jsonb_agg(item ORDER BY item->>'display_name'), '[]'::jsonb)
    INTO v_professionals
  FROM (
    SELECT jsonb_build_object(
      'display_name', pp.display_name,
      'bio', pp.bio,
      'services', coalesce((
        SELECT jsonb_agg(s.name ORDER BY s.name)
        FROM public.professional_services ps
        JOIN public.services s ON s.id = ps.service_id
        WHERE ps.professional_member_id = pp.member_id
          AND ps.workspace_id = pp.workspace_id
          AND ps.active
          AND s.active
          AND s.archived_at IS NULL
      ), '[]'::jsonb)
    ) AS item
    FROM public.professional_profiles pp
    JOIN public.workspace_members m ON m.id = pp.member_id
    WHERE pp.workspace_id = v_workspace.id
      AND pp.booking_enabled
      AND m.status = 'active'
      AND m.role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
  ) people;

  RETURN jsonb_build_object(
    'name', v_workspace.name,
    'slug', v_workspace.slug,
    'description', v_settings.description,
    'city', v_settings.city,
    'state', v_settings.state,
    'instagram', v_settings.instagram,
    'logo_path', v_settings.logo_path,
    'services', v_services,
    'professionals', v_professionals
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.get_workspace_seat_usage(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.plans;
  v_used integer;
BEGIN
  IF NOT app.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT p.* INTO v_plan
  FROM public.subscriptions s
  JOIN public.plans p ON p.code = s.plan
  WHERE s.workspace_id = p_workspace_id;

  v_used := app.workspace_professional_seats(p_workspace_id);

  RETURN jsonb_build_object(
    'plan', v_plan.code,
    'max_professionals', v_plan.max_professionals,
    'used_professionals', v_used
  );
END;
$$;
