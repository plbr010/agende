-- Catalog module: professional profiles, services, professional_services, workspace_clients.
-- Does not rewrite previously applied foundation migrations.

ALTER TABLE public.workspace_members
  ADD CONSTRAINT workspace_members_id_workspace_key UNIQUE (id, workspace_id);

CREATE TABLE public.professional_profiles (
  member_id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  bio text,
  booking_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professional_profiles_display_name_len
    CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 80),
  CONSTRAINT professional_profiles_bio_len
    CHECK (bio IS NULL OR char_length(bio) <= 500),
  CONSTRAINT professional_profiles_member_workspace_key UNIQUE (member_id, workspace_id),
  CONSTRAINT professional_profiles_member_workspace_fk
    FOREIGN KEY (member_id, workspace_id)
    REFERENCES public.workspace_members (id, workspace_id)
    ON DELETE CASCADE
);

CREATE INDEX professional_profiles_workspace_id_idx
  ON public.professional_profiles (workspace_id);
CREATE INDEX professional_profiles_booking_idx
  ON public.professional_profiles (workspace_id)
  WHERE booking_enabled;

COMMENT ON TABLE public.professional_profiles IS
  'Perfil de atendimento de um membro owner/admin/professional. receptionist não possui perfil.';

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL,
  price_cents integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  created_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT services_name_len CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  CONSTRAINT services_description_len CHECK (description IS NULL OR char_length(description) <= 500),
  CONSTRAINT services_duration_range CHECK (duration_minutes BETWEEN 5 AND 480),
  CONSTRAINT services_price_non_negative CHECK (price_cents >= 0 AND price_cents <= 10000000),
  CONSTRAINT services_id_workspace_key UNIQUE (id, workspace_id),
  CONSTRAINT services_archived_inactive CHECK (archived_at IS NULL OR active = false)
);

CREATE INDEX services_workspace_id_idx ON public.services (workspace_id);
CREATE INDEX services_workspace_active_idx
  ON public.services (workspace_id)
  WHERE archived_at IS NULL AND active;
CREATE INDEX services_workspace_name_idx
  ON public.services (workspace_id, lower(name));
CREATE INDEX services_created_by_idx ON public.services (created_by);

COMMENT ON TABLE public.services IS
  'Catálogo de serviços do workspace. Soft delete via archived_at. Preço em centavos.';

CREATE TABLE public.professional_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  professional_member_id uuid NOT NULL,
  service_id uuid NOT NULL,
  price_override_cents integer,
  duration_override_minutes integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT professional_services_unique UNIQUE (professional_member_id, service_id),
  CONSTRAINT professional_services_price_override
    CHECK (price_override_cents IS NULL OR (price_override_cents >= 0 AND price_override_cents <= 10000000)),
  CONSTRAINT professional_services_duration_override
    CHECK (duration_override_minutes IS NULL OR duration_override_minutes BETWEEN 5 AND 480),
  CONSTRAINT professional_services_professional_fk
    FOREIGN KEY (professional_member_id, workspace_id)
    REFERENCES public.professional_profiles (member_id, workspace_id)
    ON DELETE CASCADE,
  CONSTRAINT professional_services_service_fk
    FOREIGN KEY (service_id, workspace_id)
    REFERENCES public.services (id, workspace_id)
    ON DELETE CASCADE
);

CREATE INDEX professional_services_workspace_id_idx
  ON public.professional_services (workspace_id);
CREATE INDEX professional_services_service_id_idx
  ON public.professional_services (service_id);
CREATE INDEX professional_services_professional_idx
  ON public.professional_services (professional_member_id);

COMMENT ON TABLE public.professional_services IS
  'Vínculo profissional-serviço no mesmo workspace, garantido por FK composta.';

CREATE TABLE public.workspace_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  linked_user_id uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  birth_date date,
  notes text,
  created_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_clients_name_len CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  CONSTRAINT workspace_clients_notes_len CHECK (notes IS NULL OR char_length(notes) <= 2000),
  CONSTRAINT workspace_clients_email_lowercase CHECK (email IS NULL OR email = lower(email)),
  CONSTRAINT workspace_clients_email_format
    CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT workspace_clients_phone_br
    CHECK (
      phone IS NULL
      OR (
        phone ~ '^\+55[0-9]+$'
        AND (
          substr(phone, 4) ~ '^[1-9][0-9]9[0-9]{8}$'
          OR substr(phone, 4) ~ '^[1-9][0-9][2-9][0-9]{7}$'
        )
      )
    )
);

CREATE INDEX workspace_clients_workspace_id_idx
  ON public.workspace_clients (workspace_id);
CREATE INDEX workspace_clients_workspace_active_idx
  ON public.workspace_clients (workspace_id)
  WHERE archived_at IS NULL;
CREATE INDEX workspace_clients_name_idx
  ON public.workspace_clients (workspace_id, lower(full_name));
CREATE INDEX workspace_clients_phone_idx
  ON public.workspace_clients (workspace_id, phone);
CREATE INDEX workspace_clients_email_idx
  ON public.workspace_clients (workspace_id, email);
CREATE INDEX workspace_clients_linked_user_id_idx
  ON public.workspace_clients (linked_user_id);
CREATE INDEX workspace_clients_created_by_idx
  ON public.workspace_clients (created_by);

COMMENT ON TABLE public.workspace_clients IS
  'Cadastro interno de clientes do estabelecimento. Distinto de client_profiles (conta autenticada /cliente).';
COMMENT ON COLUMN public.workspace_clients.linked_user_id IS
  'Ligação futura com a conta Agendê. Imutável via frontend; só SECURITY DEFINER pode preencher.';
