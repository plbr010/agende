-- PREPARED ONLY. Requires explicit emergency authorization for this project.
-- Stops public and internal creation RPCs, plus direct INSERT for user roles.
-- Already in-flight transactions may finish: drain and inspect after revocation.
-- Does not delete appointments, disable RLS, alter billing, or revoke service_role.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
REVOKE EXECUTE ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text) FROM PUBLIC,anon,authenticated;
REVOKE INSERT ON public.appointments FROM PUBLIC,anon,authenticated;
COMMIT;
