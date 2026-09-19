-- Public booking: customer notes, rate-limit events, and centralized booking rules.
-- Does not edit previously applied migrations.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS customer_note text;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_customer_note_len;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_customer_note_len
  CHECK (customer_note IS NULL OR char_length(customer_note) <= 500);

COMMENT ON COLUMN public.appointments.customer_note IS
  'Observação enviada pela cliente. Separada de notes (interna da equipe).';

CREATE TABLE IF NOT EXISTS public.public_booking_rate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  email text,
  phone text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX public_booking_rate_workspace_created_idx
  ON public.public_booking_rate_events (workspace_id, created_at DESC);
CREATE INDEX public_booking_rate_email_idx
  ON public.public_booking_rate_events (workspace_id, email, created_at DESC)
  WHERE email IS NOT NULL;
CREATE INDEX public_booking_rate_phone_idx
  ON public.public_booking_rate_events (workspace_id, phone, created_at DESC)
  WHERE phone IS NOT NULL;
CREATE INDEX public_booking_rate_ip_idx
  ON public.public_booking_rate_events (workspace_id, ip_hash, created_at DESC)
  WHERE ip_hash IS NOT NULL;

ALTER TABLE public.public_booking_rate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_booking_rate_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.public_booking_rate_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.public_booking_rate_events TO postgres, service_role;

COMMENT ON TABLE public.public_booking_rate_events IS
  'Eventos de reserva pública para limite por e-mail, telefone, IP e workspace. Sem acesso anon/authenticated.';

CREATE OR REPLACE FUNCTION app.booking_min_lead_minutes()
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT 30;
$$;

CREATE OR REPLACE FUNCTION app.booking_horizon_days()
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT 90;
$$;

CREATE OR REPLACE FUNCTION app.client_cancel_lead_minutes()
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT 120;
$$;

CREATE OR REPLACE FUNCTION app.public_booking_max_per_hour()
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT 5;
$$;

CREATE OR REPLACE FUNCTION app.public_booking_max_per_day()
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT 8;
$$;

CREATE OR REPLACE FUNCTION app.public_booking_max_workspace_per_hour()
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT 40;
$$;

CREATE OR REPLACE FUNCTION app.public_booking_max_workspace_per_day()
RETURNS integer
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT 120;
$$;

CREATE OR REPLACE FUNCTION app.workspace_timezone(p_workspace_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_tz text;
BEGIN
  SELECT s.timezone INTO v_tz
  FROM public.workspace_settings s
  WHERE s.workspace_id = p_workspace_id;

  IF v_tz IS NULL OR btrim(v_tz) = '' THEN
    RETURN app.product_timezone();
  END IF;
  RETURN v_tz;
END;
$$;

REVOKE ALL ON FUNCTION app.booking_min_lead_minutes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.booking_horizon_days() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.client_cancel_lead_minutes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.public_booking_max_per_hour() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.public_booking_max_per_day() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.public_booking_max_workspace_per_hour() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.public_booking_max_workspace_per_day() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.workspace_timezone(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION app.booking_min_lead_minutes() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.booking_horizon_days() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.client_cancel_lead_minutes() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.public_booking_max_per_hour() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.public_booking_max_per_day() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.public_booking_max_workspace_per_hour() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.public_booking_max_workspace_per_day() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION app.workspace_timezone(uuid) TO postgres, service_role;

CREATE POLICY public_booking_rate_events_deny_clients
  ON public.public_booking_rate_events
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
