-- PREPARED ONLY. Do not run on production or shared staging without a separate authorization.
-- Closes new bookings for one workspace and revokes its complimentary entitlement.
-- Does not delete appointments, edit subscriptions, trial dates, or Stripe.
-- Required session settings:
--   agende.confirm_pilot_deactivation = yes
--   agende.pilot_workspace_id         = <uuid do estabelecimento>
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $pilot$
DECLARE
  v_workspace uuid := nullif(current_setting('agende.pilot_workspace_id', true), '')::uuid;
BEGIN
  IF current_setting('agende.confirm_pilot_deactivation', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'pilot_deactivation_not_confirmed' USING ERRCODE = '42501';
  END IF;
  IF v_workspace IS NULL THEN
    RAISE EXCEPTION 'pilot_deactivation_arguments_required' USING ERRCODE = '22023';
  END IF;
  PERFORM app.deactivate_workspace_booking(v_workspace);
END
$pilot$;
COMMIT;
