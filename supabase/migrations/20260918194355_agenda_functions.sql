-- Agenda helpers, availability, appointment RPCs and protect triggers.
-- Timezone do produto: único lugar no banco (app.product_timezone).
-- Mutação de appointments é atômica (lock + validação + INSERT/UPDATE + EXCLUDE).

CREATE OR REPLACE FUNCTION app.product_timezone()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT 'America/Sao_Paulo'::text;
$$;

COMMENT ON FUNCTION app.product_timezone() IS
  'Fuso padrão do produto. Não hardcode America/Sao_Paulo em RPCs/UI; use este helper e src/lib/time/timezone.ts.';

CREATE OR REPLACE FUNCTION app.time_to_minutes(p_time time)
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT (EXTRACT(HOUR FROM p_time)::integer * 60 + EXTRACT(MINUTE FROM p_time)::integer);
$$;

CREATE OR REPLACE FUNCTION app.lock_professional_agenda(p_professional_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_professional_member_id::text, 0));
END;
$$;

CREATE OR REPLACE FUNCTION app.actor_member(p_workspace_id uuid)
RETURNS public.workspace_members
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_row public.workspace_members;
BEGIN
  SELECT m.* INTO v_row
  FROM public.workspace_members m
  WHERE m.workspace_id = p_workspace_id
    AND m.user_id = auth.uid()
    AND m.status = 'active';

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'not_workspace_member' USING ERRCODE = '42501';
  END IF;

  RETURN v_row;
END;
$$;

