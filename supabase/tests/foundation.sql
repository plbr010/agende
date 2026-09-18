-- Executable foundation tests. Privileged role required (postgres / service_role).
-- These RAISE EXCEPTION when a rule is broken. Comments alone are not a pass.
--
-- How to run (after helpers.sql):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/helpers.sql
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/foundation.sql
--
-- Test users use the email domain @agende-foundation.test and are cleaned up.

CREATE OR REPLACE FUNCTION test_helpers.run_foundation_tests()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_client uuid;
  v_pro uuid;
  v_outsider uuid;
  v_unconfirmed uuid;
  v_match uuid;
  v_mismatch uuid;
  v_secret uuid;
  v_seat1 uuid;
  v_seat2 uuid;
  v_seat3 uuid;
  v_seat4 uuid;
  v_overflow uuid;
  v_ws uuid;
  v_ws2 uuid;
  v_sub public.subscriptions;
  v_created jsonb;
  v_invite jsonb;
  v_invite_a jsonb;
  v_invite_b jsonb;
  v_visible integer;
  v_duration interval;
  v_passed text[] := ARRAY[]::text[];
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.cleanup();

  -- 1. Client signup: profile + client_profiles, no subscription, no trial.
  v_client := test_helpers.create_auth_user('client@agende-foundation.test', 'client', true);
  PERFORM test_helpers.assert_true(
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = v_client AND p.intended_use = 'client'),
    'client profile created'
  );
  PERFORM test_helpers.assert_true(
    EXISTS (SELECT 1 FROM public.client_profiles c WHERE c.user_id = v_client),
    'client_profiles row created'
  );
  PERFORM test_helpers.assert_eq(
    (SELECT count(*)::integer FROM public.subscriptions s
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE w.owner_user_id = v_client),
    0,
    'client has no subscription'
  );
  PERFORM test_helpers.assert_eq(
    (SELECT count(*)::integer FROM public.professional_trial_claims t WHERE t.user_id = v_client),
    0,
    'client has no trial claim'
  );
  v_passed := v_passed || 'client_no_subscription_no_trial';

  -- 2. Professional confirmation does not start trial.
  v_pro := test_helpers.create_auth_user('pro@agende-foundation.test', 'professional', true);
  PERFORM test_helpers.assert_eq(
    (SELECT count(*)::integer FROM public.professional_trial_claims t WHERE t.user_id = v_pro),
    0,
    'professional has no trial before workspace'
  );
  PERFORM test_helpers.assert_eq(
    (SELECT count(*)::integer FROM public.subscriptions s
      JOIN public.workspaces w ON w.id = s.workspace_id
      WHERE w.owner_user_id = v_pro),
    0,
    'professional has no subscription before workspace'
  );
  v_passed := v_passed || 'professional_no_trial_before_workspace';

  -- 3. create_workspace is atomic: workspace + owner + subscription + 7-day trial.
  PERFORM test_helpers.login_as(v_pro);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace($1)' INTO v_created USING 'Salao Fundacao';
  EXECUTE 'RESET ROLE';

  v_ws := (v_created->>'workspace_id')::uuid;
  PERFORM test_helpers.assert_true(v_ws IS NOT NULL, 'workspace id returned');
  PERFORM test_helpers.assert_true(
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = v_ws AND w.owner_user_id = v_pro),
    'workspace row exists'
  );
  PERFORM test_helpers.assert_true(
    EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.workspace_id = v_ws AND m.user_id = v_pro AND m.role = 'owner' AND m.status = 'active'
    ),
    'owner membership exists'
  );

  SELECT * INTO v_sub FROM public.subscriptions s WHERE s.workspace_id = v_ws;
  PERFORM test_helpers.assert_true(v_sub.id IS NOT NULL, 'subscription exists');
  PERFORM test_helpers.assert_eq(v_sub.plan, 'solo'::public.subscription_plan, 'first workspace plan is solo');
  PERFORM test_helpers.assert_eq(v_sub.status, 'trialing'::public.subscription_status, 'first workspace is trialing');
  PERFORM test_helpers.assert_true(v_sub.trial_started_at IS NOT NULL, 'trial_started_at set');
  PERFORM test_helpers.assert_true(v_sub.trial_ends_at IS NOT NULL, 'trial_ends_at set');
  v_duration := v_sub.trial_ends_at - v_sub.trial_started_at;
  PERFORM test_helpers.assert_true(
    v_duration >= interval '6 days 23 hours 50 minutes'
    AND v_duration <= interval '7 days 10 minutes',
    'trial is exactly 7 days'
  );
  PERFORM test_helpers.assert_true(
    EXISTS (SELECT 1 FROM public.professional_trial_claims t WHERE t.user_id = v_pro AND t.workspace_id = v_ws),
    'trial claim recorded'
  );
  PERFORM test_helpers.assert_eq(v_created->>'trial_started', 'true', 'RPC reports trial_started');
  v_passed := v_passed || 'create_workspace_atomic_7_day_trial';

  -- 4. User B cannot SELECT workspace A (RLS).
  v_outsider := test_helpers.create_auth_user('outsider@agende-foundation.test', 'professional', true);
  PERFORM test_helpers.login_as(v_outsider);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT count(*)::integer FROM public.workspaces WHERE id = $1' INTO v_visible USING v_ws;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(v_visible, 0, 'outsider cannot select foreign workspace');
  v_passed := v_passed || 'rls_cannot_select_foreign_workspace';

  -- 5. User cannot alter subscription.
  PERFORM test_helpers.login_as(v_pro);
  PERFORM test_helpers.assert_error(
    format('UPDATE public.subscriptions SET plan = %L WHERE workspace_id = %L', 'salao', v_ws),
    '42501',
    'owner cannot update subscription plan'
  );
  v_passed := v_passed || 'cannot_update_subscription';

  -- 6. User cannot alter trial_ends_at.
  PERFORM test_helpers.login_as(v_pro);
  PERFORM test_helpers.assert_error(
    format('UPDATE public.subscriptions SET trial_ends_at = clock_timestamp() + interval ''30 days'' WHERE workspace_id = %L', v_ws),
    '42501',
    'owner cannot update trial_ends_at'
  );
  PERFORM test_helpers.assert_eq(
    (SELECT s.trial_ends_at FROM public.subscriptions s WHERE s.workspace_id = v_ws),
    v_sub.trial_ends_at,
    'trial_ends_at unchanged'
  );
  v_passed := v_passed || 'cannot_update_trial_ends_at';

  -- 7. User cannot alter own role.
  PERFORM test_helpers.login_as(v_pro);
  PERFORM test_helpers.assert_error(
    format('UPDATE public.workspace_members SET role = %L WHERE workspace_id = %L AND user_id = %L', 'admin', v_ws, v_pro),
    '42501',
    'owner cannot change own role'
  );
  PERFORM test_helpers.assert_eq(
    (SELECT m.role FROM public.workspace_members m WHERE m.workspace_id = v_ws AND m.user_id = v_pro),
    'owner'::public.member_role,
    'owner role unchanged'
  );
  v_passed := v_passed || 'cannot_update_own_role';

  -- 8. Unconfirmed email cannot create workspace.
  v_unconfirmed := test_helpers.create_auth_user('unconfirmed@agende-foundation.test', 'professional', false);
  PERFORM test_helpers.login_as(v_unconfirmed);
  PERFORM test_helpers.assert_error(
    'SELECT public.create_workspace(''Negocio Sem Email'')',
    'email_not_confirmed',
    'unconfirmed email cannot create workspace'
  );
  v_passed := v_passed || 'unconfirmed_email_cannot_create_workspace';

  -- 9. Phone need not be confirmed (phone_confirmed_at is NULL on v_pro).
  PERFORM test_helpers.assert_true(
    (SELECT u.phone_confirmed_at FROM auth.users u WHERE u.id = v_pro) IS NULL,
    'professional phone is not confirmed'
  );
  PERFORM test_helpers.assert_true(v_ws IS NOT NULL, 'workspace created without phone confirmation');
  v_passed := v_passed || 'phone_need_not_be_confirmed';

  -- 10. Second workspace of the same user does not get a new trial.
  PERFORM test_helpers.login_as(v_pro);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace($1)' INTO v_created USING 'Segundo Negocio';
  EXECUTE 'RESET ROLE';
  v_ws2 := (v_created->>'workspace_id')::uuid;
  PERFORM test_helpers.assert_eq(v_created->>'trial_started', 'false', 'second workspace trial_started is false');
  PERFORM test_helpers.assert_eq(
    (SELECT s.status FROM public.subscriptions s WHERE s.workspace_id = v_ws2),
    'expired'::public.subscription_status,
    'second workspace is expired not trialing'
  );
  PERFORM test_helpers.assert_true(
    (SELECT s.trial_ends_at FROM public.subscriptions s WHERE s.workspace_id = v_ws2) IS NULL,
    'second workspace has no trial_ends_at'
  );
  PERFORM test_helpers.assert_eq(
    (SELECT count(*)::integer FROM public.professional_trial_claims t WHERE t.user_id = v_pro),
    1,
    'still a single trial claim'
  );
  v_passed := v_passed || 'second_workspace_no_new_trial';

  -- Phone: DDD 55 must be kept; short/ambiguous values rejected.
  PERFORM test_helpers.assert_eq(app.normalize_phone('(55) 99999-9999'), '+5555999999999', 'ddd 55 mobile');
  PERFORM test_helpers.assert_eq(app.normalize_phone('55999999999'), '+5555999999999', 'ddd 55 national digits');
  PERFORM test_helpers.assert_eq(app.normalize_phone('+55 55 99999-9999'), '+5555999999999', 'ddd 55 with country code');
  PERFORM test_helpers.assert_eq(app.normalize_phone('5555999999999'), '+5555999999999', 'ddd 55 already with 55');
  PERFORM test_helpers.assert_eq(app.normalize_phone('(32) 99999-9999'), '+5532999999999', 'ddd 32 mobile');
  PERFORM test_helpers.assert_eq(app.normalize_phone('(55) 3333-4444'), '+555533334444', 'ddd 55 landline');
  PERFORM test_helpers.assert_eq(app.normalize_phone('(32) 3333-4444'), '+553233334444', 'ddd 32 landline');
  PERFORM test_helpers.assert_true(app.normalize_phone('12345678') IS NULL, 'reject 8 digits');
  PERFORM test_helpers.assert_true(app.normalize_phone('99999-9999') IS NULL, 'reject missing ddd');
  PERFORM test_helpers.assert_true(app.normalize_phone('+1 202 555 0100') IS NULL, 'reject non-BR');
  PERFORM test_helpers.assert_true(app.normalize_phone('55') IS NULL, 'reject bare 55');
  PERFORM test_helpers.assert_true(app.normalize_phone('(00) 99999-9999') IS NULL, 'reject DDD 00');
  v_passed := v_passed || 'phone_normalize_ddd_55';

  -- Invite email bind: mismatch denied, match allowed, NULL email is a secret link.
  v_match := test_helpers.create_auth_user('invite-match@agende-foundation.test', 'professional', true);
  v_mismatch := test_helpers.create_auth_user('invite-mismatch@agende-foundation.test', 'professional', true);
  v_secret := test_helpers.create_auth_user('invite-secret@agende-foundation.test', 'professional', true);

  PERFORM test_helpers.login_as(v_pro);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE
    'SELECT public.create_workspace_invite($1, $2, $3)'
    INTO v_invite
    USING v_ws, 'receptionist'::public.member_role, 'invite-mismatch@agende-foundation.test';
  EXECUTE 'RESET ROLE';

  PERFORM test_helpers.login_as(v_match);
  PERFORM test_helpers.assert_error(
    format('SELECT public.accept_workspace_invite(%L)', v_invite->>'token'),
    'invite_email_mismatch',
    'different confirmed email cannot accept bound invite'
  );
  EXECUTE 'RESET ROLE';

  PERFORM test_helpers.login_as(v_mismatch);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' INTO v_created USING v_invite->>'token';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(v_created->>'role', 'receptionist', 'matching email accepted bound invite');
  v_passed := v_passed || 'invite_email_must_match_confirmed_auth_email';

  PERFORM test_helpers.login_as(v_pro);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE
    'SELECT public.create_workspace_invite($1, $2, $3)'
    INTO v_invite
    USING v_ws, 'receptionist'::public.member_role, NULL;
  EXECUTE 'RESET ROLE';

  PERFORM test_helpers.login_as(v_secret);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' INTO v_created USING v_invite->>'token';
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.assert_eq(v_created->>'role', 'receptionist', 'null-email invite works as secret link');
  v_passed := v_passed || 'invite_null_email_secret_link';

  -- Seat limit: FOR UPDATE + constraint trigger. Solo is already full (owner).
  PERFORM test_helpers.login_as(v_pro);
  PERFORM test_helpers.assert_error(
    format('SELECT public.create_workspace_invite(%L, %L, NULL)', v_ws, 'professional'),
    'plan_professional_limit_reached',
    'solo cannot invite another professional'
  );
  EXECUTE 'RESET ROLE';

  -- Upgrade to equipe (max 5). Owner + 3 professionals = 4, one seat left, two competing invites.
  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  UPDATE public.subscriptions
  SET plan = 'equipe',
      status = 'active'
  WHERE workspace_id = v_ws;
  PERFORM set_config('app.bypass_protected_columns', 'off', true);

  v_seat1 := test_helpers.create_auth_user('seat1@agende-foundation.test', 'professional', true);
  v_seat2 := test_helpers.create_auth_user('seat2@agende-foundation.test', 'professional', true);
  v_seat3 := test_helpers.create_auth_user('seat3@agende-foundation.test', 'professional', true);
  v_seat4 := test_helpers.create_auth_user('seat4@agende-foundation.test', 'professional', true);
  v_overflow := test_helpers.create_auth_user('overflow@agende-foundation.test', 'professional', true);

  PERFORM test_helpers.login_as(v_pro);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1, $2, NULL)' INTO v_invite USING v_ws, 'professional'::public.member_role;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_seat1);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';

  PERFORM test_helpers.login_as(v_pro);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1, $2, NULL)' INTO v_invite USING v_ws, 'professional'::public.member_role;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_seat2);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';

  PERFORM test_helpers.login_as(v_pro);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1, $2, NULL)' INTO v_invite USING v_ws, 'professional'::public.member_role;
  EXECUTE 'RESET ROLE';
  PERFORM test_helpers.login_as(v_seat3);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite->>'token';
  EXECUTE 'RESET ROLE';

  PERFORM test_helpers.assert_eq(
    app.workspace_professional_seats(v_ws),
    4,
    'four professional seats occupied before race'
  );

  PERFORM test_helpers.login_as(v_pro);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.create_workspace_invite($1, $2, NULL)' INTO v_invite_a USING v_ws, 'professional'::public.member_role;
  EXECUTE 'SELECT public.create_workspace_invite($1, $2, NULL)' INTO v_invite_b USING v_ws, 'professional'::public.member_role;
  EXECUTE 'RESET ROLE';

  -- Simulated race: two outstanding professional invites, one remaining seat.
  -- Accept is serialized by SELECT ... FOR UPDATE on subscriptions, then re-counted.
  PERFORM test_helpers.login_as(v_seat4);
  EXECUTE 'SET ROLE authenticated';
  EXECUTE 'SELECT public.accept_workspace_invite($1)' USING v_invite_a->>'token';
  EXECUTE 'RESET ROLE';

  PERFORM test_helpers.login_as(v_overflow);
  PERFORM test_helpers.assert_error(
    format('SELECT public.accept_workspace_invite(%L)', v_invite_b->>'token'),
    'plan_professional_limit_reached',
    'second concurrent-style accept is rejected'
  );
  EXECUTE 'RESET ROLE';

  PERFORM test_helpers.assert_eq(
    app.workspace_professional_seats(v_ws),
    5,
    'equipe cap of 5 professionals held after race'
  );
  v_passed := v_passed || 'seat_limit_accept_serialized';

  -- Constraint trigger still blocks a direct INSERT even with protected-column bypass.
  PERFORM set_config('app.bypass_protected_columns', 'on', true);
  PERFORM test_helpers.assert_error(
    format(
      'INSERT INTO public.workspace_members (workspace_id, user_id, role, status) VALUES (%L, %L, %L, %L)',
      v_ws, v_overflow, 'professional', 'active'
    ),
    'plan_professional_limit_reached',
    'constraint trigger blocks overflow insert',
    false
  );
  PERFORM set_config('app.bypass_protected_columns', 'off', true);
  v_passed := v_passed || 'seat_limit_constraint_trigger';

  -- Least privilege: authenticated cannot EXECUTE internal app RPCs.
  PERFORM test_helpers.assert_true(
    NOT has_function_privilege('authenticated', 'app.create_workspace(text, text)', 'execute'),
    'authenticated cannot execute app.create_workspace'
  );
  PERFORM test_helpers.assert_true(
    NOT has_function_privilege('authenticated', 'app.accept_workspace_invite(text)', 'execute'),
    'authenticated cannot execute app.accept_workspace_invite'
  );
  PERFORM test_helpers.assert_true(
    NOT has_function_privilege('authenticated', 'app.normalize_phone(text)', 'execute'),
    'authenticated cannot execute app.normalize_phone'
  );
  PERFORM test_helpers.assert_true(
    has_function_privilege('authenticated', 'public.create_workspace(text, text)', 'execute'),
    'authenticated can execute public.create_workspace'
  );
  PERFORM test_helpers.assert_true(
    has_function_privilege('authenticated', 'app.is_workspace_member(uuid)', 'execute'),
    'authenticated can execute RLS helper is_workspace_member'
  );
  PERFORM test_helpers.assert_true(
    has_function_privilege('authenticated', 'app.has_workspace_role(uuid, public.member_role[])', 'execute'),
    'authenticated can execute RLS helper has_workspace_role'
  );
  v_passed := v_passed || 'least_privilege_execute_grants';

  PERFORM test_helpers.cleanup();
  RETURN array_to_string(v_passed, E'\n');
EXCEPTION
  WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    PERFORM test_helpers.cleanup();
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION test_helpers.run_foundation_tests() TO postgres, service_role;

SELECT test_helpers.run_foundation_tests() AS foundation_test_results;
