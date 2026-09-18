-- Agenda module: jornada, pausas, bloqueios e appointments.
-- Weekday 0–6 = domingo–sábado (EXTRACT(DOW) e Date.getDay() em JavaScript).
-- Não reescreve migrations anteriores.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

ALTER TABLE public.workspace_clients
  ADD CONSTRAINT workspace_clients_id_workspace_key UNIQUE (id, workspace_id);

CREATE TYPE public.appointment_status AS ENUM (
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show'
);

COMMENT ON TYPE public.appointment_status IS
  'scheduled/confirmed/in_progress ocupam horário; completed também (atendimento ocorreu); cancelled e no_show liberam o slot.';

CREATE TABLE public.professional_working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  professional_member_id uuid NOT NULL,
  weekday smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professional_working_hours_weekday_range CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT professional_working_hours_time_order CHECK (start_time < end_time),
  CONSTRAINT professional_working_hours_professional_fk
    FOREIGN KEY (professional_member_id, workspace_id)
    REFERENCES public.professional_profiles (member_id, workspace_id)
    ON DELETE CASCADE,
  CONSTRAINT professional_working_hours_no_overlap
    EXCLUDE USING gist (
      professional_member_id WITH =,
      weekday WITH =,
      int4range(
        (EXTRACT(HOUR FROM start_time)::integer * 60 + EXTRACT(MINUTE FROM start_time)::integer),
        (EXTRACT(HOUR FROM end_time)::integer * 60 + EXTRACT(MINUTE FROM end_time)::integer),
        '[)'
      ) WITH &&
    )
    WHERE (active)
);

CREATE INDEX professional_working_hours_workspace_id_idx
  ON public.professional_working_hours (workspace_id);
CREATE INDEX professional_working_hours_member_weekday_idx
  ON public.professional_working_hours (professional_member_id, weekday)
  WHERE active;

COMMENT ON TABLE public.professional_working_hours IS
  'Jornada padrão recorrente. Vários períodos no mesmo weekday são permitidos (ex.: 08:00–12:00 e 14:00–18:00). Range [start,end) impede sobreposição; períodos encostados são válidos.';
COMMENT ON COLUMN public.professional_working_hours.weekday IS
  '0=domingo, 1=segunda, …, 6=sábado. Mesmo padrão de EXTRACT(DOW FROM timestamptz AT TIME ZONE app.product_timezone()).';

CREATE TABLE public.professional_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  professional_member_id uuid NOT NULL,
  weekday smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professional_breaks_weekday_range CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT professional_breaks_time_order CHECK (start_time < end_time),
  CONSTRAINT professional_breaks_label_len CHECK (label IS NULL OR char_length(label) <= 80),
  CONSTRAINT professional_breaks_professional_fk
    FOREIGN KEY (professional_member_id, workspace_id)
    REFERENCES public.professional_profiles (member_id, workspace_id)
    ON DELETE CASCADE,
  CONSTRAINT professional_breaks_no_overlap
    EXCLUDE USING gist (
      professional_member_id WITH =,
      weekday WITH =,
      int4range(
        (EXTRACT(HOUR FROM start_time)::integer * 60 + EXTRACT(MINUTE FROM start_time)::integer),
        (EXTRACT(HOUR FROM end_time)::integer * 60 + EXTRACT(MINUTE FROM end_time)::integer),
        '[)'
      ) WITH &&
    )
    WHERE (active)
);

CREATE INDEX professional_breaks_workspace_id_idx
  ON public.professional_breaks (workspace_id);
CREATE INDEX professional_breaks_member_weekday_idx
  ON public.professional_breaks (professional_member_id, weekday)
  WHERE active;

COMMENT ON TABLE public.professional_breaks IS
  'Pausas recorrentes (almoço etc.). Não geram slots. Tabela separada da jornada para permitir 08:00–18:00 com pausa 12:00–13:00 sem fatiar a jornada.';

CREATE TABLE public.professional_time_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  professional_member_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professional_time_blocks_time_order CHECK (starts_at < ends_at),
  CONSTRAINT professional_time_blocks_reason_len CHECK (reason IS NULL OR char_length(reason) <= 200),
  CONSTRAINT professional_time_blocks_professional_fk
    FOREIGN KEY (professional_member_id, workspace_id)
    REFERENCES public.professional_profiles (member_id, workspace_id)
    ON DELETE CASCADE,
  CONSTRAINT professional_time_blocks_no_overlap
    EXCLUDE USING gist (
      professional_member_id WITH =,
      tstzrange(starts_at, ends_at, '[)') WITH &&
    )
);

CREATE INDEX professional_time_blocks_workspace_id_idx
  ON public.professional_time_blocks (workspace_id);
CREATE INDEX professional_time_blocks_member_range_idx
  ON public.professional_time_blocks (professional_member_id, starts_at, ends_at);
CREATE INDEX professional_time_blocks_workspace_range_idx
  ON public.professional_time_blocks (workspace_id, starts_at, ends_at);
CREATE INDEX professional_time_blocks_created_by_idx
  ON public.professional_time_blocks (created_by);

COMMENT ON TABLE public.professional_time_blocks IS
  'Bloqueios pontuais (folga, médico, férias, fechamento). timestamptz; a UI interpreta no fuso do produto (app.product_timezone()).';

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  professional_member_id uuid NOT NULL,
  service_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  price_cents integer NOT NULL,
  duration_minutes integer NOT NULL,
  notes text,
  created_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_time_order CHECK (starts_at < ends_at),
  CONSTRAINT appointments_price_non_negative CHECK (price_cents >= 0 AND price_cents <= 10000000),
  CONSTRAINT appointments_duration_range CHECK (duration_minutes BETWEEN 5 AND 480),
  CONSTRAINT appointments_notes_len CHECK (notes IS NULL OR char_length(notes) <= 2000),
  CONSTRAINT appointments_id_workspace_key UNIQUE (id, workspace_id),
  CONSTRAINT appointments_client_fk
    FOREIGN KEY (client_id, workspace_id)
    REFERENCES public.workspace_clients (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT appointments_professional_fk
    FOREIGN KEY (professional_member_id, workspace_id)
    REFERENCES public.professional_profiles (member_id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT appointments_service_fk
    FOREIGN KEY (service_id, workspace_id)
    REFERENCES public.services (id, workspace_id)
    ON DELETE RESTRICT,
  CONSTRAINT appointments_professional_time_excl
    EXCLUDE USING gist (
      professional_member_id WITH =,
      tstzrange(starts_at, ends_at, '[)') WITH &&
    )
    WHERE (status IN ('scheduled', 'confirmed', 'in_progress', 'completed'))
);

CREATE INDEX appointments_workspace_range_idx
  ON public.appointments (workspace_id, starts_at, ends_at);
CREATE INDEX appointments_workspace_professional_range_idx
  ON public.appointments (workspace_id, professional_member_id, starts_at);
CREATE INDEX appointments_professional_blocking_idx
  ON public.appointments (professional_member_id, starts_at, ends_at)
  WHERE status IN ('scheduled', 'confirmed', 'in_progress', 'completed');
CREATE INDEX appointments_workspace_status_idx
  ON public.appointments (workspace_id, status);
CREATE INDEX appointments_client_id_idx
  ON public.appointments (client_id);
CREATE INDEX appointments_service_id_idx
  ON public.appointments (service_id);
CREATE INDEX appointments_created_by_idx
  ON public.appointments (created_by);

COMMENT ON TABLE public.appointments IS
  'Agendamento interno. client_id aponta para workspace_clients (não client_profiles). price_cents e duration_minutes são snapshots. Mutações autenticadas só via RPC.';
COMMENT ON COLUMN public.appointments.price_cents IS
  'Snapshot do preço no momento da criação/troca de serviço. Override de professional_services ganha do catálogo. O cliente HTTP não define este valor.';
COMMENT ON COLUMN public.appointments.duration_minutes IS
  'Snapshot da duração. ends_at é calculado no servidor a partir de starts_at + duration.';
COMMENT ON CONSTRAINT appointments_professional_time_excl ON public.appointments IS
  'GiST EXCLUDE: dois appointments ativos do mesmo profissional não se sobrepõem. cancelled/no_show ficam fora. Junto com pg_advisory_xact_lock no RPC, impede corrida check-then-insert.';
