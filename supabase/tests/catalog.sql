-- Catalog tests. Privileged role required. Does not replace foundation.sql.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/helpers.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/catalog.sql

CREATE OR REPLACE FUNCTION test_helpers.run_catalog_tests()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
  v_recv uuid;
  v_pro uuid;
  v_outsider uuid;
  v_ws_a uuid;
  v_ws_b uuid;
  v_created jsonb;
  v_invite jsonb;
  v_service_a uuid;
  v_service_b uuid;
  v_member_a uuid;
  v_member_b uuid;
  v_member_recv uuid;
  v_member_pro uuid;
  v_client_a uuid;
  v_client_b uuid;
  v_visible integer;
  v_forced boolean;
  v_passed text[] := ARRAY[]::text[];
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.cleanup('%@agende-catalog.test');

  v_a := test_helpers.create_auth_user('owner-a@agende-catalog.test', 'professional', true);
  v_b := test_helpers.create_auth_user('owner-b@agende-catalog.test', 'professional', true);
  v_recv := test_helpers.create_auth_user('recepcao@agende-catalog.test', 'professional', true);
  v_pro := test_helpers.create_auth_user('pro-a@agende-catalog.test', 'professional', true);
  v_outsider := test_helpers.create_auth_user('fora@agende-catalog.test', 'professional', true);

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace($1)' INTO v_created USING 'Salao A';
  EXECUTE 'RESET ROLE';
  v_ws_a := (v_created->>'workspace_id')::uuid;
  SELECT m.id INTO v_member_a FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.user_id = v_a;

  PERFORM test_helpers.login_as(v_b);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace($1)' INTO v_created USING 'Salao B';
  EXECUTE 'RESET ROLE';
  v_ws_b := (v_created->>'workspace_id')::uuid;
  SELECT m.id INTO v_member_b FROM public.workspace_members m WHERE m.workspace_id = v_ws_b AND m.user_id = v_b;

  PERFORM test_helpers.assert_true(
    EXISTS (SELECT 1 FROM public.professional_profiles p WHERE p.member_id = v_member_a AND p.booking_enabled),
    'owner A has professional profile'
  );
  PERFORM test_helpers.assert_true(
    EXISTS (SELECT 1 FROM public.professional_profiles p WHERE p.member_id = v_member_b),
    'owner B has professional profile'
  );
  v_passed := array_append(v_passed, 'owner_gets_professional_profile');

  SELECT c.relforcerowsecurity INTO v_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'workspace_clients';
  PERFORM test_helpers.assert_true(v_forced, 'workspace_clients FORCE RLS');
  v_passed := array_append(v_passed, 'force_rls_catalog_tables');

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE
    'SELECT public.create_workspace_invite($1, $2, $3)'
    INTO v_invite
    USING v_ws_a, 'receptionist'::public.member_role, 'recepcao@agende-catalog.test';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_recv);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';

  SELECT m.id INTO v_member_recv
  FROM public.workspace_members m
  WHERE m.workspace_id = v_ws_a AND m.user_id = v_recv;

  PERFORM test_helpers.assert_true(
    NOT EXISTS (
      SELECT 1
      FROM public.professional_profiles p
      JOIN public.workspace_members m ON m.id = p.member_id
      WHERE m.user_id = v_recv
    ),
    'receptionist has no professional profile'
  );
  v_passed := array_append(v_passed, 'receptionist_has_no_professional_profile');

  PERFORM test_helpers.login_as(v_recv);
  PERFORM test_helpers.assert_error(
    format(
      'INSERT INTO public.professional_profiles (member_id, workspace_id, display_name) VALUES (%L, %L, %L)',
      v_member_recv, v_ws_a, 'Hack'
    ),
    '42501',
    'receptionist cannot insert professional_profile'
  );
  v_passed := array_append(v_passed, 'receptionist_cannot_insert_professional_profile');

  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.subscriptions
  SET plan = 'equipe',
      status = 'active'
  WHERE workspace_id = v_ws_a;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE
    'SELECT public.create_workspace_invite($1, $2, $3)'
    INTO v_invite
    USING v_ws_a, 'professional'::public.member_role, 'pro-a@agende-catalog.test';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_pro);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';

  SELECT m.id INTO v_member_pro
  FROM public.workspace_members m
  WHERE m.workspace_id = v_ws_a AND m.user_id = v_pro;

  PERFORM test_helpers.assert_true(
    EXISTS (
      SELECT 1 FROM public.professional_profiles p
      WHERE p.member_id = v_member_pro AND p.booking_enabled
    ),
    'professional receives professional_profile'
  );
  v_passed := array_append(v_passed, 'professional_gets_professional_profile');

  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.workspace_members
  SET status = 'inactive'
  WHERE id = v_member_pro;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);

  PERFORM test_helpers.assert_true(
    EXISTS (
      SELECT 1 FROM public.professional_profiles p
      WHERE p.member_id = v_member_pro AND p.booking_enabled = false
    ),
    'inactive professional keeps profile with booking disabled'
  );

  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.workspace_members
  SET status = 'active', role = 'receptionist'
  WHERE id = v_member_pro;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);

  PERFORM test_helpers.assert_true(
    EXISTS (
      SELECT 1 FROM public.professional_profiles p
      WHERE p.member_id = v_member_pro AND p.booking_enabled = false
    ),
    'role change to receptionist disables booking without deleting profile'
  );
  v_passed := array_append(v_passed, 'inactive_or_receptionist_disables_booking');

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents)
  VALUES (v_ws_a, 'Corte', 45, 8000)
  RETURNING id INTO v_service_a;
  EXECUTE 'RESET ROLE';

  PERFORM test_helpers.login_as(v_b);
  EXECUTE 'SET ROLE authenticated';
  INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents)
  VALUES (v_ws_b, 'Coloracao', 90, 15000)
  RETURNING id INTO v_service_b;
  EXECUTE 'RESET ROLE';

  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format('INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents) VALUES (%L, %L, 30, -1)', v_ws_a, 'Invalido'),
    'services_price_non_negative',
    'negative price rejected'
  );
  PERFORM test_helpers.assert_error(
    format('INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents) VALUES (%L, %L, 2, 1000)', v_ws_a, 'Rapido demais'),
    'services_duration_range',
    'invalid duration rejected'
  );
  v_passed := array_append(v_passed, 'service_price_and_duration_constraints');

  PERFORM test_helpers.login_as(v_recv);
  PERFORM test_helpers.assert_error(
    format('INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents) VALUES (%L, %L, 30, 1000)', v_ws_a, 'Nao pode'),
    '42501',
    'receptionist cannot create services'
  );
  v_passed := array_append(v_passed, 'receptionist_cannot_manage_services');

  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format('INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents) VALUES (%L, %L, 30, 1000)', v_ws_b, 'Hack'),
    '42501',
    'cannot create service in foreign workspace'
  );

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT count(*)::int FROM public.services WHERE id = $1' INTO v_visible USING v_service_b;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(v_visible, 0, 'A cannot read B services');
  v_passed := array_append(v_passed, 'rls_hides_foreign_services');

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  UPDATE public.services SET name = 'Hack' WHERE id = v_service_b;
  GET DIAGNOSTICS v_visible = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(v_visible, 0, 'IDOR update of B service is a no-op');
  PERFORM test_helpers.assert_eq(
    (SELECT s.name FROM public.services s WHERE s.id = v_service_b),
    'Coloracao',
    'B service name unchanged after IDOR'
  );
  v_passed := array_append(v_passed, 'rls_blocks_service_idor');

  PERFORM test_helpers.login_as(v_outsider);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT count(*)::int FROM public.services WHERE workspace_id = $1' INTO v_visible USING v_ws_a;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(v_visible, 0, 'non-member cannot read services');
  v_passed := array_append(v_passed, 'non_member_cannot_read_catalog');

  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format(
      'INSERT INTO public.professional_services (workspace_id, professional_member_id, service_id) VALUES (%L, %L, %L)',
      v_ws_a, v_member_b, v_service_a
    ),
    'professional_services_professional_fk',
    'cannot link B professional to A service'
  );
  PERFORM test_helpers.assert_error(
    format(
      'INSERT INTO public.professional_services (workspace_id, professional_member_id, service_id) VALUES (%L, %L, %L)',
      v_ws_b, v_member_a, v_service_b
    ),
    '42501',
    'cannot link A professional using B workspace_id'
  );
  v_passed := array_append(v_passed, 'cross_workspace_professional_service_denied');

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  INSERT INTO public.workspace_clients (workspace_id, full_name, phone, email)
  VALUES (v_ws_a, 'Maria Silva', '(55) 99999-9999', 'Maria@Example.COM')
  RETURNING id INTO v_client_a;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(
    (SELECT c.phone FROM public.workspace_clients c WHERE c.id = v_client_a),
    '+5555999999999',
    'client phone keeps DDD 55'
  );
  PERFORM test_helpers.assert_eq(
    (SELECT c.email FROM public.workspace_clients c WHERE c.id = v_client_a),
    'maria@example.com',
    'client email stored lowercase'
  );
  PERFORM test_helpers.assert_true(
    (SELECT c.linked_user_id FROM public.workspace_clients c WHERE c.id = v_client_a) IS NULL,
    'linked_user_id stays null on insert'
  );
  v_passed := array_append(v_passed, 'client_phone_ddd_55');

  PERFORM test_helpers.login_as(v_b);
  EXECUTE 'SET ROLE authenticated';
  INSERT INTO public.workspace_clients (workspace_id, full_name)
  VALUES (v_ws_b, 'Cliente B')
  RETURNING id INTO v_client_b;
  EXECUTE 'SELECT count(*)::int FROM public.workspace_clients WHERE id = $1' INTO v_visible USING v_client_a;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(v_visible, 0, 'B cannot read A clients');
  v_passed := array_append(v_passed, 'rls_hides_foreign_clients');

  PERFORM test_helpers.login_as(v_outsider);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT count(*)::int FROM public.workspace_clients WHERE workspace_id = $1' INTO v_visible USING v_ws_a;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(v_visible, 0, 'non-member cannot read clients');

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  UPDATE public.workspace_clients SET full_name = 'Hack' WHERE id = v_client_b;
  GET DIAGNOSTICS v_visible = ROW_COUNT;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(v_visible, 0, 'IDOR update of B client is a no-op');
  v_passed := array_append(v_passed, 'rls_blocks_client_idor');

  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format('UPDATE public.workspace_clients SET workspace_id = %L WHERE id = %L', v_ws_b, v_client_a),
    '42501',
    'cannot change client workspace_id'
  );
  v_passed := array_append(v_passed, 'client_workspace_id_immutable');

  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format('UPDATE public.workspace_clients SET linked_user_id = %L WHERE id = %L', v_b, v_client_a),
    '42501',
    'cannot set linked_user_id from frontend role'
  );
  PERFORM test_helpers.assert_error(
    format(
      'INSERT INTO public.workspace_clients (workspace_id, full_name, linked_user_id) VALUES (%L, %L, %L)',
      v_ws_a, 'Hack', v_b
    ),
    '42501',
    'cannot insert linked_user_id'
  );
  v_passed := array_append(v_passed, 'linked_user_id_not_writable');

  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format('DELETE FROM public.services WHERE id = %L', v_service_a),
    '42501',
    'normal users cannot DELETE services'
  );

  PERFORM test_helpers.login_as(v_recv);
  EXECUTE 'SET ROLE authenticated';
  INSERT INTO public.workspace_clients (workspace_id, full_name)
  VALUES (v_ws_a, 'Cliente Recepcao');
  EXECUTE 'RESET ROLE';
  v_passed := array_append(v_passed, 'receptionist_can_create_client');

  PERFORM test_helpers.assert_true(
    NOT has_function_privilege('authenticated', 'app.sync_professional_profile()', 'execute'),
    'authenticated cannot execute sync_professional_profile'
  );
  PERFORM test_helpers.assert_true(
    NOT has_function_privilege('authenticated', 'app.protect_workspace_client_columns()', 'execute'),
    'authenticated cannot execute protect_workspace_client_columns'
  );
  v_passed := array_append(v_passed, 'internal_app_functions_not_granted');

  PERFORM test_helpers.cleanup('%@agende-catalog.test');
  RETURN array_to_string(v_passed, E'\n');
EXCEPTION
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    PERFORM test_helpers.cleanup('%@agende-catalog.test');
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION test_helpers.run_catalog_tests() TO postgres, service_role;

SELECT test_helpers.run_catalog_tests() AS catalog_test_results;
