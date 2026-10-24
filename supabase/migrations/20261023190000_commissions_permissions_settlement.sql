-- Comissões, fechamento do atendimento e permissões individuais.
-- Não altera assinatura, Checkout, webhook ou tabelas de billing Stripe.
-- Decisões de dinheiro: docs/commissions/phase1-decisions.md
-- Aplicar só em banco local ou staging isolado. Não executar em produção por este arquivo sozinho.

CREATE TYPE public.commission_release_policy AS ENUM ('on_completion', 'on_receipt');
CREATE TYPE public.commission_status AS ENUM ('pending', 'released', 'paid', 'adjusted');
CREATE TYPE public.commission_payment_direction AS ENUM ('payout', 'recovery');

ALTER TABLE public.workspace_settings
  ADD COLUMN commission_release_policy public.commission_release_policy NOT NULL DEFAULT 'on_receipt';

COMMENT ON COLUMN public.workspace_settings.commission_release_policy IS
  'on_receipt (padrão) libera comissão conforme o dinheiro entra. on_completion libera na conclusão. O valor fica copiado em cada comissão.';

ALTER TABLE public.financial_entries
  ADD COLUMN linked_settlement_id uuid;

COMMENT ON COLUMN public.financial_entries.linked_settlement_id IS
  'Preenchido quando a entrada nasce do fechamento do atendimento. Valor e descrição não podem ser reescritos.';

CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  professional_member_id uuid NOT NULL,
  service_id uuid,
  rate_bps integer NOT NULL,
  effective_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  effective_to timestamptz,
  created_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_rules_rate CHECK (rate_bps BETWEEN 0 AND 10000),
  CONSTRAINT commission_rules_window CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CONSTRAINT commission_rules_professional_fk
    FOREIGN KEY (professional_member_id, workspace_id)
    REFERENCES public.professional_profiles (member_id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT commission_rules_service_fk
    FOREIGN KEY (service_id, workspace_id)
    REFERENCES public.services (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT commission_rules_id_workspace_key UNIQUE (id, workspace_id)
);

CREATE UNIQUE INDEX commission_rules_open_default_idx
  ON public.commission_rules (workspace_id, professional_member_id)
  WHERE service_id IS NULL AND effective_to IS NULL;
CREATE UNIQUE INDEX commission_rules_open_service_idx
  ON public.commission_rules (workspace_id, professional_member_id, service_id)
  WHERE service_id IS NOT NULL AND effective_to IS NULL;
CREATE INDEX commission_rules_lookup_idx
  ON public.commission_rules (workspace_id, professional_member_id, effective_from DESC);
CREATE INDEX commission_rules_service_idx ON public.commission_rules (service_id, workspace_id);
CREATE INDEX commission_rules_created_by_idx ON public.commission_rules (created_by);

COMMENT ON TABLE public.commission_rules IS
  'Percentual vigente. service_id nulo é o padrão da profissional. A regra específica do serviço prevalece. Taxa antiga não é editada: a vigência é encerrada e nasce outra linha.';

CREATE TABLE public.appointment_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  professional_member_id uuid NOT NULL,
  service_id uuid NOT NULL,
  list_price_cents integer NOT NULL,
  discount_cents integer NOT NULL DEFAULT 0,
  amount_due_cents integer NOT NULL,
  product_total_cents integer NOT NULL DEFAULT 0,
  release_policy public.commission_release_policy NOT NULL,
  commission_rule_id uuid,
  commission_rate_bps integer NOT NULL DEFAULT 0,
  commission_eligible_cents integer NOT NULL DEFAULT 0,
  commission_cents integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_settlements_key_len CHECK (char_length(idempotency_key) BETWEEN 8 AND 120),
  CONSTRAINT appointment_settlements_money CHECK (
    list_price_cents >= 0 AND list_price_cents <= 10000000
    AND discount_cents >= 0 AND discount_cents <= list_price_cents
    AND amount_due_cents = list_price_cents - discount_cents
    AND product_total_cents >= 0 AND product_total_cents <= 1000000000
    AND commission_rate_bps BETWEEN 0 AND 10000
    AND commission_eligible_cents >= 0 AND commission_eligible_cents <= amount_due_cents
    AND commission_cents >= 0 AND commission_cents <= commission_eligible_cents
  ),
  CONSTRAINT appointment_settlements_appointment_fk
    FOREIGN KEY (appointment_id, workspace_id)
    REFERENCES public.appointments (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT appointment_settlements_professional_fk
    FOREIGN KEY (professional_member_id, workspace_id)
    REFERENCES public.professional_profiles (member_id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT appointment_settlements_service_fk
    FOREIGN KEY (service_id, workspace_id)
    REFERENCES public.services (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT appointment_settlements_rule_fk
    FOREIGN KEY (commission_rule_id, workspace_id)
    REFERENCES public.commission_rules (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT appointment_settlements_id_workspace_key UNIQUE (id, workspace_id),
  CONSTRAINT appointment_settlements_appointment_unique UNIQUE (appointment_id),
  CONSTRAINT appointment_settlements_key_unique UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX appointment_settlements_professional_idx
  ON public.appointment_settlements (professional_member_id, workspace_id);
CREATE INDEX appointment_settlements_rule_idx
  ON public.appointment_settlements (commission_rule_id, workspace_id);
CREATE INDEX appointment_settlements_created_by_idx ON public.appointment_settlements (created_by);

CREATE TABLE public.appointment_settlement_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  settlement_id uuid NOT NULL,
  product_id uuid NOT NULL,
  quantity numeric(12, 3) NOT NULL,
  unit_price_cents integer NOT NULL,
  line_total_cents integer NOT NULL,
  financial_entry_id uuid,
  stock_restored boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointment_settlement_products_quantity CHECK (quantity > 0),
  CONSTRAINT appointment_settlement_products_price CHECK (
    unit_price_cents > 0 AND unit_price_cents <= 10000000
    AND line_total_cents > 0 AND line_total_cents <= 1000000000
  ),
  CONSTRAINT appointment_settlement_products_settlement_fk
    FOREIGN KEY (settlement_id, workspace_id)
    REFERENCES public.appointment_settlements (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT appointment_settlement_products_product_fk
    FOREIGN KEY (product_id, workspace_id)
    REFERENCES public.inventory_products (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT appointment_settlement_products_entry_fk
    FOREIGN KEY (financial_entry_id, workspace_id)
    REFERENCES public.financial_entries (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT appointment_settlement_products_unique UNIQUE (settlement_id, product_id)
);

CREATE INDEX appointment_settlement_products_workspace_idx
  ON public.appointment_settlement_products (workspace_id);
CREATE INDEX appointment_settlement_products_product_idx
  ON public.appointment_settlement_products (product_id, workspace_id);
CREATE INDEX appointment_settlement_products_entry_idx
  ON public.appointment_settlement_products (financial_entry_id, workspace_id);

ALTER TABLE public.financial_entries
  ADD CONSTRAINT financial_entries_settlement_fk
  FOREIGN KEY (linked_settlement_id, workspace_id)
  REFERENCES public.appointment_settlements (id, workspace_id) ON DELETE RESTRICT;

CREATE INDEX financial_entries_linked_settlement_idx
  ON public.financial_entries (linked_settlement_id, workspace_id);

CREATE TABLE public.financial_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  financial_entry_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  payment_method public.payment_method NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text,
  created_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financial_receipts_amount CHECK (amount_cents > 0 AND amount_cents <= 1000000000),
  CONSTRAINT financial_receipts_key_len CHECK (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 8 AND 120),
  CONSTRAINT financial_receipts_entry_fk
    FOREIGN KEY (financial_entry_id, workspace_id)
    REFERENCES public.financial_entries (id, workspace_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX financial_receipts_idempotency_idx
  ON public.financial_receipts (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX financial_receipts_entry_idx
  ON public.financial_receipts (financial_entry_id, workspace_id);
CREATE INDEX financial_receipts_workspace_received_idx
  ON public.financial_receipts (workspace_id, received_at DESC);
CREATE INDEX financial_receipts_created_by_idx ON public.financial_receipts (created_by);

COMMENT ON TABLE public.financial_receipts IS
  'Dinheiro efetivamente recebido. A entrada continua guardando o valor devido. Vários recebimentos podem quitar a mesma entrada.';

CREATE TABLE public.commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL,
  settlement_id uuid,
  professional_member_id uuid NOT NULL,
  rule_id uuid,
  release_policy public.commission_release_policy NOT NULL,
  rate_bps integer NOT NULL,
  eligible_cents integer NOT NULL,
  original_commission_cents integer NOT NULL,
  current_commission_cents integer NOT NULL,
  released_cents integer NOT NULL DEFAULT 0,
  paid_cents integer NOT NULL DEFAULT 0,
  manual_ceiling_cents integer,
  status public.commission_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_entries_money CHECK (
    rate_bps BETWEEN 0 AND 10000
    AND eligible_cents > 0
    AND original_commission_cents > 0
    AND original_commission_cents <= eligible_cents
    AND current_commission_cents >= 0
    AND current_commission_cents <= original_commission_cents
    AND released_cents >= 0
    AND released_cents <= current_commission_cents
    AND paid_cents >= 0
    AND (manual_ceiling_cents IS NULL OR (manual_ceiling_cents >= 0 AND manual_ceiling_cents <= original_commission_cents))
  ),
  CONSTRAINT commission_entries_appointment_unique UNIQUE (appointment_id),
  CONSTRAINT commission_entries_appointment_fk
    FOREIGN KEY (appointment_id, workspace_id)
    REFERENCES public.appointments (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT commission_entries_settlement_fk
    FOREIGN KEY (settlement_id, workspace_id)
    REFERENCES public.appointment_settlements (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT commission_entries_professional_fk
    FOREIGN KEY (professional_member_id, workspace_id)
    REFERENCES public.professional_profiles (member_id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT commission_entries_rule_fk
    FOREIGN KEY (rule_id, workspace_id)
    REFERENCES public.commission_rules (id, workspace_id) ON DELETE RESTRICT,
  CONSTRAINT commission_entries_id_workspace_key UNIQUE (id, workspace_id)
);

CREATE UNIQUE INDEX commission_entries_settlement_unique
  ON public.commission_entries (settlement_id)
  WHERE settlement_id IS NOT NULL;
CREATE INDEX commission_entries_professional_idx
  ON public.commission_entries (professional_member_id, workspace_id);
CREATE INDEX commission_entries_workspace_status_idx
  ON public.commission_entries (workspace_id, status, created_at DESC);
CREATE INDEX commission_entries_rule_idx ON public.commission_entries (rule_id, workspace_id);

CREATE TABLE public.commission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  commission_id uuid NOT NULL,
  event_type text NOT NULL,
  note text,
  current_cents integer NOT NULL,
  released_cents integer NOT NULL,
  paid_cents integer NOT NULL,
  actor_user_id uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_events_type CHECK (event_type IN (
    'calculated', 'money_sync', 'adjustment', 'payment', 'recovery', 'beneficiary_changed'
  )),
  CONSTRAINT commission_events_note_len CHECK (note IS NULL OR char_length(note) BETWEEN 3 AND 500),
  CONSTRAINT commission_events_money CHECK (
    current_cents >= 0 AND released_cents >= 0 AND paid_cents >= 0
  ),
  CONSTRAINT commission_events_commission_fk
    FOREIGN KEY (commission_id, workspace_id)
    REFERENCES public.commission_entries (id, workspace_id) ON DELETE RESTRICT
);

CREATE INDEX commission_events_commission_idx
  ON public.commission_events (commission_id, created_at);
CREATE INDEX commission_events_workspace_idx
  ON public.commission_events (workspace_id, created_at DESC);
CREATE INDEX commission_events_actor_idx ON public.commission_events (actor_user_id);

CREATE TABLE public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  commission_id uuid NOT NULL,
  direction public.commission_payment_direction NOT NULL,
  amount_cents integer NOT NULL,
  paid_on date NOT NULL,
  note text,
  idempotency_key text,
  created_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_payments_amount CHECK (amount_cents > 0 AND amount_cents <= 1000000000),
  CONSTRAINT commission_payments_note_len CHECK (note IS NULL OR char_length(btrim(note)) BETWEEN 3 AND 200),
  CONSTRAINT commission_payments_key_len CHECK (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 8 AND 120),
  CONSTRAINT commission_payments_commission_fk
    FOREIGN KEY (commission_id, workspace_id)
    REFERENCES public.commission_entries (id, workspace_id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX commission_payments_idempotency_idx
  ON public.commission_payments (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX commission_payments_commission_idx
  ON public.commission_payments (commission_id, paid_on DESC);
CREATE INDEX commission_payments_workspace_idx
  ON public.commission_payments (workspace_id, paid_on DESC);
CREATE INDEX commission_payments_created_by_idx ON public.commission_payments (created_by);

CREATE TABLE public.workspace_member_permissions (
  member_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  permission_key text NOT NULL,
  effect text NOT NULL,
  created_by uuid REFERENCES public.profiles (user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, permission_key),
  CONSTRAINT workspace_member_permissions_effect CHECK (effect IN ('grant', 'deny')),
  CONSTRAINT workspace_member_permissions_key CHECK (permission_key IN (
    'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.reschedule', 'appointments.cancel',
    'clients.view', 'clients.manage',
    'inventory.view', 'inventory.move', 'inventory.manage',
    'finance.view', 'finance.manage', 'finance.receive',
    'reports.view',
    'commissions.view_own', 'commissions.manage_team', 'commissions.pay'
  )),
  CONSTRAINT workspace_member_permissions_member_fk
    FOREIGN KEY (member_id, workspace_id)
    REFERENCES public.workspace_members (id, workspace_id) ON DELETE CASCADE
);

CREATE INDEX workspace_member_permissions_workspace_idx
  ON public.workspace_member_permissions (workspace_id);
CREATE INDEX workspace_member_permissions_created_by_idx
  ON public.workspace_member_permissions (created_by);

COMMENT ON TABLE public.workspace_member_permissions IS
  'Override individual. Sem linha, vale o padrão do papel. A proprietária ignora esta tabela e não pode ser restringida. Não usa user_metadata.';

-- Matemática de centavos. Sem ponto flutuante.
CREATE OR REPLACE FUNCTION app.percent_of_cents(p_base integer, p_rate_bps integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_base IS NULL OR p_rate_bps IS NULL OR p_base <= 0 OR p_rate_bps <= 0 THEN 0
    WHEN p_rate_bps >= 10000 THEN p_base
    ELSE (((p_base::bigint * p_rate_bps::bigint) + 5000) / 10000)::integer
  END;
$$;

CREATE OR REPLACE FUNCTION app.prorate_cents(p_amount integer, p_part integer, p_whole integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_amount IS NULL OR p_part IS NULL OR p_whole IS NULL OR p_amount <= 0 OR p_part <= 0 OR p_whole <= 0 THEN 0
    WHEN p_part >= p_whole THEN p_amount
    ELSE (((p_amount::bigint * p_part::bigint) + (p_whole::bigint / 2)) / p_whole::bigint)::integer
  END;
$$;

CREATE OR REPLACE FUNCTION app.permission_keys()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT ARRAY[
    'appointments.view', 'appointments.create', 'appointments.edit', 'appointments.reschedule', 'appointments.cancel',
    'clients.view', 'clients.manage',
    'inventory.view', 'inventory.move', 'inventory.manage',
    'finance.view', 'finance.manage', 'finance.receive',
    'reports.view',
    'commissions.view_own', 'commissions.manage_team', 'commissions.pay'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION app.permission_default(p_role public.member_role, p_key text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_key
    WHEN 'appointments.view' THEN true
    WHEN 'appointments.create' THEN true
    WHEN 'appointments.edit' THEN true
    WHEN 'appointments.reschedule' THEN true
    WHEN 'appointments.cancel' THEN true
    WHEN 'clients.view' THEN true
    WHEN 'clients.manage' THEN true
    WHEN 'inventory.view' THEN true
    WHEN 'inventory.move' THEN p_role IN ('owner'::public.member_role, 'admin'::public.member_role, 'receptionist'::public.member_role)
    WHEN 'inventory.manage' THEN p_role IN ('owner'::public.member_role, 'admin'::public.member_role)
    WHEN 'finance.view' THEN p_role IN ('owner'::public.member_role, 'admin'::public.member_role)
    WHEN 'finance.manage' THEN p_role IN ('owner'::public.member_role, 'admin'::public.member_role)
    WHEN 'finance.receive' THEN p_role IN ('owner'::public.member_role, 'admin'::public.member_role, 'receptionist'::public.member_role)
    WHEN 'reports.view' THEN p_role IN ('owner'::public.member_role, 'admin'::public.member_role)
    WHEN 'commissions.view_own' THEN p_role IN ('owner'::public.member_role, 'admin'::public.member_role, 'professional'::public.member_role)
    WHEN 'commissions.manage_team' THEN p_role IN ('owner'::public.member_role, 'admin'::public.member_role)
    WHEN 'commissions.pay' THEN p_role IN ('owner'::public.member_role, 'admin'::public.member_role)
    ELSE false
  END;
$$;

-- Fonte de autorização: membro ativo. user_metadata do JWT é ignorado de propósito.
CREATE OR REPLACE FUNCTION app.member_has_permission(p_workspace_id uuid, p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role public.member_role;
  v_member_id uuid;
  v_effect text;
BEGIN
  IF p_workspace_id IS NULL OR p_key IS NULL OR NOT (p_key = ANY (app.permission_keys())) THEN
    RETURN false;
  END IF;

  SELECT m.id, m.role
    INTO v_member_id, v_role
  FROM public.workspace_members m
  WHERE m.workspace_id = p_workspace_id
    AND m.user_id = (SELECT auth.uid())
    AND m.status = 'active'::public.member_status;

  IF v_member_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_role = 'owner'::public.member_role THEN
    RETURN true;
  END IF;

  SELECT p.effect
    INTO v_effect
  FROM public.workspace_member_permissions p
  WHERE p.member_id = v_member_id
    AND p.workspace_id = p_workspace_id
    AND p.permission_key = p_key;

  IF v_effect = 'deny' THEN
    RETURN false;
  ELSIF v_effect = 'grant' THEN
    RETURN true;
  END IF;

  RETURN app.permission_default(v_role, p_key);
END;
$$;

CREATE OR REPLACE FUNCTION app.assert_member_permission(p_workspace_id uuid, p_key text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.require_confirmed_email();
  PERFORM app.assert_workspace_entitled(p_workspace_id);
  IF NOT app.member_has_permission(p_workspace_id, p_key) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.assert_finance_manager(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.assert_member_permission(p_workspace_id, 'finance.manage');
END;
$$;

CREATE OR REPLACE FUNCTION app.assert_finance_operator(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.require_confirmed_email();
  PERFORM app.assert_workspace_entitled(p_workspace_id);
  IF NOT (
    app.member_has_permission(p_workspace_id, 'finance.receive')
    OR app.member_has_permission(p_workspace_id, 'finance.manage')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.assert_report_reader(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.require_confirmed_email();
  PERFORM app.assert_workspace_entitled(p_workspace_id);
  IF NOT (
    app.member_has_permission(p_workspace_id, 'reports.view')
    OR app.member_has_permission(p_workspace_id, 'finance.manage')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.assert_inventory_manager(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.assert_workspace_entitled(p_workspace_id);
  IF NOT app.member_has_permission(p_workspace_id, 'inventory.manage') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.assert_inventory_mover(
  p_workspace_id uuid,
  p_type public.inventory_movement_type
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.assert_workspace_entitled(p_workspace_id);
  IF p_type = 'adjustment'::public.inventory_movement_type THEN
    PERFORM app.assert_inventory_manager(p_workspace_id);
    RETURN;
  END IF;
  IF NOT (
    app.member_has_permission(p_workspace_id, 'inventory.move')
    OR app.member_has_permission(p_workspace_id, 'inventory.manage')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION app.resolve_commission_rule(
  p_workspace_id uuid,
  p_professional_member_id uuid,
  p_service_id uuid,
  p_at timestamptz
)
RETURNS TABLE (rule_id uuid, rate_bps integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT r.id, r.rate_bps
  FROM public.commission_rules r
  WHERE r.workspace_id = p_workspace_id
    AND r.professional_member_id = p_professional_member_id
    AND r.effective_from <= p_at
    AND (r.effective_to IS NULL OR r.effective_to > p_at)
    AND (r.service_id = p_service_id OR r.service_id IS NULL)
  ORDER BY (r.service_id IS NOT NULL) DESC, r.effective_from DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION app.sync_appointment_commission(
  p_appointment_id uuid,
  p_event text DEFAULT 'money_sync',
  p_note text DEFAULT NULL,
  p_create boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_settlement public.appointment_settlements%ROWTYPE;
  v_entry public.financial_entries%ROWTYPE;
  v_commission public.commission_entries%ROWTYPE;
  v_rule record;
  v_eligible integer;
  v_rate integer := 0;
  v_rule_id uuid;
  v_original integer := 0;
  v_policy public.commission_release_policy;
  v_due integer := 0;
  v_refunded integer := 0;
  v_received integer := 0;
  v_retained integer := 0;
  v_net integer := 0;
  v_contract integer := 0;
  v_current integer := 0;
  v_released integer := 0;
  v_paid integer := 0;
  v_status public.commission_status;
  v_package boolean := false;
BEGIN
  IF p_event IS NULL OR p_event NOT IN (
    'calculated', 'money_sync', 'adjustment', 'payment', 'recovery', 'beneficiary_changed'
  ) THEN
    RAISE EXCEPTION 'invalid_commission_event' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF v_appt.id IS NULL OR v_appt.status <> 'completed'::public.appointment_status THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_settlement
  FROM public.appointment_settlements
  WHERE appointment_id = v_appt.id
  FOR UPDATE;

  SELECT * INTO v_entry
  FROM public.financial_entries
  WHERE appointment_id = v_appt.id
    AND source = 'appointment'::public.financial_entry_source
  FOR UPDATE;

  SELECT EXISTS (
    SELECT 1
    FROM public.package_redemptions pr
    WHERE pr.appointment_id = v_appt.id
      AND pr.reversed_at IS NULL
  ) INTO v_package;

  SELECT * INTO v_commission
  FROM public.commission_entries
  WHERE appointment_id = v_appt.id
  FOR UPDATE;

  IF v_commission.id IS NULL THEN
    IF NOT p_create OR v_package THEN
      RETURN NULL;
    END IF;

    IF v_settlement.id IS NOT NULL THEN
      v_eligible := v_settlement.commission_eligible_cents;
      v_rate := v_settlement.commission_rate_bps;
      v_rule_id := v_settlement.commission_rule_id;
      v_original := v_settlement.commission_cents;
      v_policy := v_settlement.release_policy;
    ELSE
      v_eligible := CASE
        WHEN v_entry.id IS NULL OR v_entry.status = 'cancelled'::public.financial_entry_status THEN 0
        ELSE v_entry.amount_cents
      END;
      SELECT r.rule_id, r.rate_bps INTO v_rule
      FROM app.resolve_commission_rule(
        v_appt.workspace_id, v_appt.professional_member_id, v_appt.service_id, clock_timestamp()
      ) r;
      v_rule_id := v_rule.rule_id;
      v_rate := COALESCE(v_rule.rate_bps, 0);
      v_original := app.percent_of_cents(v_eligible, v_rate);
      SELECT s.commission_release_policy INTO v_policy
      FROM public.workspace_settings s
      WHERE s.workspace_id = v_appt.workspace_id;
      v_policy := COALESCE(v_policy, 'on_receipt'::public.commission_release_policy);
    END IF;

    IF v_original <= 0 OR v_eligible <= 0 THEN
      RETURN NULL;
    END IF;

    INSERT INTO public.commission_entries (
      workspace_id, appointment_id, settlement_id, professional_member_id, rule_id,
      release_policy, rate_bps, eligible_cents, original_commission_cents,
      current_commission_cents, released_cents, paid_cents, status
    ) VALUES (
      v_appt.workspace_id, v_appt.id, v_settlement.id,
      COALESCE(v_settlement.professional_member_id, v_appt.professional_member_id),
      v_rule_id, v_policy, v_rate, v_eligible, v_original,
      v_original, 0, 0, 'pending'::public.commission_status
    )
    RETURNING * INTO v_commission;

    p_event := 'calculated';
  END IF;

  v_due := v_commission.eligible_cents;
  IF v_entry.id IS NOT NULL THEN
    SELECT COALESCE(SUM(r.amount_cents), 0)::integer INTO v_refunded
    FROM public.financial_refunds r
    WHERE r.financial_entry_id = v_entry.id
      AND r.workspace_id = v_entry.workspace_id;
    SELECT COALESCE(SUM(r.amount_cents), 0)::integer INTO v_received
    FROM public.financial_receipts r
    WHERE r.financial_entry_id = v_entry.id
      AND r.workspace_id = v_entry.workspace_id;
  END IF;

  IF v_package OR v_entry.id IS NULL OR v_entry.status = 'cancelled'::public.financial_entry_status THEN
    v_retained := 0;
    v_net := 0;
  ELSE
    v_retained := GREATEST(v_due - LEAST(v_refunded, v_due), 0);
    v_net := GREATEST(LEAST(v_received - v_refunded, v_retained), 0);
  END IF;

  v_contract := app.prorate_cents(v_commission.original_commission_cents, v_retained, v_commission.eligible_cents);
  v_current := CASE
    WHEN v_commission.manual_ceiling_cents IS NULL THEN v_contract
    ELSE LEAST(v_contract, v_commission.manual_ceiling_cents)
  END;

  IF v_commission.release_policy = 'on_completion'::public.commission_release_policy THEN
    v_released := v_current;
  ELSE
    v_released := app.prorate_cents(v_current, v_net, v_retained);
  END IF;

  SELECT COALESCE(SUM(
    CASE
      WHEN direction = 'payout'::public.commission_payment_direction THEN amount_cents
      ELSE -amount_cents
    END
  ), 0)::integer INTO v_paid
  FROM public.commission_payments
  WHERE commission_id = v_commission.id
    AND workspace_id = v_commission.workspace_id;

  IF v_paid < 0 THEN
    v_paid := 0;
  END IF;

  IF v_paid > v_current THEN
    v_status := 'adjusted'::public.commission_status;
  ELSIF v_current > 0 AND v_paid = v_current AND v_released = v_current THEN
    v_status := 'paid'::public.commission_status;
  ELSIF v_current IS DISTINCT FROM v_commission.original_commission_cents THEN
    v_status := 'adjusted'::public.commission_status;
  ELSIF v_released > v_paid THEN
    v_status := 'released'::public.commission_status;
  ELSE
    v_status := 'pending'::public.commission_status;
  END IF;

  IF v_commission.current_commission_cents IS DISTINCT FROM v_current
     OR v_commission.released_cents IS DISTINCT FROM v_released
     OR v_commission.paid_cents IS DISTINCT FROM v_paid
     OR v_commission.status IS DISTINCT FROM v_status
     OR p_event = 'calculated' THEN
    UPDATE public.commission_entries
    SET current_commission_cents = v_current,
        released_cents = v_released,
        paid_cents = v_paid,
        status = v_status
    WHERE id = v_commission.id;

    INSERT INTO public.commission_events (
      workspace_id, commission_id, event_type, note, current_cents, released_cents, paid_cents, actor_user_id
    ) VALUES (
      v_commission.workspace_id, v_commission.id, p_event, NULLIF(btrim(COALESCE(p_note, '')), ''),
      v_current, v_released, v_paid, auth.uid()
    );
  END IF;

  RETURN v_commission.id;
END;
$$;
