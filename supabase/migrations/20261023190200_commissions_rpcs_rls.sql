-- RPCs, fechamento corrigido (total de produtos gravado uma vez) e RLS.
-- Substitui o corpo de complete_appointment_checkout da migration anterior.

CREATE OR REPLACE FUNCTION app.sync_commission_from_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_received integer;
  v_gap integer;
  v_line public.appointment_settlement_products%ROWTYPE;
BEGIN
  IF NEW.source = 'appointment'::public.financial_entry_source
     AND NEW.appointment_id IS NOT NULL
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'paid'::public.financial_entry_status
       AND NEW.entry_type = 'income'::public.financial_entry_type
       AND NEW.payment_method IS NOT NULL THEN
      SELECT COALESCE(SUM(r.amount_cents), 0)::integer INTO v_received
      FROM public.financial_receipts r
      WHERE r.financial_entry_id = NEW.id
        AND r.workspace_id = NEW.workspace_id;
      v_gap := NEW.amount_cents - v_received;
      IF v_gap > 0 THEN
        INSERT INTO public.financial_receipts (
          workspace_id, financial_entry_id, amount_cents, payment_method, received_at, created_by, idempotency_key
        ) VALUES (
          NEW.workspace_id, NEW.id, v_gap, NEW.payment_method,
          COALESCE(NEW.paid_at, clock_timestamp()), auth.uid(), 'paid:' || NEW.id::text
        );
      END IF;
    END IF;
    PERFORM app.sync_appointment_commission(NEW.appointment_id, 'money_sync', NULL, false);
  END IF;

  IF NEW.linked_settlement_id IS NOT NULL
     AND NEW.appointment_id IS NULL
     AND NEW.status = 'cancelled'::public.financial_entry_status
     AND OLD.status = 'pending'::public.financial_entry_status THEN
    SELECT * INTO v_line
    FROM public.appointment_settlement_products
    WHERE financial_entry_id = NEW.id
      AND workspace_id = NEW.workspace_id
    FOR UPDATE;
    IF v_line.id IS NOT NULL AND NOT v_line.stock_restored THEN
      PERFORM app.apply_inventory_movement(
        NEW.workspace_id, v_line.product_id, 'entry'::public.inventory_movement_type,
        v_line.quantity, NULL, 'Devolução do produto vendido no atendimento'
      );
      UPDATE public.appointment_settlement_products
      SET stock_restored = true
      WHERE id = v_line.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.complete_appointment_checkout(
  p_appointment_id uuid,
  p_idempotency_key text,
  p_discount_cents integer DEFAULT 0,
  p_products jsonb DEFAULT '[]'::jsonb,
  p_receive_cents integer DEFAULT 0,
  p_payment_method public.payment_method DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_actor public.workspace_members;
  v_existing public.appointment_settlements%ROWTYPE;
  v_key text := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_discount integer := COALESCE(p_discount_cents, 0);
  v_receive integer := COALESCE(p_receive_cents, 0);
  v_due integer;
  v_policy public.commission_release_policy;
  v_rule record;
  v_rate integer := 0;
  v_eligible integer;
  v_commission integer;
  v_settlement_id uuid;
  v_product_total integer := 0;
  v_lines jsonb := '[]'::jsonb;
  v_item record;
  v_name text;
  v_line integer;
  v_entry_id uuid;
  v_service_entry public.financial_entries%ROWTYPE;
  v_left integer;
  v_slice integer;
  v_product_entry public.financial_entries%ROWTYPE;
BEGIN
  IF v_key IS NULL OR char_length(v_key) NOT BETWEEN 8 AND 80 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_products, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(COALESCE(p_products, '[]'::jsonb)) > 20 THEN
    RAISE EXCEPTION 'invalid_products' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'appointment_not_found' USING ERRCODE = '22023';
  END IF;

  v_actor := app.actor_member(v_appt.workspace_id);
  IF NOT app.can_write_appointment(v_appt.workspace_id, v_appt.professional_member_id) THEN
    RAISE EXCEPTION 'appointment_write_denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM public.appointment_settlements
  WHERE workspace_id = v_appt.workspace_id AND idempotency_key = v_key;
  IF v_existing.id IS NOT NULL AND v_existing.appointment_id <> v_appt.id THEN
    RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_existing FROM public.appointment_settlements WHERE appointment_id = v_appt.id;
  IF v_existing.id IS NOT NULL THEN
    RETURN app.appointment_checkout_summary(v_appt.id, true);
  END IF;

  PERFORM app.assert_member_permission(v_appt.workspace_id, 'appointments.edit');
  PERFORM app.assert_status_transition(v_appt.status, 'completed'::public.appointment_status, v_actor.role);

  IF v_discount < 0 OR v_discount > v_appt.price_cents OR v_receive < 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;
  v_due := v_appt.price_cents - v_discount;

  IF jsonb_array_length(COALESCE(p_products, '[]'::jsonb)) > 0 AND NOT (
    app.member_has_permission(v_appt.workspace_id, 'inventory.move')
    OR app.member_has_permission(v_appt.workspace_id, 'inventory.manage')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF v_receive > 0 AND p_payment_method IS NULL THEN
    RAISE EXCEPTION 'payment_method_required' USING ERRCODE = '22023';
  END IF;
  IF v_receive > 0 AND NOT (
    app.member_has_permission(v_appt.workspace_id, 'finance.receive')
    OR app.member_has_permission(v_appt.workspace_id, 'finance.manage')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF (
    SELECT COUNT(*) <> COUNT(DISTINCT x.product_id)
    FROM jsonb_to_recordset(COALESCE(p_products, '[]'::jsonb)) AS x(product_id uuid, quantity numeric, unit_price_cents integer)
  ) THEN
    RAISE EXCEPTION 'invalid_products' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN
    SELECT product_id, quantity, unit_price_cents
    FROM jsonb_to_recordset(COALESCE(p_products, '[]'::jsonb)) AS x(product_id uuid, quantity numeric, unit_price_cents integer) ORDER BY product_id
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity IS NULL OR v_item.unit_price_cents IS NULL
       OR v_item.quantity <= 0 OR v_item.unit_price_cents <= 0 OR v_item.unit_price_cents > 10000000 THEN
      RAISE EXCEPTION 'invalid_products' USING ERRCODE = '22023';
    END IF;
    SELECT btrim(p.name) INTO v_name
    FROM public.inventory_products p
    WHERE p.id = v_item.product_id
      AND p.workspace_id = v_appt.workspace_id
      AND p.archived_at IS NULL
      AND p.active;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'invalid_products' USING ERRCODE = '22023';
    END IF;
    IF v_item.quantity<>round(v_item.quantity,3) THEN RAISE EXCEPTION 'invalid_products' USING ERRCODE='22023'; END IF;
    v_line := round(v_item.quantity * v_item.unit_price_cents)::integer;
    IF v_line <= 0 OR v_line > 1000000000 THEN
      RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
    END IF;
    v_product_total := v_product_total + v_line;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_item.product_id,
      'quantity', v_item.quantity,
      'unit_price_cents', v_item.unit_price_cents,
      'line_total_cents', v_line,
      'name', v_name
    ));
  END LOOP;

  IF v_receive > v_due + v_product_total THEN
    RAISE EXCEPTION 'receipt_exceeds_due' USING ERRCODE = '22023';
  END IF;

  SELECT s.commission_release_policy INTO v_policy
  FROM public.workspace_settings s WHERE s.workspace_id = v_appt.workspace_id;
  v_policy := COALESCE(v_policy, 'on_receipt'::public.commission_release_policy);
  SELECT r.rule_id, r.rate_bps INTO v_rule
  FROM app.resolve_commission_rule(v_appt.workspace_id, v_appt.professional_member_id, v_appt.service_id, clock_timestamp()) r;
  v_rate := COALESCE(v_rule.rate_bps, 0);
  v_eligible := v_due;
  v_commission := app.percent_of_cents(v_eligible, v_rate);

  INSERT INTO public.appointment_settlements (
    workspace_id, appointment_id, idempotency_key, professional_member_id, service_id,
    list_price_cents, discount_cents, amount_due_cents, product_total_cents, release_policy,
    commission_rule_id, commission_rate_bps, commission_eligible_cents, commission_cents, created_by
  ) VALUES (
    v_appt.workspace_id, v_appt.id, v_key, v_appt.professional_member_id, v_appt.service_id,
    v_appt.price_cents, v_discount, v_due, v_product_total, v_policy,
    v_rule.rule_id, v_rate, v_eligible, v_commission, auth.uid()
  )
  RETURNING id INTO v_settlement_id;

  FOR v_item IN
    SELECT product_id, quantity, unit_price_cents, line_total_cents, name
    FROM jsonb_to_recordset(v_lines) AS x(
      product_id uuid, quantity numeric, unit_price_cents integer, line_total_cents integer, name text
    )
  LOOP
    PERFORM app.apply_inventory_movement(
      v_appt.workspace_id, v_item.product_id, 'exit'::public.inventory_movement_type,
      v_item.quantity, NULL, 'Venda no atendimento'
    );
    INSERT INTO public.financial_entries (
      workspace_id, entry_type, status, source, description, amount_cents,
      client_id, created_by, idempotency_key, linked_settlement_id
    ) VALUES (
      v_appt.workspace_id, 'income', 'pending', 'manual',
      left('Produto: ' || v_item.name, 200),
      v_item.line_total_cents, v_appt.client_id, auth.uid(),
      left(v_key || ':p:' || v_item.product_id::text, 120), v_settlement_id
    )
    RETURNING id INTO v_entry_id;
    INSERT INTO public.appointment_settlement_products (
      workspace_id, settlement_id, product_id, quantity, unit_price_cents, line_total_cents, financial_entry_id
    ) VALUES (
      v_appt.workspace_id, v_settlement_id, v_item.product_id, v_item.quantity,
      v_item.unit_price_cents, v_item.line_total_cents, v_entry_id
    );
  END LOOP;

  UPDATE public.appointments
  SET status = 'completed'::public.appointment_status
  WHERE id = v_appt.id AND workspace_id = v_appt.workspace_id;

  v_left := v_receive;
  IF v_left > 0 AND v_due > 0 THEN
    SELECT * INTO v_service_entry
    FROM public.financial_entries
    WHERE appointment_id = v_appt.id AND source = 'appointment'::public.financial_entry_source
    FOR UPDATE;
    v_slice := LEAST(v_left, v_service_entry.amount_cents);
    PERFORM app.record_entry_receipt(v_service_entry, v_slice, p_payment_method, v_key || ':svc', clock_timestamp());
    v_left := v_left - v_slice;
  END IF;

  IF v_left > 0 THEN
    FOR v_product_entry IN
      SELECT f.*
      FROM public.financial_entries f
      JOIN public.appointment_settlement_products sp ON sp.financial_entry_id = f.id
      WHERE sp.settlement_id = v_settlement_id
      ORDER BY sp.created_at, sp.id
      FOR UPDATE OF f
    LOOP
      EXIT WHEN v_left <= 0;
      v_slice := LEAST(v_left, v_product_entry.amount_cents);
      PERFORM app.record_entry_receipt(
        v_product_entry, v_slice, p_payment_method, left(v_key || ':r:' || v_product_entry.id::text, 120), clock_timestamp()
      );
      v_left := v_left - v_slice;
    END LOOP;
  END IF;

  RETURN app.appointment_checkout_summary(v_appt.id, false);
END;
$$;

CREATE OR REPLACE FUNCTION app.record_financial_receipt(
  p_workspace_id uuid,
  p_entry_id uuid,
  p_amount_cents integer,
  p_payment_method public.payment_method,
  p_idempotency_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry public.financial_entries%ROWTYPE;
BEGIN
  PERFORM app.require_confirmed_email();
  PERFORM app.assert_workspace_entitled(p_workspace_id);
  IF NOT (
    app.member_has_permission(p_workspace_id, 'finance.receive')
    OR app.member_has_permission(p_workspace_id, 'finance.manage')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_entry
  FROM public.financial_entries
  WHERE id = p_entry_id AND workspace_id = p_workspace_id
  FOR UPDATE;
  IF v_entry.id IS NULL THEN
    RAISE EXCEPTION 'financial_entry_not_found' USING ERRCODE = 'P0002';
  END IF;
  RETURN app.record_entry_receipt(v_entry, p_amount_cents, p_payment_method, p_idempotency_key, clock_timestamp());
END;
$$;

CREATE OR REPLACE FUNCTION app.set_commission_rule(
  p_workspace_id uuid,
  p_professional_member_id uuid,
  p_service_id uuid,
  p_rate_bps integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing uuid;
  v_id uuid;
BEGIN
  PERFORM app.assert_member_permission(p_workspace_id, 'commissions.manage_team');
  IF p_rate_bps IS NULL OR p_rate_bps < 0 OR p_rate_bps > 10000 THEN
    RAISE EXCEPTION 'invalid_commission_rate' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.professional_profiles
    WHERE member_id = p_professional_member_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'professional_not_found' USING ERRCODE = '22023';
  END IF;
  IF p_service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.services WHERE id = p_service_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'service_not_found' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_existing
  FROM public.commission_rules
  WHERE workspace_id = p_workspace_id
    AND professional_member_id = p_professional_member_id
    AND service_id IS NOT DISTINCT FROM p_service_id
    AND effective_to IS NULL
    AND rate_bps = p_rate_bps;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  UPDATE public.commission_rules
  SET effective_to = clock_timestamp()
  WHERE workspace_id = p_workspace_id
    AND professional_member_id = p_professional_member_id
    AND service_id IS NOT DISTINCT FROM p_service_id
    AND effective_to IS NULL;

  INSERT INTO public.commission_rules (
    workspace_id, professional_member_id, service_id, rate_bps, effective_from, created_by
  ) VALUES (
    p_workspace_id, p_professional_member_id, p_service_id, p_rate_bps, clock_timestamp(), auth.uid()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.set_commission_release_policy(
  p_workspace_id uuid,
  p_policy public.commission_release_policy
)
RETURNS public.commission_release_policy
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.assert_member_permission(p_workspace_id, 'commissions.manage_team');
  IF p_policy IS NULL THEN
    RAISE EXCEPTION 'invalid_commission_policy' USING ERRCODE = '22023';
  END IF;
  UPDATE public.workspace_settings
  SET commission_release_policy = p_policy
  WHERE workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace_settings_missing' USING ERRCODE = 'P0001';
  END IF;
  RETURN p_policy;
END;
$$;

CREATE OR REPLACE FUNCTION app.get_commission_settings(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_policy public.commission_release_policy;
BEGIN
  PERFORM app.assert_member_permission(p_workspace_id, 'commissions.manage_team');
  SELECT commission_release_policy INTO v_policy
  FROM public.workspace_settings WHERE workspace_id = p_workspace_id;
  RETURN jsonb_build_object(
    'release_policy', COALESCE(v_policy, 'on_receipt'::public.commission_release_policy),
    'rules', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'professional_member_id', r.professional_member_id,
        'professional_name', COALESCE(pp.display_name, pr.full_name),
        'service_id', r.service_id,
        'service_name', s.name,
        'rate_bps', r.rate_bps,
        'effective_from', r.effective_from
      ) ORDER BY COALESCE(pp.display_name, pr.full_name), s.name NULLS FIRST)
      FROM public.commission_rules r
      JOIN public.workspace_members m ON m.id = r.professional_member_id AND m.workspace_id = r.workspace_id
      JOIN public.profiles pr ON pr.user_id = m.user_id
      LEFT JOIN public.professional_profiles pp ON pp.member_id = m.id AND pp.workspace_id = m.workspace_id
      LEFT JOIN public.services s ON s.id = r.service_id AND s.workspace_id = r.workspace_id
      WHERE r.workspace_id = p_workspace_id AND r.effective_to IS NULL
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.pay_commission(
  p_commission_id uuid,
  p_amount_cents integer,
  p_paid_on date,
  p_note text,
  p_idempotency_key text,
  p_direction public.commission_payment_direction
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_commission public.commission_entries%ROWTYPE;
  v_key text := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_existing public.commission_payments%ROWTYPE;
  v_net integer;
  v_id uuid;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF p_direction IS NULL THEN
    RAISE EXCEPTION 'invalid_commission_payment' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_commission FROM public.commission_entries WHERE id = p_commission_id FOR UPDATE;
  IF v_commission.id IS NULL THEN
    RAISE EXCEPTION 'commission_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM app.assert_member_permission(v_commission.workspace_id, 'commissions.pay');
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 OR p_paid_on IS NULL THEN
    RAISE EXCEPTION 'invalid_commission_payment' USING ERRCODE = '22023';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'invalid_commission_payment' USING ERRCODE = '22023';
  END IF;
  IF v_key IS NULL OR char_length(v_key) NOT BETWEEN 8 AND 120 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM public.commission_payments
  WHERE workspace_id = v_commission.workspace_id AND idempotency_key = v_key;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.commission_id <> v_commission.id
       OR v_existing.amount_cents <> p_amount_cents
       OR v_existing.direction <> p_direction
       OR v_existing.paid_on <> p_paid_on THEN
      RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = '22023';
    END IF;
    RETURN v_existing.id;
  END IF;

  v_net := v_commission.paid_cents;
  IF p_direction = 'payout'::public.commission_payment_direction THEN
    IF p_amount_cents > v_commission.released_cents - v_commission.paid_cents THEN
      RAISE EXCEPTION 'commission_exceeds_released' USING ERRCODE = '22023';
    END IF;
  ELSIF p_amount_cents > v_net THEN
    RAISE EXCEPTION 'commission_recovery_exceeds_paid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.commission_payments (
    workspace_id, commission_id, direction, amount_cents, paid_on, note, idempotency_key, created_by
  ) VALUES (
    v_commission.workspace_id, v_commission.id, p_direction, p_amount_cents, p_paid_on, v_note, v_key, auth.uid()
  )
  RETURNING id INTO v_id;

  PERFORM app.sync_appointment_commission(
    v_commission.appointment_id,
    CASE WHEN p_direction = 'payout'::public.commission_payment_direction THEN 'payment' ELSE 'recovery' END,
    v_note,
    false
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.adjust_commission(
  p_commission_id uuid,
  p_new_amount_cents integer,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_commission public.commission_entries%ROWTYPE;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  SELECT * INTO v_commission FROM public.commission_entries WHERE id = p_commission_id FOR UPDATE;
  IF v_commission.id IS NULL THEN
    RAISE EXCEPTION 'commission_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM app.assert_member_permission(v_commission.workspace_id, 'commissions.manage_team');
  IF p_new_amount_cents IS NULL
     OR p_new_amount_cents < 0
     OR p_new_amount_cents > v_commission.original_commission_cents
     OR v_reason IS NULL
     OR char_length(v_reason) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'invalid_commission_adjustment' USING ERRCODE = '22023';
  END IF;
  UPDATE public.commission_entries
  SET manual_ceiling_cents = p_new_amount_cents
  WHERE id = v_commission.id;
  PERFORM app.sync_appointment_commission(v_commission.appointment_id, 'adjustment', v_reason, false);
  RETURN v_commission.id;
END;
$$;

CREATE OR REPLACE FUNCTION app.reassign_commission(
  p_commission_id uuid,
  p_professional_member_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_commission public.commission_entries%ROWTYPE;
  v_reason text := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  SELECT * INTO v_commission FROM public.commission_entries WHERE id = p_commission_id FOR UPDATE;
  IF v_commission.id IS NULL THEN
    RAISE EXCEPTION 'commission_not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM app.assert_member_permission(v_commission.workspace_id, 'commissions.manage_team');
  IF v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'invalid_commission_adjustment' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.professional_profiles
    WHERE member_id = p_professional_member_id AND workspace_id = v_commission.workspace_id
  ) THEN
    RAISE EXCEPTION 'professional_not_found' USING ERRCODE = '22023';
  END IF;
  IF p_professional_member_id = v_commission.professional_member_id THEN
    RETURN v_commission.id;
  END IF;
  UPDATE public.commission_entries
  SET professional_member_id = p_professional_member_id
  WHERE id = v_commission.id;
  INSERT INTO public.commission_events (
    workspace_id, commission_id, event_type, note, current_cents, released_cents, paid_cents, actor_user_id
  ) VALUES (
    v_commission.workspace_id, v_commission.id, 'beneficiary_changed', v_reason,
    v_commission.current_commission_cents, v_commission.released_cents, v_commission.paid_cents, auth.uid()
  );
  RETURN v_commission.id;
END;
$$;

CREATE OR REPLACE FUNCTION app.get_commissions_ui(
  p_workspace_id uuid,
  p_professional_member_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid;
  v_team boolean;
  v_own boolean;
  v_filter uuid;
BEGIN
  PERFORM app.assert_workspace_entitled(p_workspace_id);
  PERFORM app.require_confirmed_email();
  v_team := app.member_has_permission(p_workspace_id, 'commissions.manage_team')
         OR app.member_has_permission(p_workspace_id, 'commissions.pay');
  v_own := app.member_has_permission(p_workspace_id, 'commissions.view_own');
  IF NOT v_team AND NOT v_own THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT m.id INTO v_actor
  FROM public.workspace_members m
  WHERE m.workspace_id = p_workspace_id
    AND m.user_id = (SELECT auth.uid())
    AND m.status = 'active'::public.member_status;

  IF v_team THEN
    v_filter := p_professional_member_id;
    IF v_filter IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.workspace_members m
      WHERE m.id = v_filter AND m.workspace_id = p_workspace_id
    ) THEN
      v_filter := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;
  ELSE
    v_filter := v_actor;
  END IF;

  RETURN jsonb_build_object(
    'viewer', CASE WHEN v_team THEN 'team' ELSE 'own' END,
    'entries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'appointment_id', c.appointment_id,
        'professional_member_id', c.professional_member_id,
        'professional_name', c.professional_name,
        'service_name', c.service_name,
        'client_name', c.client_name,
        'starts_at', c.starts_at,
        'rate_bps', c.rate_bps,
        'eligible_cents', c.eligible_cents,
        'original_cents', c.original_commission_cents,
        'current_cents', c.current_commission_cents,
        'released_cents', c.released_cents,
        'paid_cents', c.paid_cents,
        'status', c.status,
        'release_policy', c.release_policy,
        'manual_ceiling_cents', c.manual_ceiling_cents,
        'created_at', c.created_at,
        'events', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', e.id, 'event_type', e.event_type, 'note', e.note,
            'current_cents', e.current_cents, 'released_cents', e.released_cents,
            'paid_cents', e.paid_cents, 'created_at', e.created_at
          ) ORDER BY e.created_at)
          FROM public.commission_events e
          WHERE e.commission_id = c.id AND e.workspace_id = c.workspace_id
        ), '[]'::jsonb),
        'payments', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', pay.id, 'direction', pay.direction, 'amount_cents', pay.amount_cents,
            'paid_on', pay.paid_on, 'note', pay.note, 'created_at', pay.created_at
          ) ORDER BY pay.created_at)
          FROM public.commission_payments pay
          WHERE pay.commission_id = c.id AND pay.workspace_id = c.workspace_id
        ), '[]'::jsonb)
      ) ORDER BY c.created_at DESC)
      FROM (
        SELECT
          ce.id, ce.appointment_id, ce.professional_member_id, ce.workspace_id,
          ce.rate_bps, ce.eligible_cents, ce.original_commission_cents,
          ce.current_commission_cents, ce.released_cents, ce.paid_cents, ce.status,
          ce.release_policy, ce.manual_ceiling_cents, ce.created_at,
          COALESCE(pp.display_name, pr.full_name) AS professional_name,
          s.name AS service_name,
          wc.full_name AS client_name,
          a.starts_at
        FROM public.commission_entries ce
        JOIN public.appointments a ON a.id = ce.appointment_id AND a.workspace_id = ce.workspace_id
        JOIN public.services s ON s.id = a.service_id AND s.workspace_id = a.workspace_id
        JOIN public.workspace_clients wc ON wc.id = a.client_id AND wc.workspace_id = a.workspace_id
        JOIN public.workspace_members m ON m.id = ce.professional_member_id AND m.workspace_id = ce.workspace_id
        JOIN public.profiles pr ON pr.user_id = m.user_id
        LEFT JOIN public.professional_profiles pp ON pp.member_id = m.id AND pp.workspace_id = m.workspace_id
        WHERE ce.workspace_id = p_workspace_id
          AND (v_filter IS NULL OR ce.professional_member_id = v_filter)
        ORDER BY ce.created_at DESC
        LIMIT 200
      ) c
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.permission_for_member(p_member_id uuid, p_key text)
RETURNS TABLE (effective boolean, source text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role public.member_role;
  v_workspace uuid;
  v_effect text;
BEGIN
  IF p_key IS NULL OR NOT (p_key = ANY (app.permission_keys())) THEN
    RETURN;
  END IF;
  SELECT m.role, m.workspace_id INTO v_role, v_workspace
  FROM public.workspace_members m
  WHERE m.id = p_member_id AND m.status = 'active'::public.member_status;
  IF v_role IS NULL THEN
    RETURN;
  END IF;
  IF v_role = 'owner'::public.member_role THEN
    effective := true;
    source := 'owner';
    RETURN NEXT;
    RETURN;
  END IF;
  SELECT p.effect INTO v_effect
  FROM public.workspace_member_permissions p
  WHERE p.member_id = p_member_id AND p.workspace_id = v_workspace AND p.permission_key = p_key;
  IF v_effect IS NOT NULL THEN
    effective := v_effect = 'grant';
    source := v_effect;
    RETURN NEXT;
    RETURN;
  END IF;
  effective := app.permission_default(v_role, p_key);
  source := 'default';
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION app.get_my_permissions(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.require_confirmed_email();
  IF NOT app.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT jsonb_object_agg(k, app.member_has_permission(p_workspace_id, k))
    FROM unnest(app.permission_keys()) AS k
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.get_member_permission_editor(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM app.require_confirmed_email();
  IF NOT app.owns_workspace(p_workspace_id)
     AND NOT app.has_workspace_role(p_workspace_id, VARIADIC ARRAY['owner'::public.member_role]) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'member_id', m.id,
        'full_name', pr.full_name,
        'role', m.role,
        'editable', m.role <> 'owner'::public.member_role,
        'permissions', (
          SELECT jsonb_agg(jsonb_build_object(
            'key', row.permission_key,
            'effective', row.effective,
            'source', row.source
          ) ORDER BY row.permission_key)
          FROM (
            SELECT k AS permission_key, f.effective, f.source
            FROM unnest(app.permission_keys()) AS k
            CROSS JOIN LATERAL app.permission_for_member(m.id, k) AS f
          ) row
        )
      ) ORDER BY pr.full_name)
      FROM public.workspace_members m
      JOIN public.profiles pr ON pr.user_id = m.user_id
      WHERE m.workspace_id = p_workspace_id
        AND m.status = 'active'::public.member_status
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION app.set_member_permission(
  p_member_id uuid,
  p_permission_key text,
  p_effect text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member public.workspace_members%ROWTYPE;
  v_effect text := NULLIF(lower(btrim(COALESCE(p_effect, ''))), '');
BEGIN
  PERFORM app.require_confirmed_email();
  SELECT * INTO v_member FROM public.workspace_members WHERE id = p_member_id;
  IF v_member.id IS NULL OR v_member.status <> 'active'::public.member_status THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT app.owns_workspace(v_member.workspace_id)
     AND NOT app.has_workspace_role(v_member.workspace_id, VARIADIC ARRAY['owner'::public.member_role]) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF v_member.role = 'owner'::public.member_role THEN
    RAISE EXCEPTION 'owner_permissions_locked' USING ERRCODE = '42501';
  END IF;
  IF p_permission_key IS NULL OR NOT (p_permission_key = ANY (app.permission_keys())) THEN
    RAISE EXCEPTION 'invalid_permission' USING ERRCODE = '22023';
  END IF;
  IF v_effect IS NULL THEN
    DELETE FROM public.workspace_member_permissions
    WHERE member_id = v_member.id AND permission_key = p_permission_key;
    RETURN;
  END IF;
  IF v_effect NOT IN ('grant', 'deny') THEN
    RAISE EXCEPTION 'invalid_permission' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.workspace_member_permissions (
    member_id, workspace_id, permission_key, effect, created_by
  ) VALUES (
    v_member.id, v_member.workspace_id, p_permission_key, v_effect, auth.uid()
  )
  ON CONFLICT (member_id, permission_key) DO UPDATE
  SET effect = EXCLUDED.effect, updated_at = clock_timestamp(), created_by = EXCLUDED.created_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_appointment(
  p_workspace_id uuid, p_client_id uuid, p_professional_member_id uuid, p_service_id uuid,
  p_starts_at timestamptz, p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM app.assert_member_permission(p_workspace_id, 'appointments.create');
  RETURN app.create_appointment(p_workspace_id, p_client_id, p_professional_member_id, p_service_id, p_starts_at, p_notes);
END;
$$;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_appointment_id uuid, p_professional_member_id uuid, p_service_id uuid,
  p_starts_at timestamptz, p_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_workspace uuid;
BEGIN
  SELECT workspace_id INTO v_workspace FROM public.appointments WHERE id = p_appointment_id;
  IF v_workspace IS NOT NULL THEN
    PERFORM app.assert_member_permission(v_workspace, 'appointments.reschedule');
  END IF;
  RETURN app.reschedule_appointment(p_appointment_id, p_professional_member_id, p_service_id, p_starts_at, p_notes);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_appointment_status(
  p_appointment_id uuid, p_status public.appointment_status
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_workspace uuid;
  v_status public.appointment_status;
BEGIN
  SELECT workspace_id, status INTO v_workspace, v_status FROM public.appointments WHERE id = p_appointment_id;
  IF v_workspace IS NOT NULL AND p_status IS DISTINCT FROM v_status THEN
    IF p_status IN ('cancelled'::public.appointment_status, 'no_show'::public.appointment_status) THEN
      PERFORM app.assert_member_permission(v_workspace, 'appointments.cancel');
    ELSE
      PERFORM app.assert_member_permission(v_workspace, 'appointments.edit');
    END IF;
  END IF;
  RETURN app.set_appointment_status(p_appointment_id, p_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_available_slots(
  p_workspace_id uuid, p_professional_member_id uuid, p_service_id uuid, p_local_date date
) RETURNS TABLE (starts_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM app.assert_member_permission(p_workspace_id, 'appointments.view');
  RETURN QUERY
  SELECT s.starts_at
  FROM app.list_available_slots(p_workspace_id, p_professional_member_id, p_service_id, p_local_date) s;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_appointment_checkout(
  p_appointment_id uuid, p_idempotency_key text, p_discount_cents integer DEFAULT 0,
  p_products jsonb DEFAULT '[]'::jsonb, p_receive_cents integer DEFAULT 0,
  p_payment_method public.payment_method DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.complete_appointment_checkout(p_appointment_id, p_idempotency_key, p_discount_cents, p_products, p_receive_cents, p_payment_method);
$$;

CREATE OR REPLACE FUNCTION public.record_financial_receipt(
  p_workspace_id uuid, p_entry_id uuid, p_amount_cents integer,
  p_payment_method public.payment_method, p_idempotency_key text
) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.record_financial_receipt(p_workspace_id, p_entry_id, p_amount_cents, p_payment_method, p_idempotency_key);
$$;

CREATE OR REPLACE FUNCTION public.set_commission_rule(
  p_workspace_id uuid, p_professional_member_id uuid, p_service_id uuid, p_rate_bps integer
) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.set_commission_rule(p_workspace_id, p_professional_member_id, p_service_id, p_rate_bps);
$$;

CREATE OR REPLACE FUNCTION public.set_commission_release_policy(
  p_workspace_id uuid, p_policy public.commission_release_policy
) RETURNS public.commission_release_policy LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.set_commission_release_policy(p_workspace_id, p_policy);
$$;

CREATE OR REPLACE FUNCTION public.get_commission_settings(p_workspace_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.get_commission_settings(p_workspace_id);
$$;

CREATE OR REPLACE FUNCTION public.get_commissions_ui(p_workspace_id uuid, p_professional_member_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.get_commissions_ui(p_workspace_id, p_professional_member_id);
$$;

CREATE OR REPLACE FUNCTION public.pay_commission(
  p_commission_id uuid, p_amount_cents integer, p_paid_on date, p_note text, p_idempotency_key text
) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.pay_commission(p_commission_id, p_amount_cents, p_paid_on, p_note, p_idempotency_key, 'payout'::public.commission_payment_direction);
$$;

CREATE OR REPLACE FUNCTION public.recover_commission(
  p_commission_id uuid, p_amount_cents integer, p_paid_on date, p_note text, p_idempotency_key text
) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.pay_commission(p_commission_id, p_amount_cents, p_paid_on, p_note, p_idempotency_key, 'recovery'::public.commission_payment_direction);
$$;

CREATE OR REPLACE FUNCTION public.adjust_commission(p_commission_id uuid, p_new_amount_cents integer, p_reason text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.adjust_commission(p_commission_id, p_new_amount_cents, p_reason);
$$;

CREATE OR REPLACE FUNCTION public.reassign_commission(p_commission_id uuid, p_professional_member_id uuid, p_reason text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.reassign_commission(p_commission_id, p_professional_member_id, p_reason);
$$;

CREATE OR REPLACE FUNCTION public.get_my_permissions(p_workspace_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.get_my_permissions(p_workspace_id);
$$;

CREATE OR REPLACE FUNCTION public.get_member_permission_editor(p_workspace_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.get_member_permission_editor(p_workspace_id);
$$;

CREATE OR REPLACE FUNCTION public.set_member_permission(p_member_id uuid, p_permission_key text, p_effect text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT app.set_member_permission(p_member_id, p_permission_key, p_effect);
$$;

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_settlements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_settlement_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_settlement_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.financial_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_member_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_member_permissions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.commission_rules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.appointment_settlements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.appointment_settlement_products FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.financial_receipts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commission_entries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commission_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.commission_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.workspace_member_permissions FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.commission_rules TO authenticated;
GRANT SELECT ON public.appointment_settlements TO authenticated;
GRANT SELECT ON public.appointment_settlement_products TO authenticated;
GRANT SELECT ON public.financial_receipts TO authenticated;
GRANT SELECT ON public.commission_entries TO authenticated;
GRANT SELECT ON public.commission_events TO authenticated;
GRANT SELECT ON public.commission_payments TO authenticated;
GRANT SELECT ON public.workspace_member_permissions TO authenticated;

CREATE POLICY commission_rules_select ON public.commission_rules
  FOR SELECT TO authenticated
  USING ((SELECT app.member_has_permission(workspace_id, 'commissions.manage_team')));

CREATE POLICY appointment_settlements_select ON public.appointment_settlements FOR SELECT TO authenticated USING (
 app.member_has_permission(workspace_id,'commissions.manage_team') OR app.member_has_permission(workspace_id,'commissions.pay')
 OR (app.member_has_permission(workspace_id,'commissions.view_own') AND professional_member_id IN
 (SELECT id FROM public.workspace_members WHERE user_id=(SELECT auth.uid()) AND status='active' AND workspace_id=appointment_settlements.workspace_id))
);


CREATE POLICY appointment_settlement_products_select ON public.appointment_settlement_products
  FOR SELECT TO authenticated
  USING ((SELECT app.member_has_permission(workspace_id, 'finance.view')
       OR app.member_has_permission(workspace_id, 'finance.manage')
       OR app.member_has_permission(workspace_id, 'inventory.view')));

CREATE POLICY financial_receipts_select ON public.financial_receipts
  FOR SELECT TO authenticated
  USING ((SELECT app.member_has_permission(workspace_id, 'finance.view')
       OR app.member_has_permission(workspace_id, 'finance.manage')
       OR app.member_has_permission(workspace_id, 'finance.receive')));

CREATE POLICY commission_entries_select ON public.commission_entries
  FOR SELECT TO authenticated
  USING (
    (SELECT app.member_has_permission(workspace_id, 'commissions.manage_team')
      OR app.member_has_permission(workspace_id, 'commissions.pay'))
    OR (
      (SELECT app.member_has_permission(workspace_id, 'commissions.view_own'))
      AND professional_member_id IN (
        SELECT m.id FROM public.workspace_members m
        WHERE m.user_id = (SELECT auth.uid())
          AND m.workspace_id = commission_entries.workspace_id
          AND m.status = 'active'::public.member_status
      )
    )
  );

CREATE POLICY commission_events_select ON public.commission_events
  FOR SELECT TO authenticated
  USING (
    commission_id IN (
      SELECT c.id FROM public.commission_entries c
      WHERE c.workspace_id = commission_events.workspace_id
        AND (
          (SELECT app.member_has_permission(c.workspace_id, 'commissions.manage_team')
            OR app.member_has_permission(c.workspace_id, 'commissions.pay'))
          OR (
            (SELECT app.member_has_permission(c.workspace_id, 'commissions.view_own'))
            AND c.professional_member_id IN (
              SELECT m.id FROM public.workspace_members m
              WHERE m.user_id = (SELECT auth.uid())
                AND m.workspace_id = c.workspace_id
                AND m.status = 'active'::public.member_status
            )
          )
        )
    )
  );

CREATE POLICY commission_payments_select ON public.commission_payments
  FOR SELECT TO authenticated
  USING (
    commission_id IN (
      SELECT c.id FROM public.commission_entries c
      WHERE c.id = commission_payments.commission_id
        AND c.workspace_id = commission_payments.workspace_id
        AND (
          (SELECT app.member_has_permission(c.workspace_id, 'commissions.manage_team')
            OR app.member_has_permission(c.workspace_id, 'commissions.pay'))
          OR (
            (SELECT app.member_has_permission(c.workspace_id, 'commissions.view_own'))
            AND c.professional_member_id IN (
              SELECT m.id FROM public.workspace_members m
              WHERE m.user_id = (SELECT auth.uid())
                AND m.workspace_id = c.workspace_id
                AND m.status = 'active'::public.member_status
            )
          )
        )
    )
  );

CREATE POLICY workspace_member_permissions_select ON public.workspace_member_permissions
  FOR SELECT TO authenticated
  USING (
    (SELECT app.has_workspace_role(workspace_id, VARIADIC ARRAY['owner'::public.member_role]))
    OR member_id IN (
      SELECT m.id FROM public.workspace_members m
      WHERE m.user_id = (SELECT auth.uid())
        AND m.workspace_id = workspace_member_permissions.workspace_id
        AND m.status = 'active'::public.member_status
    )
  );

CREATE POLICY appointments_require_view ON public.appointments
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT app.member_has_permission(workspace_id, 'appointments.view')));

CREATE POLICY workspace_clients_require_view ON public.workspace_clients
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT app.member_has_permission(workspace_id, 'clients.view')));

CREATE POLICY workspace_clients_require_manage_insert ON public.workspace_clients
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT app.member_has_permission(workspace_id, 'clients.manage')));

CREATE POLICY workspace_clients_require_manage_update ON public.workspace_clients
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING ((SELECT app.member_has_permission(workspace_id, 'clients.manage')))
  WITH CHECK ((SELECT app.member_has_permission(workspace_id, 'clients.manage')));

CREATE POLICY inventory_products_require_view ON public.inventory_products
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT app.member_has_permission(workspace_id, 'inventory.view')));

CREATE POLICY inventory_movements_require_view ON public.inventory_movements
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT app.member_has_permission(workspace_id, 'inventory.view')));

CREATE POLICY financial_entries_require_finance ON public.financial_entries
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT app.member_has_permission(workspace_id, 'finance.view')
       OR app.member_has_permission(workspace_id, 'finance.manage')
       OR app.member_has_permission(workspace_id, 'finance.receive')));

CREATE POLICY financial_entries_select_granted ON public.financial_entries
  FOR SELECT TO authenticated
  USING ((SELECT app.member_has_permission(workspace_id, 'finance.view')
       OR app.member_has_permission(workspace_id, 'finance.manage')
       OR app.member_has_permission(workspace_id, 'finance.receive')));

CREATE POLICY financial_refunds_require_finance ON public.financial_refunds
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT app.member_has_permission(workspace_id, 'finance.view')
       OR app.member_has_permission(workspace_id, 'finance.manage')
       OR app.member_has_permission(workspace_id, 'finance.receive')));

CREATE TRIGGER commission_rules_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION app.capture_audit_event();
CREATE TRIGGER commission_payments_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.commission_payments
  FOR EACH ROW EXECUTE FUNCTION app.capture_audit_event();
CREATE TRIGGER appointment_settlements_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.appointment_settlements
  FOR EACH ROW EXECUTE FUNCTION app.capture_audit_event();
CREATE TRIGGER financial_receipts_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.financial_receipts
  FOR EACH ROW EXECUTE FUNCTION app.capture_audit_event();
CREATE TRIGGER workspace_member_permissions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.workspace_member_permissions
  FOR EACH ROW EXECUTE FUNCTION app.capture_audit_event();

CREATE TRIGGER commission_rules_entitlement
  BEFORE INSERT OR UPDATE OR DELETE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workspace_entitlement();
CREATE TRIGGER commission_entries_entitlement
  BEFORE INSERT OR UPDATE OR DELETE ON public.commission_entries
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workspace_entitlement();
CREATE TRIGGER commission_payments_entitlement
  BEFORE INSERT OR UPDATE OR DELETE ON public.commission_payments
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workspace_entitlement();
CREATE TRIGGER financial_receipts_entitlement
  BEFORE INSERT OR UPDATE OR DELETE ON public.financial_receipts
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workspace_entitlement();
CREATE TRIGGER appointment_settlements_entitlement
  BEFORE INSERT OR UPDATE OR DELETE ON public.appointment_settlements
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workspace_entitlement();
CREATE TRIGGER appointment_settlement_products_entitlement
  BEFORE INSERT OR UPDATE OR DELETE ON public.appointment_settlement_products
  FOR EACH ROW EXECUTE FUNCTION app.enforce_workspace_entitlement();

REVOKE ALL ON FUNCTION app.percent_of_cents(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.prorate_cents(integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.permission_keys() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.permission_default(public.member_role, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.member_has_permission(uuid, text) FROM PUBLIC, anon, authenticated;
-- A política de RLS roda como o usuário da consulta e precisa executar este predicado.
-- Ele só devolve verdadeiro ou falso para o auth.uid() atual.
GRANT EXECUTE ON FUNCTION app.member_has_permission(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION app.assert_member_permission(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.assert_report_reader(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.resolve_commission_rule(uuid, uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.sync_appointment_commission(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_commission_rule() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_commission_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.forbid_history_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_settlement_product() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.protect_linked_financial_entry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.sync_commission_from_entry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.sync_commission_from_refund() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.sync_commission_from_receipt() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.record_entry_receipt(public.financial_entries, integer, public.payment_method, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.appointment_checkout_summary(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.complete_appointment_checkout(uuid, text, integer, jsonb, integer, public.payment_method) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.record_financial_receipt(uuid, uuid, integer, public.payment_method, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.set_commission_rule(uuid, uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.set_commission_release_policy(uuid, public.commission_release_policy) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.get_commission_settings(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.pay_commission(uuid, integer, date, text, text, public.commission_payment_direction) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.adjust_commission(uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.reassign_commission(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.get_commissions_ui(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.permission_for_member(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.get_my_permissions(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.get_member_permission_editor(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app.set_member_permission(uuid, text, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.complete_appointment_checkout(uuid, text, integer, jsonb, integer, public.payment_method) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_financial_receipt(uuid, uuid, integer, public.payment_method, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_commission_rule(uuid, uuid, uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_commission_release_policy(uuid, public.commission_release_policy) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_commission_settings(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_commissions_ui(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pay_commission(uuid, integer, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recover_commission(uuid, integer, date, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.adjust_commission(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reassign_commission(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_permissions(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_member_permission_editor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_member_permission(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_appointment_checkout(uuid, text, integer, jsonb, integer, public.payment_method) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_financial_receipt(uuid, uuid, integer, public.payment_method, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_commission_rule(uuid, uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_commission_release_policy(uuid, public.commission_release_policy) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_commission_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_commissions_ui(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_commission(uuid, integer, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recover_commission(uuid, integer, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_commission(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_commission(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_permissions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_permission_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_permission(uuid, text, text) TO authenticated;
