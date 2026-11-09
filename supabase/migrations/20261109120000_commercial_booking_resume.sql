-- Operator-only switch to reopen booking creation for every entitled salon after
-- the pilot gate (20261026120000) is installed. Without it the only way out of
-- the global pause is a per-salon exception with an expiry date.
--
-- This migration only defines the function. It does NOT reopen bookings by
-- itself: calling `select app.resume_booking_creation();` is a separate,
-- explicitly authorized operational step. Entitlement (trial, subscription,
-- lifetime or complimentary) is still required per salon by
-- app.workspace_may_create_appointment; anon stays without access and direct
-- INSERT stays revoked.

CREATE OR REPLACE FUNCTION app.resume_booking_creation()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.assert_booking_operator();

  UPDATE app.booking_creation_controls
  SET globally_paused = false,
      updated_at = now()
  WHERE id;

  IF NOT FOUND THEN
    INSERT INTO app.booking_creation_controls (id, globally_paused) VALUES (true, false);
  END IF;

  PERFORM app.sync_booking_creation_privileges();
END;
$$;

COMMENT ON FUNCTION app.resume_booking_creation() IS
  'Operator-only. Lifts the global booking pause and re-grants the creation RPCs to authenticated (never anon, never direct INSERT). Each salon still needs an active entitlement. Reverse with app.suspend_booking_creation().';

REVOKE ALL ON FUNCTION app.resume_booking_creation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.resume_booking_creation() TO service_role;
