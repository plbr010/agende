-- Agenda tests. Privileged role required. Does not replace foundation.sql or catalog.sql.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/helpers.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/agenda.sql

CREATE OR REPLACE FUNCTION test_helpers.run_agenda_tests()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
  v_recv uuid;
  v_pro uuid;
  v_pro2 uuid;
  v_outsider uuid;
  v_ws_a uuid;
  v_ws_b uuid;
  v_created jsonb;
  v_invite jsonb;
  v_member_a uuid;
  v_member_b uuid;
  v_member_recv uuid;
  v_member_pro uuid;
  v_member_pro2 uuid;
  v_service_a uuid;
  v_service_b uuid;
  v_client_a uuid;
  v_client_b uuid;
  v_appt uuid;
  v_appt2 uuid;
  v_overlap uuid;
  v_tz text;
  v_start timestamptz;
  v_lunch timestamptz;
  v_late timestamptz;
  v_day_start timestamptz;
  v_price integer;
  v_duration integer;
  v_ends timestamptz;
  v_status public.appointment_status;
  v_count integer;
  v_forced boolean;
  v_excl boolean;
  v_slot timestamptz;
  v_passed text[] := ARRAY[]::text[];
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.cleanup('%@agende-agenda.test');
  v_tz := app.product_timezone();
  PERFORM test_helpers.assert_eq(v_tz, 'America/Sao_Paulo', 'product timezone');

  v_a := test_helpers.create_auth_user('owner-a@agende-agenda.test', 'professional', true);
  v_b := test_helpers.create_auth_user('owner-b@agende-agenda.test', 'professional', true);
  v_recv := test_helpers.create_auth_user('recepcao@agende-agenda.test', 'professional', true);
  v_pro := test_helpers.create_auth_user('pro-a@agende-agenda.test', 'professional', true);
  v_pro2 := test_helpers.create_auth_user('pro-a2@agende-agenda.test', 'professional', true);
  v_outsider := test_helpers.create_auth_user('fora@agende-agenda.test', 'professional', true);

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace($1)' INTO v_created USING 'Salao Agenda A';
  EXECUTE 'RESET ROLE';
  v_ws_a := (v_created->>'workspace_id')::uuid;
  SELECT m.id INTO v_member_a FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.user_id = v_a;

  PERFORM test_helpers.login_as(v_b);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace($1)' INTO v_created USING 'Salao Agenda B';
  EXECUTE 'RESET ROLE';
  v_ws_b := (v_created->>'workspace_id')::uuid;
  SELECT m.id INTO v_member_b FROM public.workspace_members m WHERE m.workspace_id = v_ws_b AND m.user_id = v_b;

  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.subscriptions SET plan = 'equipe', status = 'active' WHERE workspace_id = v_ws_a;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1, $2, $3)' INTO v_invite
    USING v_ws_a, 'receptionist'::public.member_role, 'recepcao@agende-agenda.test';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_recv);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';
  SELECT m.id INTO v_member_recv FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.user_id = v_recv;

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1, $2, $3)' INTO v_invite
    USING v_ws_a, 'professional'::public.member_role, 'pro-a@agende-agenda.test';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_pro);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';
  SELECT m.id INTO v_member_pro FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.user_id = v_pro;

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1, $2, $3)' INTO v_invite
    USING v_ws_a, 'professional'::public.member_role, 'pro-a2@agende-agenda.test';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_pro2);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';
  SELECT m.id INTO v_member_pro2 FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.user_id = v_pro2;

  SELECT c.relforcerowsecurity INTO v_forced
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'appointments';
  PERFORM test_helpers.assert_true(v_forced, 'appointments FORCE RLS');

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_professional_time_excl' AND contype = 'x'
  ) INTO v_excl;
  PERFORM test_helpers.assert_true(v_excl, 'appointment exclusion constraint exists');
  v_passed := array_append(v_passed, 'force_rls_and_exclusion');

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents, active)
  VALUES (v_ws_a, 'Corte', 60, 8000, true)
  RETURNING id INTO v_service_a;
  INSERT INTO public.professional_services (workspace_id, professional_member_id, service_id, active)
  VALUES (v_ws_a, v_member_pro, v_service_a, true);
  INSERT INTO public.professional_services (
    workspace_id, professional_member_id, service_id, price_override_cents, duration_override_minutes, active
  ) VALUES (v_ws_a, v_member_a, v_service_a, 10000, 45, true);
  INSERT INTO public.workspace_clients (workspace_id, full_name)
  VALUES (v_ws_a, 'Cliente A')
  RETURNING id INTO v_client_a;
  INSERT INTO public.professional_working_hours (
    workspace_id, professional_member_id, weekday, start_time, end_time, active
  ) VALUES
    (v_ws_a, v_member_pro, 1, '08:00', '12:00', true),
    (v_ws_a, v_member_pro, 1, '14:00', '18:00', true),
    (v_ws_a, v_member_a, 1, '08:00', '18:00', true);
  INSERT INTO public.professional_breaks (
    workspace_id, professional_member_id, weekday, start_time, end_time, label, active
  ) VALUES (v_ws_a, v_member_a, 1, '12:00', '13:00', 'Almoco', true);
  EXECUTE 'RESET ROLE';

  PERFORM test_helpers.login_as(v_b);
  EXECUTE 'SET ROLE authenticated';
  INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents, active)
  VALUES (v_ws_b, 'Corte B', 60, 5000, true)
  RETURNING id INTO v_service_b;
  INSERT INTO public.professional_services (workspace_id, professional_member_id, service_id, active)
  VALUES (v_ws_b, v_member_b, v_service_b, true);
  INSERT INTO public.workspace_clients (workspace_id, full_name)
  VALUES (v_ws_b, 'Cliente B')
  RETURNING id INTO v_client_b;
  INSERT INTO public.professional_working_hours (
    workspace_id, professional_member_id, weekday, start_time, end_time, active
  ) VALUES (v_ws_b, v_member_b, 1, '08:00', '18:00', true);
  EXECUTE 'RESET ROLE';

  v_start := timestamp '2026-09-21 09:00:00' AT TIME ZONE v_tz;
  v_lunch := timestamp '2026-09-21 12:00:00' AT TIME ZONE v_tz;
  v_late := timestamp '2026-09-21 19:00:00' AT TIME ZONE v_tz;
  v_day_start := timestamp '2026-09-21 08:00:00' AT TIME ZONE v_tz;

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_appointment($1,$2,$3,$4,$5,$6)'
    INTO v_appt
    USING v_ws_a, v_client_a, v_member_a, v_service_a, v_start, 'primeiro';
  EXECUTE 'RESET ROLE';

  SELECT price_cents, duration_minutes, ends_at, status
    INTO v_price, v_duration, v_ends, v_status
  FROM public.appointments WHERE id = v_appt;

  PERFORM test_helpers.assert_eq(v_price, 10000, 'override price snapshot');
  PERFORM test_helpers.assert_eq(v_duration, 45, 'override duration snapshot');
  PERFORM test_helpers.assert_eq(v_ends, v_start + interval '45 minutes', 'ends_at from snapshot');
  PERFORM test_helpers.assert_eq(v_status, 'scheduled'::public.appointment_status, 'default status');
  v_passed := array_append(v_passed, 'create_valid_with_override_snapshot');

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_appointment($1,$2,$3,$4,$5,$6)'
    INTO v_appt2
    USING v_ws_a, v_client_a, v_member_pro, v_service_a, v_start, NULL;
  EXECUTE 'RESET ROLE';
  SELECT price_cents, duration_minutes INTO v_price, v_duration FROM public.appointments WHERE id = v_appt2;
  PERFORM test_helpers.assert_eq(v_price, 8000, 'catalog price when no override');
  PERFORM test_helpers.assert_eq(v_duration, 60, 'catalog duration when no override');
  v_passed := array_append(v_passed, 'catalog_snapshot_without_override');

  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.services SET archived_at = now(), active = false WHERE id = v_service_a;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);
  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_appointment(%L,%L,%L,%L,%L::timestamptz, NULL)',
      v_ws_a, v_client_a, v_member_pro, v_service_a, v_start + interval '3 hours'
    ),
    'service_inactive',
    'archived service cannot be booked'
  );
  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.services SET archived_at = NULL, active = true WHERE id = v_service_a;
  UPDATE public.professional_profiles SET booking_enabled = false WHERE member_id = v_member_pro;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);
  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_appointment(%L,%L,%L,%L,%L::timestamptz, NULL)',
      v_ws_a, v_client_a, v_member_pro, v_service_a, timestamp '2026-09-21 15:00:00' AT TIME ZONE v_tz
    ),
    'professional_booking_disabled',
    'booking_enabled false cannot be booked'
  );
  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.professional_profiles SET booking_enabled = true WHERE member_id = v_member_pro;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);
  v_passed := array_append(v_passed, 'archived_and_booking_disabled');

  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_appointment(%L,%L,%L,%L,%L::timestamptz, NULL)',
      v_ws_a, v_client_a, v_member_pro2, v_service_a, timestamp '2026-09-21 15:00:00' AT TIME ZONE v_tz
    ),
    'professional_service_inactive',
    'unlinked professional cannot perform service'
  );
  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_appointment(%L,%L,%L,%L,%L::timestamptz, NULL)',
      v_ws_a, v_client_b, v_member_a, v_service_a, timestamp '2026-09-21 10:00:00' AT TIME ZONE v_tz
    ),
    'client_not_found',
    'cross-workspace client blocked'
  );
  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_appointment(%L,%L,%L,%L,%L::timestamptz, NULL)',
      v_ws_a, v_client_a, v_member_b, v_service_a, v_start
    ),
    'professional_not_found',
    'cross-workspace professional blocked'
  );
  v_passed := array_append(v_passed, 'cross_tenant_and_unlinked_blocked');

  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_appointment(%L,%L,%L,%L,%L::timestamptz, NULL)',
      v_ws_a, v_client_a, v_member_a, v_service_a, v_start
    ),
    'appointment_overlap',
    'overlapping appointment blocked'
  );
  v_passed := array_append(v_passed, 'overlap_blocked');

  EXECUTE 'RESET ROLE';
  ALTER TABLE public.appointments DISABLE TRIGGER appointments_assert_availability;
  BEGIN
    INSERT INTO public.appointments (
      workspace_id, client_id, professional_member_id, service_id,
      starts_at, ends_at, status, price_cents, duration_minutes, created_by
    ) VALUES (
      v_ws_a, v_client_a, v_member_a, v_service_a,
      v_start, v_start + interval '45 minutes', 'scheduled', 10000, 45, v_a
    );
    RAISE EXCEPTION 'FAIL: exclusion should block concurrent overlap';
  EXCEPTION
    WHEN exclusion_violation THEN
      NULL;
    WHEN OTHERS THEN
      IF SQLSTATE <> '23P01' THEN
        ALTER TABLE public.appointments ENABLE TRIGGER appointments_assert_availability;
        RAISE;
      END IF;
  END;
  ALTER TABLE public.appointments ENABLE TRIGGER appointments_assert_availability;
  v_passed := array_append(v_passed, 'exclusion_blocks_race');

  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_appointment(%L,%L,%L,%L,%L::timestamptz, NULL)',
      v_ws_a, v_client_a, v_member_a, v_service_a, v_late
    ),
    'outside_working_hours',
    'outside working hours blocked'
  );
  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_appointment(%L,%L,%L,%L,%L::timestamptz, NULL)',
      v_ws_a, v_client_a, v_member_a, v_service_a, v_lunch
    ),
    'inside_break',
    'break is respected'
  );
  v_passed := array_append(v_passed, 'hours_and_breaks');

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  INSERT INTO public.professional_time_blocks (
    workspace_id, professional_member_id, starts_at, ends_at, reason
  ) VALUES (
    v_ws_a, v_member_a,
    timestamp '2026-09-21 16:00:00' AT TIME ZONE v_tz,
    timestamp '2026-09-21 17:00:00' AT TIME ZONE v_tz,
    'Medico'
  );
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_appointment(%L,%L,%L,%L,%L::timestamptz, NULL)',
      v_ws_a, v_client_a, v_member_a, v_service_a,
      timestamp '2026-09-21 16:00:00' AT TIME ZONE v_tz
    ),
    'inside_time_block',
    'time block is respected'
  );
  v_passed := array_append(v_passed, 'time_block_respected');

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.set_appointment_status($1,$2)' USING v_appt, 'cancelled'::public.appointment_status;
  EXECUTE 'SELECT public.create_appointment($1,$2,$3,$4,$5,$6)'
    INTO v_overlap
    USING v_ws_a, v_client_a, v_member_a, v_service_a, v_start, 'depois do cancelamento';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_true(v_overlap IS NOT NULL, 'cancelled frees the slot');
  v_passed := array_append(v_passed, 'cancelled_frees_slot');

  PERFORM test_helpers.login_as(v_recv);
  PERFORM test_helpers.assert_error(
    format(
      'INSERT INTO public.professional_working_hours (workspace_id, professional_member_id, weekday, start_time, end_time) VALUES (%L, %L, 1, %L, %L)',
      v_ws_a, v_member_pro, '08:00', '12:00'
    ),
    '42501',
    'receptionist cannot write jornada'
  );
  PERFORM test_helpers.login_as(v_recv);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_appointment(%L,%L,%L,%L,%L::timestamptz, NULL)',
      v_ws_b, v_client_b, v_member_b, v_service_b, v_start
    ),
    'not_workspace_member',
    'receptionist cannot write other workspace'
  );
  v_passed := array_append(v_passed, 'receptionist_scope');

  PERFORM test_helpers.login_as(v_pro);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.set_appointment_status(%L, %L)',
      v_overlap, 'confirmed'
    ),
    'appointment_write_denied',
    'professional cannot alter another professional appointment'
  );
  v_passed := array_append(v_passed, 'professional_cannot_edit_other');

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.set_appointment_status($1,$2)' USING v_overlap, 'confirmed'::public.appointment_status;
  EXECUTE 'RESET ROLE';
  SELECT status INTO v_status FROM public.appointments WHERE id = v_overlap;
  PERFORM test_helpers.assert_eq(v_status, 'confirmed'::public.appointment_status, 'owner can confirm');
  SELECT price_cents INTO v_price FROM public.appointments WHERE id = v_overlap;
  PERFORM test_helpers.assert_eq(v_price, 10000, 'status change keeps snapshot');
  v_passed := array_append(v_passed, 'owner_admin_manage');

  PERFORM test_helpers.login_as(v_a);
  PERFORM test_helpers.assert_error(
    format('UPDATE public.appointments SET workspace_id = %L WHERE id = %L', v_ws_b, v_overlap),
    '42501',
    'workspace_id cannot be updated by authenticated'
  );
  v_passed := array_append(v_passed, 'workspace_id_immutable');

  PERFORM test_helpers.login_as(v_outsider);
  EXECUTE 'SET ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.appointments WHERE workspace_id = v_ws_a;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(v_count, 0, 'outsider IDOR select blocked');
  PERFORM test_helpers.login_as(v_b);
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_appointment(%L,%L,%L,%L,%L::timestamptz, NULL)',
      v_ws_a, v_client_a, v_member_a, v_service_a, timestamp '2026-09-21 10:00:00' AT TIME ZONE v_tz
    ),
    'not_workspace_member',
    'owner B cannot book in workspace A'
  );
  v_passed := array_append(v_passed, 'idor_cross_tenant');

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  SELECT s.starts_at INTO v_slot
  FROM public.list_available_slots(v_ws_a, v_member_pro, v_service_a, DATE '2026-09-21') s
  LIMIT 1;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_true(v_slot IS NOT NULL, 'available slots computed');
  PERFORM test_helpers.assert_true(v_slot >= v_day_start, 'slots stay inside local day');
  v_passed := array_append(v_passed, 'available_slots');

  PERFORM test_helpers.login_as(v_recv);
  EXECUTE 'SET ROLE authenticated';
  INSERT INTO public.professional_time_blocks (
    workspace_id, professional_member_id, starts_at, ends_at, reason
  ) VALUES (
    v_ws_a, v_member_pro,
    timestamp '2026-09-21 16:00:00' AT TIME ZONE v_tz,
    timestamp '2026-09-21 17:00:00' AT TIME ZONE v_tz,
    'Fechamento'
  );
  EXECUTE 'RESET ROLE';
  v_passed := array_append(v_passed, 'receptionist_can_block');

  PERFORM test_helpers.assert_true(
    NOT has_function_privilege('authenticated', 'app.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text)', 'execute'),
    'authenticated cannot execute app.create_appointment'
  );
  v_passed := array_append(v_passed, 'internal_rpc_not_granted');

  PERFORM test_helpers.cleanup('%@agende-agenda.test');
  RETURN array_to_string(v_passed, ', ');
EXCEPTION
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    PERFORM test_helpers.cleanup('%@agende-agenda.test');
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION test_helpers.run_agenda_tests() TO postgres, service_role;

SELECT test_helpers.run_agenda_tests() AS agenda_test_results;
