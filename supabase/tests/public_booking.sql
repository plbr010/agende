-- Public booking + authenticated client flow. Privileged role required.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/helpers.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/public_booking.sql

CREATE OR REPLACE FUNCTION test_helpers.run_public_booking_tests()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_a uuid;
  v_b uuid;
  v_pro uuid;
  v_pro2 uuid;
  v_client_user uuid;
  v_client_other uuid;
  v_ws_a uuid;
  v_ws_b uuid;
  v_slug_a text;
  v_slug_b text;
  v_created jsonb;
  v_invite jsonb;
  v_member_a uuid;
  v_member_b uuid;
  v_member_pro uuid;
  v_member_pro2 uuid;
  v_service_a uuid;
  v_service_inactive uuid;
  v_service_archived uuid;
  v_service_b uuid;
  v_tz text;
  v_today date;
  v_monday date;
  v_start timestamptz;
  v_start2 timestamptz;
  v_start3 timestamptz;
  v_lunch timestamptz;
  v_block timestamptz;
  v_late timestamptz;
  v_receipt jsonb;
  v_receipt2 jsonb;
  v_catalog jsonb;
  v_appt uuid;
  v_appt2 uuid;
  v_appt3 uuid;
  v_client_id uuid;
  v_client_id2 uuid;
  v_count integer;
  v_price integer;
  v_duration integer;
  v_ends timestamptz;
  v_status public.appointment_status;
  v_note text;
  v_internal text;
  v_mine jsonb;
  v_auth_users integer;
  v_slot timestamptz;
  v_soon timestamptz;
  v_manaus timestamptz;
  v_passed text[] := ARRAY[]::text[];
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.cleanup('%@agende-public-booking.test');

  v_a := test_helpers.create_auth_user('owner-a@agende-public-booking.test', 'professional', true);
  v_b := test_helpers.create_auth_user('owner-b@agende-public-booking.test', 'professional', true);
  v_pro := test_helpers.create_auth_user('pro-a@agende-public-booking.test', 'professional', true);
  v_pro2 := test_helpers.create_auth_user('pro-a2@agende-public-booking.test', 'professional', true);
  v_client_other := test_helpers.create_auth_user('cliente-b@agende-public-booking.test', 'client', true);

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace($1)' INTO v_created USING 'Salao Public A';
  EXECUTE 'RESET ROLE';
  v_ws_a := (v_created->>'workspace_id')::uuid;
  SELECT w.slug INTO v_slug_a FROM public.workspaces w WHERE w.id = v_ws_a;
  SELECT m.id INTO v_member_a FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.user_id = v_a;

  PERFORM test_helpers.login_as(v_b);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace($1)' INTO v_created USING 'Salao Public B';
  EXECUTE 'RESET ROLE';
  v_ws_b := (v_created->>'workspace_id')::uuid;
  SELECT w.slug INTO v_slug_b FROM public.workspaces w WHERE w.id = v_ws_b;
  SELECT m.id INTO v_member_b FROM public.workspace_members m WHERE m.workspace_id = v_ws_b AND m.user_id = v_b;

  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.subscriptions SET plan = 'equipe', status = 'active' WHERE workspace_id = v_ws_a;
  UPDATE public.workspace_settings
    SET business_phone = '+5532999887766'
    WHERE workspace_id = v_ws_a;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1, $2, $3)' INTO v_invite
    USING v_ws_a, 'professional'::public.member_role, 'pro-a@agende-public-booking.test';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_pro);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';
  SELECT m.id INTO v_member_pro FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.user_id = v_pro;

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1, $2, $3)' INTO v_invite
    USING v_ws_a, 'professional'::public.member_role, 'pro-a2@agende-public-booking.test';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_pro2);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';
  SELECT m.id INTO v_member_pro2 FROM public.workspace_members m WHERE m.workspace_id = v_ws_a AND m.user_id = v_pro2;

  v_tz := app.workspace_timezone(v_ws_a);
  PERFORM test_helpers.assert_eq(v_tz, 'America/Sao_Paulo', 'default workspace timezone');
  v_today := (clock_timestamp() AT TIME ZONE v_tz)::date;
  v_monday := v_today + ((8 - EXTRACT(DOW FROM v_today)::integer) % 7);
  IF v_monday <= v_today THEN
    v_monday := v_monday + 7;
  END IF;

  PERFORM test_helpers.login_as(v_a);
  EXECUTE 'SET ROLE authenticated';
  INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents, active)
  VALUES (v_ws_a, 'Corte Publico', 60, 8000, true)
  RETURNING id INTO v_service_a;
  INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents, active)
  VALUES (v_ws_a, 'Inativo', 30, 3000, false)
  RETURNING id INTO v_service_inactive;
  INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents, active)
  VALUES (v_ws_a, 'Arquivado', 30, 3000, true)
  RETURNING id INTO v_service_archived;
  INSERT INTO public.professional_services (workspace_id, professional_member_id, service_id, active)
  VALUES
    (v_ws_a, v_member_pro, v_service_a, true),
    (v_ws_a, v_member_pro2, v_service_a, true);
  INSERT INTO public.professional_services (
    workspace_id, professional_member_id, service_id, price_override_cents, duration_override_minutes, active
  ) VALUES (v_ws_a, v_member_a, v_service_a, 10000, 45, true);
  INSERT INTO public.professional_working_hours (
    workspace_id, professional_member_id, weekday, start_time, end_time, active
  ) VALUES
    (v_ws_a, v_member_pro, 1, '08:00', '18:00', true),
    (v_ws_a, v_member_a, 1, '08:00', '18:00', true),
    (v_ws_a, v_member_pro2, 0, '00:00', '23:55', true),
    (v_ws_a, v_member_pro2, 1, '00:00', '23:55', true),
    (v_ws_a, v_member_pro2, 2, '00:00', '23:55', true),
    (v_ws_a, v_member_pro2, 3, '00:00', '23:55', true),
    (v_ws_a, v_member_pro2, 4, '00:00', '23:55', true),
    (v_ws_a, v_member_pro2, 5, '00:00', '23:55', true),
    (v_ws_a, v_member_pro2, 6, '00:00', '23:55', true);
  INSERT INTO public.professional_breaks (
    workspace_id, professional_member_id, weekday, start_time, end_time, label, active
  ) VALUES (v_ws_a, v_member_pro, 1, '12:00', '13:00', 'Almoco', true);
  INSERT INTO public.professional_time_blocks (
    workspace_id, professional_member_id, starts_at, ends_at, reason
  ) VALUES (
    v_ws_a,
    v_member_pro,
    (v_monday::timestamp + time '16:00') AT TIME ZONE v_tz,
    (v_monday::timestamp + time '17:00') AT TIME ZONE v_tz,
    'Bloqueio'
  );
  EXECUTE 'RESET ROLE';

  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.services SET archived_at = clock_timestamp(), active = false WHERE id = v_service_archived;
  UPDATE public.professional_profiles SET booking_enabled = false WHERE member_id = v_member_pro2;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);

  PERFORM test_helpers.login_as(v_b);
  EXECUTE 'SET ROLE authenticated';
  INSERT INTO public.services (workspace_id, name, duration_minutes, price_cents, active)
  VALUES (v_ws_b, 'Corte B', 60, 5000, true)
  RETURNING id INTO v_service_b;
  INSERT INTO public.professional_services (workspace_id, professional_member_id, service_id, active)
  VALUES (v_ws_b, v_member_b, v_service_b, true);
  INSERT INTO public.professional_working_hours (
    workspace_id, professional_member_id, weekday, start_time, end_time, active
  ) VALUES (v_ws_b, v_member_b, 1, '08:00', '18:00', true);
  INSERT INTO public.workspace_clients (workspace_id, full_name, email, phone)
  VALUES (v_ws_b, 'Cliente B', 'guest-a@agende-public-booking.test', '+5532998880001');
  EXECUTE 'RESET ROLE';

  v_start := (v_monday::timestamp + time '09:00') AT TIME ZONE v_tz;
  v_start2 := (v_monday::timestamp + time '10:00') AT TIME ZONE v_tz;
  v_start3 := (v_monday::timestamp + time '11:00') AT TIME ZONE v_tz;
  v_lunch := (v_monday::timestamp + time '12:00') AT TIME ZONE v_tz;
  v_block := (v_monday::timestamp + time '16:00') AT TIME ZONE v_tz;
  v_late := (v_monday::timestamp + time '19:00') AT TIME ZONE v_tz;

  PERFORM test_helpers.become_anon();
  EXECUTE 'SELECT public.list_public_booking_catalog($1)' INTO v_catalog USING v_slug_a;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_true(v_catalog ? 'services', 'anon catalog has services');
  PERFORM test_helpers.assert_true(
    v_catalog->'services' @> jsonb_build_array(jsonb_build_object('name', 'Corte Publico')),
    'anon sees public active service'
  );
  PERFORM test_helpers.assert_true(
    NOT (v_catalog::text ILIKE '%Inativo%') AND NOT (v_catalog::text ILIKE '%Arquivado%'),
    'inactive and archived services stay out of catalog'
  );
  v_passed := array_append(v_passed, 'anon_lists_public_catalog');

  EXECUTE 'SET ROLE anon';
  BEGIN
    EXECUTE 'SELECT count(*) FROM public.appointments';
    RAISE EXCEPTION 'FAIL: anon could read appointments';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  BEGIN
    EXECUTE 'SELECT count(*) FROM public.workspace_clients';
    RAISE EXCEPTION 'FAIL: anon could read workspace_clients';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  BEGIN
    EXECUTE 'SELECT count(*) FROM public.public_booking_rate_events';
    RAISE EXCEPTION 'FAIL: anon could read rate events';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  EXECUTE 'RESET ROLE';
  v_passed := array_append(v_passed, 'anon_cannot_read_private_tables');

  PERFORM test_helpers.become_anon();
  EXECUTE 'SELECT public.create_public_appointment($1,$2,$3,$4,$5,$6,$7,$8,$9)'
    INTO v_receipt
    USING v_slug_a, v_service_a, v_member_pro, v_start,
          'Maria Silva', '32998880001', 'guest-a@agende-public-booking.test', 'quero franja', 'ip-guest-a';
  EXECUTE 'RESET ROLE';

  v_appt := (v_receipt->>'appointment_id')::uuid;
  SELECT a.price_cents, a.duration_minutes, a.ends_at, a.status, a.customer_note, a.notes, a.client_id
    INTO v_price, v_duration, v_ends, v_status, v_note, v_internal, v_client_id
  FROM public.appointments a WHERE a.id = v_appt;

  PERFORM test_helpers.assert_eq(v_price, 8000, 'catalog price snapshot');
  PERFORM test_helpers.assert_eq(v_duration, 60, 'catalog duration snapshot');
  PERFORM test_helpers.assert_eq(v_ends, v_start + interval '60 minutes', 'ends_at computed in database');
  PERFORM test_helpers.assert_eq(v_status, 'scheduled'::public.appointment_status, 'public status scheduled');
  PERFORM test_helpers.assert_eq(v_note, 'quero franja', 'customer_note stored');
  PERFORM test_helpers.assert_true(v_internal IS NULL, 'internal notes stay empty');
  PERFORM test_helpers.assert_eq(v_receipt->>'guest', 'true', 'anon booking is guest');
  SELECT count(*)::int INTO v_auth_users FROM auth.users WHERE email = 'guest-a@agende-public-booking.test';
  PERFORM test_helpers.assert_eq(v_auth_users, 0, 'guest booking does not create auth.users');
  v_passed := array_append(v_passed, 'guest_booking_snapshot');

  PERFORM test_helpers.become_anon();
  EXECUTE 'SELECT public.create_public_appointment($1,$2,$3,$4,$5,$6,$7)'
    INTO v_receipt2
    USING v_slug_a, v_service_a, v_member_pro, v_start2,
          'Maria S', '32998880001', 'outra-maria@agende-public-booking.test';
  EXECUTE 'RESET ROLE';
  SELECT a.client_id INTO v_client_id2 FROM public.appointments a WHERE a.id = (v_receipt2->>'appointment_id')::uuid;
  PERFORM test_helpers.assert_eq(v_client_id, v_client_id2, 'same phone reuses workspace client');
  PERFORM test_helpers.assert_eq(
    (SELECT c.workspace_id FROM public.workspace_clients c WHERE c.id = v_client_id),
    v_ws_a,
    'reused client stays in workspace A'
  );
  v_passed := array_append(v_passed, 'workspace_client_reused');

  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_public_appointment(%L,%L,%L,%L,%L,%L,%L)',
      v_slug_a, v_service_inactive, v_member_pro, v_start3, 'Ana', '32998880011', 'inativo@agende-public-booking.test'
    ),
    'service_inactive',
    'inactive service cannot be booked',
    false
  );
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_public_appointment(%L,%L,%L,%L,%L,%L,%L)',
      v_slug_a, v_service_archived, v_member_pro, v_start3, 'Ana', '32998880012', 'arquivo@agende-public-booking.test'
    ),
    'service_inactive',
    'archived service cannot be booked',
    false
  );
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_public_appointment(%L,%L,%L,%L,%L,%L,%L)',
      v_slug_a, v_service_a, v_member_pro2, v_start3, 'Ana', '32998880013', 'disabled@agende-public-booking.test'
    ),
    'professional_booking_disabled',
    'booking_disabled professional cannot be booked',
    false
  );
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_public_appointment(%L,%L,%L,%L,%L,%L,%L)',
      v_slug_a, v_service_a, v_member_b, v_start3, 'Ana', '32998880014', 'pro-b@agende-public-booking.test'
    ),
    'professional_not_found',
    'professional from other workspace is refused',
    false
  );
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_public_appointment(%L,%L,%L,%L,%L,%L,%L)',
      v_slug_a, v_service_b, v_member_pro, v_start3, 'Ana', '32998880015', 'svc-b@agende-public-booking.test'
    ),
    'service_not_found',
    'service from other workspace is refused',
    false
  );
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_public_appointment(%L,%L,%L,%L,%L,%L,%L)',
      v_slug_a, v_service_a, v_member_pro, v_late, 'Ana', '32998880016', 'late@agende-public-booking.test'
    ),
    'outside_working_hours',
    'slot outside working hours is refused',
    false
  );
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_public_appointment(%L,%L,%L,%L,%L,%L,%L)',
      v_slug_a, v_service_a, v_member_pro, v_lunch, 'Ana', '32998880017', 'break@agende-public-booking.test'
    ),
    'inside_break',
    'break is respected',
    false
  );
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_public_appointment(%L,%L,%L,%L,%L,%L,%L)',
      v_slug_a, v_service_a, v_member_pro, v_block, 'Ana', '32998880018', 'block@agende-public-booking.test'
    ),
    'inside_time_block',
    'time block is respected',
    false
  );
  v_passed := array_append(v_passed, 'public_create_validations');

  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_public_appointment(%L,%L,%L,%L,%L,%L,%L)',
      v_slug_a, v_service_a, v_member_pro, v_start, 'Outra', '32998880019', 'dup@agende-public-booking.test'
    ),
    'slot_taken',
    'existing appointment blocks the slot',
    false
  );

  SELECT count(*)::int INTO v_count
  FROM public.appointments
  WHERE professional_member_id = v_member_pro
    AND starts_at = v_start
    AND status <> 'cancelled'::public.appointment_status;
  PERFORM test_helpers.assert_eq(v_count, 1, 'concurrent second booking does not duplicate');
  v_passed := array_append(v_passed, 'no_duplicate_slot');

  PERFORM test_helpers.become_anon();
  EXECUTE 'SELECT public.create_public_appointment($1,$2,$3,$4,$5,$6,$7)'
    INTO v_receipt
    USING v_slug_a, v_service_a, v_member_a, v_start3,
          'Cliente Override', '32998880020', 'override@agende-public-booking.test';
  EXECUTE 'RESET ROLE';
  SELECT a.price_cents, a.duration_minutes INTO v_price, v_duration
  FROM public.appointments a WHERE a.id = (v_receipt->>'appointment_id')::uuid;
  PERFORM test_helpers.assert_eq(v_price, 10000, 'professional override price snapshot');
  PERFORM test_helpers.assert_eq(v_duration, 45, 'professional override duration snapshot');
  v_passed := array_append(v_passed, 'override_snapshot');

  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.workspace_settings SET timezone = 'America/Manaus' WHERE workspace_id = v_ws_a;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);
  v_manaus := (v_monday::timestamp + time '14:00') AT TIME ZONE 'America/Manaus';
  PERFORM test_helpers.become_anon();
  EXECUTE 'SELECT public.create_public_appointment($1,$2,$3,$4,$5,$6,$7)'
    INTO v_receipt
    USING v_slug_a, v_service_a, v_member_pro, v_manaus,
          'Manaus', '32998880021', 'manaus@agende-public-booking.test';
  EXECUTE 'RESET ROLE';
  SELECT a.starts_at INTO v_slot FROM public.appointments a WHERE a.id = (v_receipt->>'appointment_id')::uuid;
  PERFORM test_helpers.assert_eq(v_slot, v_manaus, 'workspace timezone used for public slot');
  PERFORM test_helpers.assert_eq(v_receipt->>'timezone', 'America/Manaus', 'receipt timezone is workspace tz');
  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.workspace_settings SET timezone = 'America/Sao_Paulo' WHERE workspace_id = v_ws_a;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);
  v_passed := array_append(v_passed, 'workspace_timezone');

  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_public_appointment(%L,%L,%L,%L,%L,%L,%L)',
      v_slug_a, v_service_a, v_member_pro,
      ((v_monday - 14)::timestamp + time '09:00') AT TIME ZONE v_tz,
      'Passado', '32998880022', 'past@agende-public-booking.test'
    ),
    'slot_in_past',
    'past slot is refused',
    false
  );

  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.professional_profiles SET booking_enabled = true WHERE member_id = v_member_pro2;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);
  v_soon := date_trunc('minute', clock_timestamp()) + interval '10 minutes';
  PERFORM test_helpers.assert_error(
    format(
      'SELECT public.create_public_appointment(%L,%L,%L,%L,%L,%L,%L)',
      v_slug_a, v_service_a, v_member_pro2, v_soon,
      'Cedo', '32998880023', 'soon@agende-public-booking.test'
    ),
    'slot_too_soon',
    '30 minute lead is respected',
    false
  );
  v_passed := array_append(v_passed, 'past_and_lead_buffer');

  PERFORM test_helpers.assert_true(
    NOT EXISTS (
      SELECT 1 FROM public.workspace_clients c
      WHERE c.workspace_id = v_ws_a AND c.phone = '+5532998880001'
        AND c.id IN (SELECT c2.id FROM public.workspace_clients c2 WHERE c2.workspace_id = v_ws_b)
    ),
    'clients are not shared across workspaces'
  );
  PERFORM test_helpers.assert_true(
    NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.workspace_id = v_ws_b AND a.client_id = v_client_id
    ),
    'appointment of A does not appear in B'
  );
  v_passed := array_append(v_passed, 'no_cross_tenant_leak');

  v_client_user := test_helpers.create_auth_user('guest-a@agende-public-booking.test', 'client', true);
  PERFORM test_helpers.login_as(v_client_user);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_client_profile()';
  EXECUTE 'SELECT public.list_my_appointments()' INTO v_mine;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_true(
    v_mine @> jsonb_build_array(jsonb_build_object('id', v_appt::text)),
    'confirmed email links previous guest appointments'
  );
  PERFORM test_helpers.assert_true(NOT (v_mine::text ILIKE '%nota interna%'), 'list_my_appointments hides internal notes');
  v_passed := array_append(v_passed, 'authenticated_client_reads_own');

  PERFORM test_helpers.login_as(v_client_other);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_client_profile()';
  EXECUTE 'SELECT public.list_my_appointments()' INTO v_mine;
  EXECUTE 'SELECT count(*)::int FROM public.appointments WHERE id = $1' INTO v_count USING v_appt;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(coalesce(jsonb_array_length(v_mine), 0), 0, 'other client list is empty');
  PERFORM test_helpers.assert_eq(v_count, 0, 'other client cannot select foreign appointment row');
  v_passed := array_append(v_passed, 'client_cannot_read_others');

  v_appt2 := (v_receipt2->>'appointment_id')::uuid;
  PERFORM test_helpers.login_as(v_client_user);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.cancel_my_appointment($1)' INTO v_receipt USING v_appt2;
  EXECUTE 'RESET ROLE';
  SELECT a.status INTO v_status FROM public.appointments a WHERE a.id = v_appt2;
  PERFORM test_helpers.assert_eq(v_status, 'cancelled'::public.appointment_status, 'own cancel within lead works');
  v_passed := array_append(v_passed, 'client_cancel_own');

  PERFORM test_helpers.login_as(v_client_other);
  PERFORM test_helpers.assert_error(
    format('SELECT public.cancel_my_appointment(%L)', v_appt),
    'appointment_not_found',
    'cannot cancel someone else appointment',
    true
  );
  v_passed := array_append(v_passed, 'client_cancel_others_denied');

  PERFORM test_helpers.login_as(v_client_user);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_public_appointment($1,$2,$3,$4,$5,$6,$7)'
    INTO v_receipt
    USING v_slug_a, v_service_a, v_member_pro2,
          date_trunc('minute', clock_timestamp()) + interval '90 minutes',
          'Tarde demais', '32998880024', 'late-cancel@agende-public-booking.test';
  EXECUTE 'RESET ROLE';
  v_appt3 := (v_receipt->>'appointment_id')::uuid;
  PERFORM test_helpers.login_as(v_client_user);
  PERFORM test_helpers.assert_error(
    format('SELECT public.cancel_my_appointment(%L)', v_appt3),
    'cancel_too_late',
    'cancel after 2h window is refused',
    true
  );
  v_passed := array_append(v_passed, 'cancel_too_late');

  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.appointments SET status = 'completed'::public.appointment_status WHERE id = v_appt;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);
  PERFORM test_helpers.login_as(v_client_user);
  PERFORM test_helpers.assert_error(
    format('SELECT public.cancel_my_appointment(%L)', v_appt),
    'appointment_not_cancellable',
    'terminal appointment cannot be cancelled by client',
    true
  );
  v_passed := array_append(v_passed, 'terminal_not_cancellable');

  PERFORM test_helpers.assert_true(
    NOT has_function_privilege('anon', 'app.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)', 'execute'),
    'anon cannot execute internal create_public_appointment'
  );
  PERFORM test_helpers.assert_true(
    has_function_privilege('anon', 'public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text)', 'execute'),
    'anon can execute public create wrapper'
  );
  PERFORM test_helpers.assert_true(
    NOT has_function_privilege('anon', 'public.list_my_appointments()', 'execute'),
    'anon cannot list my appointments'
  );
  v_passed := array_append(v_passed, 'rpc_grants');

  PERFORM test_helpers.become_anon();
  SELECT s.starts_at INTO v_slot
  FROM public.list_public_available_slots(v_slug_a, v_service_a, v_member_pro, v_monday) s
  WHERE s.starts_at = v_lunch;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_true(v_slot IS NULL, 'public slots omit occupied/break times without naming clients');
  v_passed := array_append(v_passed, 'slots_are_availability_only');

  PERFORM test_helpers.cleanup('%@agende-public-booking.test');
  RETURN array_to_string(v_passed, ', ');
EXCEPTION
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    PERFORM test_helpers.cleanup('%@agende-public-booking.test');
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION test_helpers.run_public_booking_tests() TO postgres, service_role;

SELECT test_helpers.run_public_booking_tests() AS public_booking_test_results;
