-- PREPARED ONLY. Separate authorization after fixing and validating the gate.
-- Never restore the former anonymous reservation grant or direct table INSERT.
BEGIN;
SET LOCAL lock_timeout='5s';
REVOKE EXECUTE ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_public_appointment(text,uuid,uuid,timestamptz,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment(uuid,uuid,uuid,uuid,timestamptz,text) TO authenticated;
COMMIT;
