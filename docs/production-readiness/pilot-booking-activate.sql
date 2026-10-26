-- PREPARED ONLY. Do not run on production or shared staging without a separate authorization.
-- Does not delete appointments, edit subscriptions, trial dates, or Stripe.
-- Required session settings, with no salon UUID stored in this file:
--   agende.confirm_pilot_activation = yes
--   agende.pilot_workspace_id       = <uuid do estabelecimento>
--   agende.pilot_expires_at         = <timestamptz futuro, no máximo 90 dias>
--   agende.pilot_note               = <texto opcional, até 200 caracteres>
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $pilot$
DECLARE
  v_workspace uuid := nullif(current_setting('agende.pilot_workspace_id', true), '')::uuid;
  v_expires timestamptz := nullif(current_setting('agende.pilot_expires_at', true), '')::timestamptz;
  v_note text := nullif(current_setting('agende.pilot_note', true), '');
BEGIN
  IF current_setting('agende.confirm_pilot_activation', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'pilot_activation_not_confirmed' USING ERRCODE = '42501';
  END IF;
  IF v_workspace IS NULL OR v_expires IS NULL THEN
    RAISE EXCEPTION 'pilot_activation_arguments_required' USING ERRCODE = '22023';
  END IF;
  PERFORM app.activate_workspace_booking(v_workspace, v_expires, v_note);
END
$pilot$;
COMMIT;
