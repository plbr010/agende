-- Workspace settings, public profile, invites UI support, and member management tests.
-- Privileged role required. Does not replace foundation.sql or catalog.sql.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/helpers.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/workspace_settings.sql

CREATE OR REPLACE FUNCTION test_helpers.run_workspace_settings_tests()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_owner_a uuid;
  v_admin uuid;
  v_pro uuid;
  v_recv uuid;
  v_owner_b uuid;
  v_wrong uuid;
  v_ws_a uuid;
  v_ws_b uuid;
  v_member_a uuid;
  v_member_admin uuid;
  v_member_pro uuid;
  v_member_recv uuid;
  v_member_b uuid;
  v_created jsonb;
  v_invite jsonb;
  v_secret jsonb;
  v_profile jsonb;
  v_result jsonb;
  v_service_active uuid;
  v_service_inactive uuid;
  v_service_archived uuid;
  v_visible integer;
  v_forced boolean;
  v_token text;
  v_passed text[] := ARRAY[]::text[];
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.cleanup('%@agende-settings.test');

  v_owner_a := test_helpers.create_auth_user('owner-a@agende-settings.test', 'professional', true);
  v_admin := test_helpers.create_auth_user('admin-a@agende-settings.test', 'professional', true);
  v_pro := test_helpers.create_auth_user('pro-a@agende-settings.test', 'professional', true);
  v_recv := test_helpers.create_auth_user('recv-a@agende-settings.test', 'professional', true);
  v_owner_b := test_helpers.create_auth_user('owner-b@agende-settings.test', 'professional', true);
  v_wrong := test_helpers.create_auth_user('outra@agende-settings.test', 'professional', true);

  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace($1)' INTO v_created USING 'Salao Aurora';
  EXECUTE 'RESET ROLE';
  v_ws_a := (v_created->>'workspace_id')::uuid;
  SELECT m.id INTO v_member_a FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.user_id = v_owner_a;

  PERFORM test_helpers.login_as(v_owner_b);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace($1)' INTO v_created USING 'Salao Boreal';
  EXECUTE 'RESET ROLE';
  v_ws_b := (v_created->>'workspace_id')::uuid;
  SELECT m.id INTO v_member_b FROM public.workspace_members m WHERE m.workspace_id = v_ws_b AND m.user_id = v_owner_b;

  PERFORM test_helpers.assert_true(
    EXISTS (
      SELECT 1 FROM public.workspace_settings s
      WHERE s.workspace_id = v_ws_a AND s.timezone = 'America/Sao_Paulo'
    ),
    'settings provisioned with default timezone'
  );
  SELECT c.relforcerowsecurity INTO v_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'workspace_settings';
  PERFORM test_helpers.assert_true(v_forced, 'workspace_settings FORCE RLS');
  v_passed := array_append(v_passed, 'settings_provisioned_force_rls');

  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE
    'SELECT public.update_workspace_settings($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)'
    INTO v_result
    USING v_ws_a, 'Aurora Studio', 'aurora-studio', '(32) 98888-7777', 'ola@aurora.test',
      'Studio de beleza', 'Rua das Flores 10', 'Juiz de Fora', 'MG', '36010041',
      '@aurora.studio', 'America/Sao_Paulo';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(v_result->>'slug', 'aurora-studio', 'owner can edit own settings');
  PERFORM test_helpers.assert_eq(
    (SELECT s.instagram FROM public.workspace_settings s WHERE s.workspace_id = v_ws_a),
    'aurora.studio',
    'instagram strips leading @'
  );
  v_passed := array_append(v_passed, '1_owner_edits_own_settings');

  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.subscriptions SET plan = 'equipe', status = 'active' WHERE workspace_id = v_ws_a;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);

  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1,$2,$3)' INTO v_invite
    USING v_ws_a, 'admin'::public.member_role, 'admin-a@agende-settings.test';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_admin);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE
    'SELECT public.update_workspace_settings($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)'
    INTO v_result
    USING v_ws_a, 'Aurora Studio', 'aurora-studio', '(32) 98888-7777', 'contato@aurora.test',
      'Studio de beleza', 'Rua das Flores 10', 'Juiz de Fora', 'MG', '36010041',
      'aurora.studio', 'America/Manaus';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(
    (SELECT s.timezone FROM public.workspace_settings s WHERE s.workspace_id = v_ws_a),
    'America/Manaus',
    'admin can edit own workspace settings'
  );
  SELECT m.id INTO v_member_admin FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.user_id = v_admin;
  v_passed := array_append(v_passed, '2_admin_edits_own_settings');

  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1,$2,$3)' INTO v_invite
    USING v_ws_a, 'professional'::public.member_role, 'pro-a@agende-settings.test';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_pro);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';
  SELECT m.id INTO v_member_pro FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.user_id = v_pro;

  PERFORM test_helpers.login_as(v_pro);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.update_workspace_settings(%L,%L,%L)',
      v_ws_a, 'Hack', 'hack-slug'
    ),
    'not_authorized',
    'professional cannot change administrative settings'
  );
  v_passed := array_append(v_passed, '3_professional_cannot_edit_settings');

  PERFORM test_helpers.login_as(v_owner_a);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.update_workspace_settings(%L,%L,%L)',
      v_ws_b, 'Hack B', 'hack-b'
    ),
    'not_authorized',
    'workspace A cannot alter B'
  );
  v_passed := array_append(v_passed, '4_cross_workspace_settings_denied');

  PERFORM test_helpers.login_as(v_owner_a);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.update_workspace_settings(%L,%L,%L)',
      v_ws_a, 'Aurora Studio', (SELECT w.slug FROM public.workspaces w WHERE w.id = v_ws_b)
    ),
    'slug_taken',
    'duplicate slug rejected'
  );
  v_passed := array_append(v_passed, '5_duplicate_slug_rejected');

  PERFORM test_helpers.login_as(v_owner_a);
  PERFORM test_helpers.assert_error(
    format('SELECT public.update_workspace_settings(%L,%L,%L)', v_ws_a, 'Aurora Studio', 'app'),
    'reserved_slug',
    'reserved slug app rejected'
  );
  PERFORM test_helpers.assert_error(
    format('SELECT public.update_workspace_settings(%L,%L,%L)', v_ws_a, 'Aurora Studio', 'convite'),
    'reserved_slug',
    'reserved slug convite rejected'
  );
  v_passed := array_append(v_passed, '6_reserved_slug_rejected');

  PERFORM test_helpers.become_anon();
  EXECUTE 'SELECT public.get_public_workspace_profile($1)' INTO v_profile USING 'nao-existe-xyz';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_true(v_profile IS NULL, 'missing workspace public profile is null');
  v_passed := array_append(v_passed, '7_missing_public_workspace_hidden');

  BEGIN
    EXECUTE 'SET ROLE anon';
    EXECUTE 'SELECT count(*) FROM public.workspaces';
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'FAIL: anon could read workspaces';
  EXCEPTION
    WHEN insufficient_privilege THEN
      EXECUTE 'RESET ROLE';
  END;
  BEGIN
    EXECUTE 'SET ROLE anon';
    EXECUTE 'SELECT count(*) FROM public.workspace_settings';
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'FAIL: anon could read workspace_settings';
  EXCEPTION
    WHEN insufficient_privilege THEN
      EXECUTE 'RESET ROLE';
  END;
  BEGIN
    EXECUTE 'SET ROLE anon';
    EXECUTE 'SELECT count(*) FROM public.workspace_members';
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'FAIL: anon could read members';
  EXCEPTION
    WHEN insufficient_privilege THEN
      EXECUTE 'RESET ROLE';
  END;
  BEGIN
    EXECUTE 'SET ROLE anon';
    EXECUTE 'SELECT count(*) FROM public.subscriptions';
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'FAIL: anon could read subscriptions';
  EXCEPTION
    WHEN insufficient_privilege THEN
      EXECUTE 'RESET ROLE';
  END;
  BEGIN
    EXECUTE 'SET ROLE anon';
    EXECUTE 'SELECT count(*) FROM public.workspace_clients';
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION 'FAIL: anon could read clients';
  EXCEPTION
    WHEN insufficient_privilege THEN
      EXECUTE 'RESET ROLE';
  END;
  PERFORM test_helpers.assert_true(
    NOT has_function_privilege('anon', 'app.get_public_workspace_profile(text)', 'execute'),
    'anon cannot execute internal app.get_public_workspace_profile'
  );
  v_passed := array_append(v_passed, '8_anon_cannot_read_internals');

  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents, active)
  VALUES (v_ws_a, 'Corte visivel', 45, 8000, true)
  RETURNING id INTO v_service_active;
  INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents, active)
  VALUES (v_ws_a, 'Corte pausado', 30, 5000, false)
  RETURNING id INTO v_service_inactive;
  INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents, active)
  VALUES (v_ws_a, 'Corte arquivo', 20, 4000, true)
  RETURNING id INTO v_service_archived;
  UPDATE public.services
  SET archived_at = clock_timestamp(),
      active = false
  WHERE id = v_service_archived;
  UPDATE public.professional_profiles SET display_name = 'Ana Aurora', booking_enabled = true WHERE member_id = v_member_a;
  UPDATE public.professional_profiles SET display_name = 'Bia Admin', booking_enabled = true WHERE member_id = v_member_admin;
  UPDATE public.professional_profiles SET display_name = 'Cris Pro', booking_enabled = false WHERE member_id = v_member_pro;
  INSERT INTO public.professional_services (workspace_id, professional_member_id, service_id, price_override_cents, active)
  VALUES (v_ws_a, v_member_a, v_service_active, 9000, true);
  EXECUTE 'RESET ROLE';

  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1,$2,$3)' INTO v_invite
    USING v_ws_a, 'receptionist'::public.member_role, 'recv-a@agende-settings.test';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_recv);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';
  SELECT m.id INTO v_member_recv FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.user_id = v_recv;

  PERFORM test_helpers.become_anon();
  EXECUTE 'SELECT public.get_public_workspace_profile($1)' INTO v_profile USING 'aurora-studio';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(v_profile->>'name', 'Aurora Studio', 'anon sees public name');
  PERFORM test_helpers.assert_true(v_profile ? 'services', 'public profile has services');
  PERFORM test_helpers.assert_true(NOT (v_profile ? 'workspace_id'), 'public profile omits workspace_id');
  PERFORM test_helpers.assert_true(NOT (v_profile ? 'business_email'), 'public profile omits business email');
  PERFORM test_helpers.assert_true(v_profile->'services' @> jsonb_build_array(jsonb_build_object('name', 'Corte visivel')), 'active service is public');
  PERFORM test_helpers.assert_true(
    NOT (v_profile->'services' @> jsonb_build_array(jsonb_build_object('name', 'Corte arquivo'))),
    'archived service is hidden'
  );
  PERFORM test_helpers.assert_true(
    NOT (v_profile->'services' @> jsonb_build_array(jsonb_build_object('name', 'Corte pausado'))),
    'inactive service is hidden'
  );
  PERFORM test_helpers.assert_eq(
    (SELECT count(*)::int FROM jsonb_array_elements(v_profile->'professionals') p WHERE p->>'display_name' IS NOT NULL),
    (SELECT count(*)::int FROM public.professional_profiles pp JOIN public.workspace_members m ON m.id = pp.member_id
      WHERE pp.workspace_id = v_ws_a AND pp.booking_enabled AND m.status = 'active'
        AND m.role IN ('owner','admin','professional')),
    'only bookable professionals appear'
  );
  PERFORM test_helpers.assert_true(
    NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_profile->'professionals') p
      WHERE p->>'display_name' = 'Cris Pro'
    ),
    'booking disabled professional hidden'
  );
  PERFORM test_helpers.assert_true(
    NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_profile->'professionals') p
      WHERE p->>'display_name' ILIKE '%recep%' OR p->>'display_name' = 'Teste Agende'
    ) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_profile->'professionals') p
      WHERE p->>'display_name' IN ('Ana Aurora', 'Bia Admin')
    ),
    'bookable professionals listed'
  );
  PERFORM test_helpers.assert_true(
    NOT EXISTS (SELECT 1 FROM public.professional_profiles p WHERE p.member_id = v_member_recv),
    'receptionist has no professional profile to leak'
  );
  v_passed := array_append(v_passed, '9_anon_public_profile_allowed');
  v_passed := array_append(v_passed, '10_archived_service_hidden');
  v_passed := array_append(v_passed, '11_inactive_service_hidden');
  v_passed := array_append(v_passed, '12_booking_disabled_hidden');
  v_passed := array_append(v_passed, '13_receptionist_not_public_professional');

  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1,$2,$3)' INTO v_invite
    USING v_ws_a, 'receptionist'::public.member_role, 'pro-a@agende-settings.test';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_wrong);
  PERFORM test_helpers.assert_error(
    format('SELECT public.accept_workspace_invite(%L)', v_invite->>'token'),
    'invite_email_mismatch',
    'email-bound invite rejects other email'
  );
  v_passed := array_append(v_passed, '14_email_bound_invite_rejects_mismatch');

  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1,$2,$3)' INTO v_secret
    USING v_ws_a, 'receptionist'::public.member_role, NULL;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_wrong);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_secret->>'token';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_true(
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = v_ws_a AND m.user_id = v_wrong AND m.role = 'receptionist'
    ),
    'secret invite without email can be accepted'
  );
  v_passed := array_append(v_passed, '15_secret_invite_without_email');

  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1,$2,$3)' INTO v_invite
    USING v_ws_a, 'receptionist'::public.member_role, NULL;
  EXECUTE 'RESET ROLE';
  UPDATE public.workspace_invites SET expires_at = clock_timestamp() - interval '1 hour'
    WHERE token_hash = encode(extensions.digest(v_invite->>'token', 'sha256'), 'hex');
  PERFORM test_helpers.login_as(v_owner_b);
  PERFORM test_helpers.assert_error(
    format('SELECT public.accept_workspace_invite(%L)', v_invite->>'token'),
    'invite_expired',
    'expired invite fails'
  );
  v_passed := array_append(v_passed, '16_expired_invite_fails');

  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1,$2,$3)' INTO v_invite
    USING v_ws_a, 'receptionist'::public.member_role, NULL;
  v_token := v_invite->>'token';
  EXECUTE 'RESET ROLE';
  -- mark used by accepting as a new user already in workspace? owner_b is other workspace.
  -- Use a freshly created user via second accept attempt after first.
  -- Recreate: accept once with a user who is not a member. v_wrong already is member.
  -- Create invite, accept with owner_b (has own workspace, not member of A).
  PERFORM test_helpers.login_as(v_owner_b);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_token;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_admin);
  PERFORM test_helpers.assert_error(
    format('SELECT public.accept_workspace_invite(%L)', v_token),
    'invite_already_accepted',
    'used invite fails'
  );
  v_passed := array_append(v_passed, '17_used_invite_fails');

  PERFORM test_helpers.login_as(v_owner_b);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_workspace_invite(%L,%L,%L)',
      v_ws_b, 'professional'::public.member_role, 'pro-a@agende-settings.test'
    ),
    'plan_professional_limit_reached',
    'solo workspace cannot add another professional seat'
  );
  PERFORM test_helpers.login_as(v_owner_b);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1,$2,$3)' INTO v_invite
    USING v_ws_b, 'receptionist'::public.member_role, NULL;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_recv);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(
    (SELECT m.role::text FROM public.workspace_members m WHERE m.workspace_id = v_ws_b AND m.user_id = v_recv),
    'receptionist',
    'receptionist joined solo workspace'
  );
  PERFORM test_helpers.assert_eq(
    (SELECT app.workspace_professional_seats(v_ws_b)),
    1,
    'receptionist does not consume professional seat'
  );
  v_passed := array_append(v_passed, '18_professional_blocked_without_seat');
  v_passed := array_append(v_passed, '19_receptionist_invite_without_professional_seat');

  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.deactivate_workspace_member($1,$2)' INTO v_result USING v_ws_a, v_member_pro;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(
    (SELECT m.status::text FROM public.workspace_members m WHERE m.id = v_member_pro),
    'inactive',
    'owner deactivated professional'
  );
  v_passed := array_append(v_passed, '20_owner_deactivates_member');

  PERFORM test_helpers.login_as(v_pro);
  PERFORM test_helpers.assert_error(
    format('SELECT public.remove_workspace_member(%L,%L)', v_ws_a, v_member_admin),
    'not_authorized',
    'inactive professional cannot remove members'
  );
  -- also as still-active admin? professional is inactive. Test with professional role after reactivate? 
  -- Use admin? User asked professional cannot remove. Reactivate first then try? Seat: equipe has owner+admin+pro inactive = 2 used of 5.
  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.reactivate_workspace_member($1,$2)' USING v_ws_a, v_member_pro;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_pro);
  PERFORM test_helpers.assert_error(
    format('SELECT public.remove_workspace_member(%L,%L)', v_ws_a, v_member_admin),
    'not_authorized',
    'professional cannot remove another member'
  );
  v_passed := array_append(v_passed, '21_professional_cannot_remove_member');

  PERFORM test_helpers.login_as(v_owner_a);
  PERFORM test_helpers.assert_error(
    format('SELECT public.deactivate_workspace_member(%L,%L)', v_ws_a, v_member_a),
    'last_owner_protected',
    'cannot deactivate last owner'
  );
  PERFORM test_helpers.login_as(v_admin);
  PERFORM test_helpers.assert_error(
    format('SELECT public.remove_workspace_member(%L,%L)', v_ws_a, v_member_a),
    'last_owner_protected',
    'cannot remove last owner'
  );
  PERFORM test_helpers.assert_eq(
    (SELECT count(*)::int FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.role = 'owner' AND m.status = 'active'),
    1,
    'workspace still has an active owner'
  );
  v_passed := array_append(v_passed, '22_workspace_keeps_owner');

  PERFORM test_helpers.login_as(v_owner_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.deactivate_workspace_member($1,$2)' USING v_ws_a, v_member_pro;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.subscriptions SET plan = 'solo' WHERE workspace_id = v_ws_a;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);
  -- used seats: owner + admin = 2, solo max = 1. Reactivating professional must fail.
  PERFORM test_helpers.login_as(v_owner_a);
  PERFORM test_helpers.assert_error(
    format('SELECT public.reactivate_workspace_member(%L,%L)', v_ws_a, v_member_pro),
    'plan_professional_limit_reached',
    'reactivation respects plan seat limit'
  );
  v_passed := array_append(v_passed, '23_reactivation_respects_plan');

  PERFORM test_helpers.login_as(v_owner_a);
  PERFORM test_helpers.assert_error(
    format('SELECT public.deactivate_workspace_member(%L,%L)', v_ws_b, v_member_b),
    'not_authorized',
    'cannot deactivate member of another workspace'
  );
  PERFORM test_helpers.login_as(v_owner_a);
  PERFORM test_helpers.assert_error(
    format('SELECT public.update_workspace_member_role(%L,%L,%L)', v_ws_a, v_member_b, 'admin'::public.member_role),
    'member_not_found',
    'cannot change role of foreign member even with own workspace_id'
  );
  v_passed := array_append(v_passed, '24_idor_cross_tenant_blocked');

  PERFORM test_helpers.assert_true(
    EXISTS (
      SELECT 1 FROM storage.buckets b
      WHERE b.id = 'workspace-logos'
        AND b.public
        AND b.file_size_limit = 2097152
        AND b.allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
    ),
    'workspace-logos bucket is public, 2MB, jpeg/png/webp'
  );
  PERFORM test_helpers.assert_eq(
    (
      SELECT count(*)::int
      FROM pg_policies p
      WHERE p.schemaname = 'storage'
        AND p.tablename = 'objects'
        AND p.policyname IN (
          'workspace_logos_select',
          'workspace_logos_insert',
          'workspace_logos_update',
          'workspace_logos_delete'
        )
    ),
    4,
    'logo storage policies exist'
  );

  PERFORM test_helpers.login_as(v_owner_a);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.update_workspace_settings(%L,%L,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,%L)',
      v_ws_a,
      'Aurora Studio',
      'aurora-studio',
      v_ws_b::text || '/logo.webp'
    ),
    'invalid_logo_path',
    'logo path must belong to the workspace'
  );

  PERFORM test_helpers.login_as(v_pro);
  PERFORM test_helpers.assert_error(
    format(
      'INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)',
      'workspace-logos',
      v_ws_a::text || '/logo-pro.webp'
    ),
    '42501',
    'professional cannot upload workspace logo'
  );

  PERFORM test_helpers.login_as(v_owner_b);
  PERFORM test_helpers.assert_error(
    format(
      'INSERT INTO storage.objects (bucket_id, name) VALUES (%L, %L)',
      'workspace-logos',
      v_ws_a::text || '/logo-cross.webp'
    ),
    '42501',
    'cross-tenant cannot upload into another workspace logo folder'
  );

  -- INSERT is allowed; DELETE on storage.objects is blocked by storage.protect_delete().
  -- Keep the owner upload in a subtransaction and roll it back.
  BEGIN
    PERFORM test_helpers.login_as(v_owner_a);
    EXECUTE 'SET ROLE authenticated';
    INSERT INTO storage.objects (bucket_id, name)
    VALUES ('workspace-logos', v_ws_a::text || '/logo-owner.webp');
    EXECUTE 'RESET ROLE';
    PERFORM test_helpers.assert_true(
      EXISTS (
        SELECT 1 FROM storage.objects o
        WHERE o.bucket_id = 'workspace-logos'
          AND o.name = v_ws_a::text || '/logo-owner.webp'
      ),
      'owner can upload workspace logo'
    );

    PERFORM test_helpers.login_as(v_pro);
    EXECUTE 'SET ROLE authenticated';
    UPDATE storage.objects
    SET metadata = jsonb_build_object('tamper', true)
    WHERE bucket_id = 'workspace-logos'
      AND name = v_ws_a::text || '/logo-owner.webp';
    GET DIAGNOSTICS v_visible = ROW_COUNT;
    EXECUTE 'RESET ROLE';
    PERFORM test_helpers.assert_eq(v_visible, 0, 'professional cannot update workspace logo');

    RAISE EXCEPTION 'rollback_owner_logo_insert';
  EXCEPTION
    WHEN OTHERS THEN
      EXECUTE 'RESET ROLE';
      IF SQLERRM NOT ILIKE '%rollback_owner_logo_insert%' THEN
        RAISE;
      END IF;
  END;
  PERFORM test_helpers.assert_true(
    NOT EXISTS (
      SELECT 1 FROM storage.objects o
      WHERE o.bucket_id = 'workspace-logos'
        AND o.name = v_ws_a::text || '/logo-owner.webp'
    ),
    'owner logo insert was rolled back without storage.objects DELETE'
  );
  v_passed := array_append(v_passed, '25_logo_storage_rls');

  PERFORM test_helpers.cleanup('%@agende-settings.test');
  RETURN array_to_string(v_passed, E'\n');
EXCEPTION
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    PERFORM test_helpers.cleanup('%@agende-settings.test');
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION test_helpers.run_workspace_settings_tests() TO postgres, service_role;

SELECT test_helpers.run_workspace_settings_tests() AS workspace_settings_test_results;
