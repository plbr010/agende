-- Continuação da fase 1: fechamento, recebimento, pagamento de comissão e RLS.
-- Depende de 20261023190000. Não mexe em Stripe.

CREATE OR REPLACE FUNCTION app.protect_commission_rule()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commission_rule_immutable' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.rate_bps IS DISTINCT FROM OLD.rate_bps
    OR NEW.professional_member_id IS DISTINCT FROM OLD.professional_member_id
    OR NEW.service_id IS DISTINCT FROM OLD.service_id
    OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
    OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
    OR (OLD.effective_to IS NOT NULL AND NEW.effective_to IS DISTINCT FROM OLD.effective_to)
  ) THEN
    RAISE EXCEPTION 'commission_rule_immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER commission_rules_immutable
  BEFORE UPDATE OR DELETE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION app.protect_commission_rule();

CREATE OR REPLACE FUNCTION app.protect_commission_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'commission_snapshot_immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
     OR NEW.settlement_id IS DISTINCT FROM OLD.settlement_id
     OR NEW.rule_id IS DISTINCT FROM OLD.rule_id
     OR NEW.release_policy IS DISTINCT FROM OLD.release_policy
     OR NEW.rate_bps IS DISTINCT FROM OLD.rate_bps
     OR NEW.eligible_cents IS DISTINCT FROM OLD.eligible_cents
     OR NEW.original_commission_cents IS DISTINCT FROM OLD.original_commission_cents THEN
    RAISE EXCEPTION 'commission_snapshot_immutable' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER commission_entries_snapshot
  BEFORE UPDATE OR DELETE ON public.commission_entries
  FOR EACH ROW EXECUTE FUNCTION app.protect_commission_snapshot();

CREATE OR REPLACE FUNCTION app.forbid_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'commission_history_immutable' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER commission_events_immutable
  BEFORE UPDATE OR DELETE ON public.commission_events
  FOR EACH ROW EXECUTE FUNCTION app.forbid_history_mutation();

CREATE TRIGGER commission_payments_immutable
  BEFORE UPDATE OR DELETE ON public.commission_payments
  FOR EACH ROW EXECUTE FUNCTION app.forbid_history_mutation();

CREATE TRIGGER financial_receipts_immutable
  BEFORE UPDATE OR DELETE ON public.financial_receipts
  FOR EACH ROW EXECUTE FUNCTION app.forbid_history_mutation();

CREATE TRIGGER appointment_settlements_immutable
  BEFORE UPDATE OR DELETE ON public.appointment_settlements
  FOR EACH ROW EXECUTE FUNCTION app.forbid_history_mutation();

CREATE OR REPLACE FUNCTION app.protect_settlement_product()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'settlement_product_immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.settlement_id IS DISTINCT FROM OLD.settlement_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.quantity IS DISTINCT FROM OLD.quantity
     OR NEW.unit_price_cents IS DISTINCT FROM OLD.unit_price_cents
     OR NEW.line_total_cents IS DISTINCT FROM OLD.line_total_cents
     OR NEW.financial_entry_id IS DISTINCT FROM OLD.financial_entry_id THEN
    RAISE EXCEPTION 'settlement_product_immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointment_settlement_products_snapshot
  BEFORE UPDATE OR DELETE ON public.appointment_settlement_products
  FOR EACH ROW EXECUTE FUNCTION app.protect_settlement_product();

CREATE OR REPLACE FUNCTION app.protect_linked_financial_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.linked_settlement_id IS NOT NULL AND (
    NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
    OR NEW.source IS DISTINCT FROM OLD.source
    OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
    OR NEW.client_package_id IS DISTINCT FROM OLD.client_package_id
    OR NEW.entry_type IS DISTINCT FROM OLD.entry_type
    OR NEW.linked_settlement_id IS DISTINCT FROM OLD.linked_settlement_id
  ) THEN
    RAISE EXCEPTION 'settlement_entry_locked' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER financial_entries_protect_settlement
  BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION app.protect_linked_financial_entry();

CREATE OR REPLACE FUNCTION app.finance_on_appointment_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_category_id uuid;
  v_settlement public.appointment_settlements%ROWTYPE;
  v_amount integer;
  v_description text;
BEGIN
  IF NEW.status = 'completed'::public.appointment_status
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NOT EXISTS (
       SELECT 1 FROM public.package_redemptions pr
       WHERE pr.appointment_id = NEW.id AND pr.reversed_at IS NULL
     )
  THEN
    SELECT * INTO v_settlement
    FROM public.appointment_settlements
    WHERE appointment_id = NEW.id;

    v_amount := CASE WHEN v_settlement.id IS NULL THEN NEW.price_cents ELSE v_settlement.amount_due_cents END;
    v_description := CASE
      WHEN v_settlement.discount_cents > 0 THEN 'Atendimento concluído com desconto'
      ELSE 'Atendimento concluído'
    END;

    IF v_amount > 0 THEN
      SELECT id INTO v_category_id
      FROM public.financial_categories
      WHERE workspace_id = NEW.workspace_id
        AND system_key = 'service_income'
      LIMIT 1;

      INSERT INTO public.financial_entries (
        workspace_id, entry_type, status, source, description, amount_cents,
        appointment_id, client_id, category_id, created_by, linked_settlement_id
      ) VALUES (
        NEW.workspace_id, 'income', 'pending', 'appointment', v_description,
        v_amount, NEW.id, NEW.client_id, v_category_id, NEW.created_by, v_settlement.id
      )
      ON CONFLICT DO NOTHING;
    END IF;

    PERFORM app.sync_appointment_commission(NEW.id, 'calculated', NULL, true);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.sync_commission_from_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment uuid;
  v_line public.appointment_settlement_products%ROWTYPE;
BEGIN
  IF NEW.source = 'appointment'::public.financial_entry_source AND NEW.appointment_id IS NOT NULL
     AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     ) THEN
    IF NEW.status = 'paid'::public.financial_entry_status
       AND OLD.status IS DISTINCT FROM 'paid'::public.financial_entry_status
       AND NEW.entry_type = 'income'::public.financial_entry_type
       AND NEW.payment_method IS NOT NULL THEN
      INSERT INTO public.financial_receipts (
        workspace_id, financial_entry_id, amount_cents, payment_method, received_at, created_by, idempotency_key
      )
      SELECT NEW.workspace_id, NEW.id, NEW.amount_cents - COALESCE(SUM(r.amount_cents), 0),
             NEW.payment_method, COALESCE(NEW.paid_at, clock_timestamp()), auth.uid(),
             'paid:' || NEW.id::text
      FROM public.financial_receipts r
      WHERE r.financial_entry_id = NEW.id
      HAVING NEW.amount_cents - COALESCE(SUM(r.amount_cents), 0) > 0;
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

CREATE TRIGGER financial_entries_commission_sync
  AFTER UPDATE ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION app.sync_commission_from_entry();

CREATE OR REPLACE FUNCTION app.sync_commission_from_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment uuid;
BEGIN
  SELECT appointment_id INTO v_appointment
  FROM public.financial_entries
  WHERE id = NEW.financial_entry_id
    AND source = 'appointment'::public.financial_entry_source;
  IF v_appointment IS NOT NULL THEN
    PERFORM app.sync_appointment_commission(v_appointment, 'money_sync', NULL, false);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER financial_refunds_commission_sync
  AFTER INSERT ON public.financial_refunds
  FOR EACH ROW EXECUTE FUNCTION app.sync_commission_from_refund();

CREATE OR REPLACE FUNCTION app.sync_commission_from_receipt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment uuid;
BEGIN
  SELECT appointment_id INTO v_appointment
  FROM public.financial_entries
  WHERE id = NEW.financial_entry_id
    AND source = 'appointment'::public.financial_entry_source;
  IF v_appointment IS NOT NULL THEN
    PERFORM app.sync_appointment_commission(v_appointment, 'money_sync', NULL, false);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER financial_receipts_commission_sync
  AFTER INSERT ON public.financial_receipts
  FOR EACH ROW EXECUTE FUNCTION app.sync_commission_from_receipt();

CREATE OR REPLACE FUNCTION app.record_entry_receipt(
  p_entry public.financial_entries,
  p_amount_cents integer,
  p_payment_method public.payment_method,
  p_idempotency_key text,
  p_received_at timestamptz DEFAULT clock_timestamp()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_received integer;
  v_id uuid;
  v_existing public.financial_receipts%ROWTYPE;
  v_key text := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = '22023';
  END IF;
  IF p_payment_method IS NULL THEN
    RAISE EXCEPTION 'payment_method_required' USING ERRCODE = '22023';
  END IF;
  IF v_key IS NOT NULL AND char_length(v_key) NOT BETWEEN 8 AND 120 THEN
    RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE = '22023';
  END IF;
  IF p_entry.status <> 'pending'::public.financial_entry_status
     OR p_entry.entry_type <> 'income'::public.financial_entry_type THEN
    RAISE EXCEPTION 'financial_entry_not_pending' USING ERRCODE = '22023';
  END IF;

  IF v_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.financial_receipts
    WHERE workspace_id = p_entry.workspace_id
      AND idempotency_key = v_key;
    IF v_existing.id IS NOT NULL THEN
      IF v_existing.financial_entry_id <> p_entry.id
         OR v_existing.amount_cents <> p_amount_cents
         OR v_existing.payment_method <> p_payment_method THEN
        RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE = '22023';
      END IF;
      RETURN v_existing.id;
    END IF;
  END IF;

  SELECT COALESCE(SUM(amount_cents), 0)::integer INTO v_received
  FROM public.financial_receipts
  WHERE financial_entry_id = p_entry.id
    AND workspace_id = p_entry.workspace_id;

  IF v_received + p_amount_cents > p_entry.amount_cents THEN
    RAISE EXCEPTION 'receipt_exceeds_due' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.financial_receipts (
    workspace_id, financial_entry_id, amount_cents, payment_method, received_at, idempotency_key, created_by
  ) VALUES (
    p_entry.workspace_id, p_entry.id, p_amount_cents, p_payment_method,
    COALESCE(p_received_at, clock_timestamp()), v_key, auth.uid()
  )
  RETURNING id INTO v_id;

  IF v_received + p_amount_cents = p_entry.amount_cents THEN
    UPDATE public.financial_entries
    SET status = 'paid'::public.financial_entry_status,
        paid_at = COALESCE(p_received_at, clock_timestamp()),
        payment_method = p_payment_method,
        cancelled_at = NULL
    WHERE id = p_entry.id
      AND workspace_id = p_entry.workspace_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.appointment_checkout_summary(p_appointment_id uuid, p_repeated boolean)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_settlement public.appointment_settlements%ROWTYPE;
  v_entry_id uuid;
  v_received integer := 0;
  v_commission public.commission_entries%ROWTYPE;
BEGIN
  SELECT * INTO v_settlement
  FROM public.appointment_settlements
  WHERE appointment_id = p_appointment_id;

  SELECT id INTO v_entry_id
  FROM public.financial_entries
  WHERE appointment_id = p_appointment_id
    AND source = 'appointment'::public.financial_entry_source;

  SELECT COALESCE(SUM(r.amount_cents), 0)::integer INTO v_received
  FROM public.financial_receipts r
  WHERE r.workspace_id = v_settlement.workspace_id
    AND (
      r.financial_entry_id = v_entry_id
      OR r.financial_entry_id IN (
        SELECT sp.financial_entry_id
        FROM public.appointment_settlement_products sp
        WHERE sp.settlement_id = v_settlement.id
          AND sp.financial_entry_id IS NOT NULL
      )
    );

  SELECT * INTO v_commission
  FROM public.commission_entries
  WHERE appointment_id = p_appointment_id;

  RETURN jsonb_build_object(
    'repeated', p_repeated,
    'settlement_id', v_settlement.id,
    'appointment_id', p_appointment_id,
    'professional_member_id', v_settlement.professional_member_id,
    'list_price_cents', v_settlement.list_price_cents,
    'discount_cents', v_settlement.discount_cents,
    'amount_due_cents', v_settlement.amount_due_cents,
    'product_total_cents', v_settlement.product_total_cents,
    'received_cents', v_received,
    'financial_entry_id', v_entry_id,
    'release_policy', v_settlement.release_policy,
    'commission', CASE WHEN v_commission.id IS NULL OR NOT (
      app.member_has_permission(v_settlement.workspace_id,'commissions.manage_team')
      OR app.member_has_permission(v_settlement.workspace_id,'commissions.pay')
      OR (app.member_has_permission(v_settlement.workspace_id,'commissions.view_own') AND EXISTS (
        SELECT 1 FROM public.workspace_members m WHERE m.id=v_commission.professional_member_id
        AND m.workspace_id=v_settlement.workspace_id AND m.user_id=(SELECT auth.uid()) AND m.status='active'
      ))
    ) THEN NULL ELSE jsonb_build_object(
      'id', v_commission.id,
      'professional_member_id', v_commission.professional_member_id,
      'rate_bps', v_commission.rate_bps,
      'eligible_cents', v_commission.eligible_cents,
      'original_cents', v_commission.original_commission_cents,
      'current_cents', v_commission.current_commission_cents,
      'released_cents', v_commission.released_cents,
      'paid_cents', v_commission.paid_cents,
      'status', v_commission.status,
      'release_policy', v_commission.release_policy
    ) END
  );
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

-- No newly-created internal SECURITY DEFINER function is public between migrations.
DO $acl$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='app' AND p.proname=ANY(ARRAY['protect_commission_rule','protect_commission_snapshot','forbid_history_mutation','protect_settlement_product','protect_linked_financial_entry','finance_on_appointment_completed','sync_commission_from_entry','sync_commission_from_refund','sync_commission_from_receipt','record_entry_receipt','appointment_checkout_summary','complete_appointment_checkout'])
 LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature); END LOOP;
END $acl$;
