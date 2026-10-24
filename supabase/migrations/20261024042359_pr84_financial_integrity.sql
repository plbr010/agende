-- PR #84: additive correction. Business choices approved by the owner on 2026-10-24.
-- Cash follows actual receipt dates; no implicit refund, transfer or recovery.
-- Execute as one transaction. Existing commission payouts require explicit reconciliation,
-- because an unlinked manual expense cannot safely be inferred from its amount/date.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM public.commission_payments) THEN
  RAISE EXCEPTION 'commission_payments_require_reconciliation' USING ERRCODE='22023';
 END IF;
 IF EXISTS (SELECT 1 FROM public.financial_entries f WHERE f.status='cancelled' AND
   (SELECT coalesce(sum(amount_cents),0) FROM public.financial_receipts r WHERE r.financial_entry_id=f.id) >
   (SELECT coalesce(sum(amount_cents),0) FROM public.financial_refunds r WHERE r.financial_entry_id=f.id)) THEN
  RAISE EXCEPTION 'cancelled_receipts_require_reconciliation' USING ERRCODE='22023';
 END IF;
END $$;

ALTER TABLE public.commission_payments ADD COLUMN professional_member_id uuid NOT NULL,
 ADD CONSTRAINT commission_payments_beneficiary_fk FOREIGN KEY (professional_member_id,workspace_id)
 REFERENCES public.professional_profiles(member_id,workspace_id) ON DELETE RESTRICT,
 ADD CONSTRAINT commission_payments_id_workspace_key UNIQUE(id,workspace_id);
CREATE INDEX commission_payments_beneficiary_idx ON public.commission_payments(professional_member_id,workspace_id);
ALTER TABLE public.commission_events ADD COLUMN previous_professional_member_id uuid,
 ADD COLUMN next_professional_member_id uuid,
 ADD CONSTRAINT commission_events_previous_fk FOREIGN KEY(previous_professional_member_id,workspace_id)
 REFERENCES public.professional_profiles(member_id,workspace_id),
 ADD CONSTRAINT commission_events_next_fk FOREIGN KEY(next_professional_member_id,workspace_id)
 REFERENCES public.professional_profiles(member_id,workspace_id);
CREATE INDEX commission_events_previous_idx ON public.commission_events(previous_professional_member_id,workspace_id);
CREATE INDEX commission_events_next_idx ON public.commission_events(next_professional_member_id,workspace_id);
ALTER TABLE public.financial_entries ADD COLUMN commission_payment_id uuid,
 ADD CONSTRAINT financial_entries_commission_payment_fk FOREIGN KEY(commission_payment_id,workspace_id)
 REFERENCES public.commission_payments(id,workspace_id) ON DELETE RESTRICT,
 ADD CONSTRAINT financial_entries_commission_payment_unique UNIQUE(commission_payment_id);

-- Resolve the parent without locking financial rows, then always lock:
-- appointment -> settlement -> financial entry -> commission. Helpers are internal only.
CREATE OR REPLACE FUNCTION app.lock_financial_parent(p_workspace uuid,p_entry uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_appt uuid; v_package uuid;
BEGIN
 SELECT coalesce(f.appointment_id,s.appointment_id),f.client_package_id INTO v_appt,v_package
 FROM public.financial_entries f LEFT JOIN public.appointment_settlements s
 ON s.id=f.linked_settlement_id AND s.workspace_id=f.workspace_id
 WHERE f.id=p_entry AND f.workspace_id=p_workspace;
 IF v_package IS NOT NULL THEN
  PERFORM 1 FROM public.client_packages WHERE id=v_package AND workspace_id=p_workspace FOR UPDATE;
 END IF;
 IF v_appt IS NOT NULL THEN
  PERFORM 1 FROM public.appointments WHERE id=v_appt AND workspace_id=p_workspace FOR UPDATE;
  PERFORM 1 FROM public.appointment_settlements WHERE appointment_id=v_appt AND workspace_id=p_workspace FOR UPDATE;
 END IF;
END $$;
REVOKE ALL ON FUNCTION app.lock_financial_parent(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION app.lock_commission(p_id uuid,p_permission text)
RETURNS public.commission_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_c public.commission_entries;
BEGIN
 SELECT * INTO v_c FROM public.commission_entries WHERE id=p_id;
 IF v_c.id IS NULL THEN RAISE EXCEPTION 'commission_not_found' USING ERRCODE='P0002'; END IF;
 PERFORM app.assert_member_permission(v_c.workspace_id,p_permission);
 PERFORM app.sync_appointment_commission(v_c.appointment_id,'money_sync',NULL,false);
 SELECT * INTO v_c FROM public.commission_entries WHERE id=p_id FOR UPDATE;
 RETURN v_c;
END $$;
REVOKE ALL ON FUNCTION app.lock_commission(uuid,text) FROM PUBLIC,anon,authenticated;

DROP POLICY appointment_settlements_select ON public.appointment_settlements;
CREATE POLICY appointment_settlements_select ON public.appointment_settlements FOR SELECT TO authenticated USING (
 app.member_has_permission(workspace_id,'commissions.manage_team') OR app.member_has_permission(workspace_id,'commissions.pay')
 OR (app.member_has_permission(workspace_id,'commissions.view_own') AND professional_member_id IN
 (SELECT id FROM public.workspace_members WHERE user_id=(SELECT auth.uid()) AND status='active' AND workspace_id=appointment_settlements.workspace_id))
);


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

  IF p_entry.status <> 'pending'::public.financial_entry_status
     OR p_entry.entry_type <> 'income'::public.financial_entry_type THEN
    RAISE EXCEPTION 'financial_entry_not_pending' USING ERRCODE = '22023';
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
  IF NEW.status IS DISTINCT FROM OLD.status THEN
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
    IF NEW.source='appointment' AND NEW.appointment_id IS NOT NULL THEN
      PERFORM app.sync_appointment_commission(NEW.appointment_id, 'money_sync', NULL, false);
    END IF;
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
  IF NEW.linked_settlement_id IS NOT NULL AND NEW.appointment_id IS NULL
     AND OLD.status='cancelled' AND NEW.status='pending' THEN
    SELECT * INTO v_line FROM public.appointment_settlement_products
    WHERE financial_entry_id=NEW.id AND workspace_id=NEW.workspace_id FOR UPDATE;
    IF v_line.id IS NOT NULL AND v_line.stock_restored THEN
      PERFORM app.apply_inventory_movement(NEW.workspace_id,v_line.product_id,'exit',v_line.quantity,NULL,'Reabertura da venda no atendimento');
      UPDATE public.appointment_settlement_products SET stock_restored=false WHERE id=v_line.id;
    END IF;
  END IF;
  RETURN NEW;
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

  PERFORM app.lock_financial_parent(p_workspace_id,p_entry_id);
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
  v_commission := app.lock_commission(p_commission_id,'commissions.pay');
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
    workspace_id, commission_id, direction, amount_cents, paid_on, note, idempotency_key, created_by, professional_member_id
  ) VALUES (
    v_commission.workspace_id, v_commission.id, p_direction, p_amount_cents, p_paid_on, v_note, v_key, auth.uid(), v_commission.professional_member_id
  )
  RETURNING id INTO v_id;

  -- The payout/recovery and its cash movement commit or roll back together.
  INSERT INTO public.financial_entries(workspace_id,entry_type,status,source,description,amount_cents,paid_at,payment_method,created_by,commission_payment_id)
  VALUES(v_commission.workspace_id,CASE WHEN p_direction='payout' THEN 'expense'::public.financial_entry_type ELSE 'income'::public.financial_entry_type END,
    'paid','manual',CASE WHEN p_direction='payout' THEN 'Pagamento de comissão' ELSE 'Devolução de comissão' END,
    p_amount_cents,p_paid_on::timestamp AT TIME ZONE app.workspace_timezone(v_commission.workspace_id),'other',auth.uid(),v_id);
  IF p_direction='recovery' THEN
    INSERT INTO public.financial_receipts(workspace_id,financial_entry_id,amount_cents,payment_method,received_at,idempotency_key,created_by)
    SELECT workspace_id,id,amount_cents,'other',paid_at,'commission:'||v_id::text,auth.uid()
    FROM public.financial_entries WHERE commission_payment_id=v_id;
  END IF;
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
  v_commission := app.lock_commission(p_commission_id,'commissions.manage_team');
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
  v_commission := app.lock_commission(p_commission_id,'commissions.manage_team');
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
  IF EXISTS(SELECT 1 FROM public.commission_payments WHERE commission_id=v_commission.id) THEN
    RAISE EXCEPTION 'commission_beneficiary_locked_after_payment' USING ERRCODE='22023';
  END IF;
  UPDATE public.commission_entries
  SET professional_member_id = p_professional_member_id
  WHERE id = v_commission.id;
  INSERT INTO public.commission_events (
    workspace_id, commission_id, event_type, note, current_cents, released_cents, paid_cents, actor_user_id, previous_professional_member_id, next_professional_member_id
  ) VALUES (
    v_commission.workspace_id, v_commission.id, 'beneficiary_changed', v_reason,
    v_commission.current_commission_cents, v_commission.released_cents, v_commission.paid_cents, auth.uid(),v_commission.professional_member_id,p_professional_member_id
  );
  RETURN v_commission.id;
END;
$$;

create or replace function app.mark_financial_entry_paid(
  p_workspace_id uuid,p_entry_id uuid,p_payment_method public.payment_method,p_paid_at timestamptz default now()
)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_entry public.financial_entries%rowtype;
begin
  perform app.assert_finance_operator(p_workspace_id);
  perform app.lock_financial_parent(p_workspace_id,p_entry_id);
  select * into v_entry from public.financial_entries
  where id=p_entry_id and workspace_id=p_workspace_id for update;
  if v_entry.id is null then raise exception 'financial_entry_not_found' using errcode='P0002'; end if;
  if v_entry.status <> 'pending' then raise exception 'financial_entry_not_pending' using errcode='22023'; end if;
  if v_entry.entry_type='expense' and not app.has_workspace_role(
    p_workspace_id,
    variadic array['owner'::public.member_role,'admin'::public.member_role]
  ) then raise exception 'not_authorized' using errcode='42501'; end if;
  if p_payment_method is null then raise exception 'payment_method_required' using errcode='22023'; end if;
  update public.financial_entries
  set status='paid',paid_at=coalesce(p_paid_at,now()),payment_method=p_payment_method,cancelled_at=null
  where id=v_entry.id and workspace_id=p_workspace_id;
  return v_entry.id;
end;
$$;

create or replace function app.cancel_financial_entry(p_workspace_id uuid,p_entry_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform app.assert_finance_manager(p_workspace_id);
  perform app.lock_financial_parent(p_workspace_id,p_entry_id);
  update public.financial_entries
  set status='cancelled',cancelled_at=now(),paid_at=null,payment_method=null
  where id=p_entry_id and workspace_id=p_workspace_id and status='pending';
  if not found then raise exception 'financial_entry_not_cancellable' using errcode='22023'; end if;
  return p_entry_id;
end;
$$;

create or replace function app.reopen_financial_entry(p_workspace_id uuid,p_entry_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform app.assert_finance_manager(p_workspace_id);
  perform app.lock_financial_parent(p_workspace_id,p_entry_id);
  update public.financial_entries
  set status='pending',paid_at=null,payment_method=null,cancelled_at=null
  where id=p_entry_id and workspace_id=p_workspace_id and status in ('paid','cancelled');
  if not found then raise exception 'financial_entry_not_reopenable' using errcode='22023'; end if;
  return p_entry_id;
end;
$$;

create or replace function app.update_financial_entry(
  p_workspace_id uuid,p_entry_id uuid,p_description text,p_amount_cents integer,p_due_date date
)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform app.assert_finance_manager(p_workspace_id);
  perform app.lock_financial_parent(p_workspace_id,p_entry_id);
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 1000000000 then
    raise exception 'invalid_amount' using errcode='22023';
  end if;
  update public.financial_entries
  set description=btrim(p_description), amount_cents=p_amount_cents, due_date=p_due_date
  where id=p_entry_id and workspace_id=p_workspace_id and source='manual' and status='pending';
  if not found then raise exception 'financial_entry_not_editable' using errcode='22023'; end if;
  return p_entry_id;
end;
$$;

-- Defend alternate RPCs, future callers and direct privileged writes too.
CREATE OR REPLACE FUNCTION app.guard_financial_integrity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_received bigint; v_refunded bigint;
BEGIN
 IF OLD.commission_payment_id IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'commission_cash_movement_immutable' USING ERRCODE='42501';
 END IF;
 SELECT coalesce(sum(amount_cents),0) INTO v_received FROM public.financial_receipts WHERE financial_entry_id=OLD.id AND workspace_id=OLD.workspace_id;
 SELECT coalesce(sum(amount_cents),0) INTO v_refunded FROM public.financial_refunds WHERE financial_entry_id=OLD.id AND workspace_id=OLD.workspace_id;
 IF NEW.status='cancelled' AND OLD.status<>'cancelled' AND v_received>v_refunded THEN
   RAISE EXCEPTION 'refund_received_money_first' USING ERRCODE='22023';
 END IF;
 IF NEW.amount_cents IS DISTINCT FROM OLD.amount_cents AND v_received>0 THEN
   RAISE EXCEPTION 'received_entry_amount_locked' USING ERRCODE='22023';
 END IF;
 IF OLD.status='cancelled' AND NEW.status<>'cancelled' AND OLD.source='appointment'
 AND EXISTS(SELECT 1 FROM public.package_redemptions WHERE appointment_id=OLD.appointment_id AND workspace_id=OLD.workspace_id) THEN
   RAISE EXCEPTION 'package_receivable_cannot_reopen' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app.guard_financial_integrity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER financial_entries_integrity BEFORE UPDATE ON public.financial_entries
FOR EACH ROW EXECUTE FUNCTION app.guard_financial_integrity();

-- Existing paid income becomes a dated opening receipt, never a new financial entry.
INSERT INTO public.financial_receipts(workspace_id,financial_entry_id,amount_cents,payment_method,received_at,idempotency_key,created_by)
SELECT f.workspace_id,f.id,f.amount_cents,f.payment_method,f.paid_at,'legacy:'||f.id::text,f.created_by
FROM public.financial_entries f WHERE f.entry_type='income' AND f.status='paid'
AND NOT EXISTS(SELECT 1 FROM public.financial_receipts r WHERE r.financial_entry_id=f.id);


create or replace function app.refund_financial_entry(
  p_workspace_id uuid,
  p_entry_id uuid,
  p_amount_cents integer,
  p_reason text,
  p_payment_method public.payment_method,
  p_refunded_at timestamptz default now(),
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_entry public.financial_entries%rowtype;
  v_refunded integer;
  v_received bigint;
  v_refund_id uuid;
  v_total_after integer;
  v_key text:=nullif(btrim(coalesce(p_idempotency_key,'')),'');
  v_existing public.financial_refunds%rowtype;
begin
  perform app.assert_finance_manager(p_workspace_id);

  perform app.lock_financial_parent(p_workspace_id,p_entry_id);
  -- Serialize retries by the entry before locking an idempotency row.
  perform 1 from public.financial_entries where id=p_entry_id and workspace_id=p_workspace_id for update;
  if v_key is not null and char_length(v_key) not between 8 and 120 then
    raise exception 'invalid_idempotency_key' using errcode='22023';
  end if;

  if v_key is not null then
    select * into v_existing
    from public.financial_refunds
    where workspace_id=p_workspace_id
      and idempotency_key=v_key
    for update;

    if v_existing.id is not null then
      if v_existing.financial_entry_id<>p_entry_id
         or v_existing.amount_cents<>p_amount_cents
         or v_existing.reason<>btrim(p_reason)
         or v_existing.payment_method<>p_payment_method then
        raise exception 'idempotency_key_conflict' using errcode='22023';
      end if;
      return v_existing.id;
    end if;
  end if;

  select * into v_entry
  from public.financial_entries
  where id=p_entry_id
    and workspace_id=p_workspace_id
  for update;

  if v_entry.id is null then
    raise exception 'financial_entry_not_found' using errcode='P0002';
  end if;

  if v_entry.commission_payment_id is not null then
    raise exception 'commission_cash_movement_immutable' using errcode='42501';
  end if;
  if v_entry.entry_type<>'income'::public.financial_entry_type
     or v_entry.status not in ('paid'::public.financial_entry_status,'pending'::public.financial_entry_status) then
    raise exception 'financial_entry_not_refundable' using errcode='22023';
  end if;

  if p_amount_cents is null or p_amount_cents<=0 then
    raise exception 'invalid_refund_amount' using errcode='22023';
  end if;

  if p_payment_method is null then
    raise exception 'refund_payment_method_required' using errcode='22023';
  end if;

  if char_length(btrim(coalesce(p_reason,'')))<3 then
    raise exception 'refund_reason_required' using errcode='22023';
  end if;

  if v_entry.source='package_sale'::public.financial_entry_source
     and v_entry.client_package_id is not null
     and exists(
       select 1 from public.package_redemptions r
       where r.client_package_id=v_entry.client_package_id
         and r.workspace_id=p_workspace_id
         and r.reversed_at is null
     ) then
    raise exception 'package_has_active_redemptions' using errcode='22023';
  end if;

  select coalesce(sum(r.amount_cents),0)::integer
  into v_refunded
  from public.financial_refunds r
  where r.financial_entry_id=v_entry.id
    and r.workspace_id=p_workspace_id;

  select coalesce(sum(amount_cents),0) into v_received from public.financial_receipts
  where financial_entry_id=v_entry.id and workspace_id=p_workspace_id;
  if v_refunded+p_amount_cents>v_received then
    raise exception 'refund_exceeds_paid_amount' using errcode='22023';
  end if;

  begin
    insert into public.financial_refunds(
      workspace_id,financial_entry_id,amount_cents,reason,payment_method,
      refunded_at,idempotency_key,created_by
    ) values(
      p_workspace_id,v_entry.id,p_amount_cents,btrim(p_reason),p_payment_method,
      coalesce(p_refunded_at,now()),v_key,auth.uid()
    )
    returning id into v_refund_id;
  exception when unique_violation then
    if v_key is null then raise; end if;

    select * into v_existing
    from public.financial_refunds
    where workspace_id=p_workspace_id
      and idempotency_key=v_key;

    if v_existing.id is null
       or v_existing.financial_entry_id<>p_entry_id
       or v_existing.amount_cents<>p_amount_cents
       or v_existing.reason<>btrim(p_reason)
       or v_existing.payment_method<>p_payment_method then
      raise exception 'idempotency_key_conflict' using errcode='22023';
    end if;

    return v_existing.id;
  end;

  v_total_after:=v_refunded+p_amount_cents;

  if v_entry.source='package_sale'::public.financial_entry_source
     and v_entry.client_package_id is not null
     and v_total_after=v_entry.amount_cents then
    update public.client_packages
    set status='cancelled'::public.client_package_status
    where id=v_entry.client_package_id
      and workspace_id=p_workspace_id
      and status<>'cancelled'::public.client_package_status;
  end if;

  return v_refund_id;
end;
$$;

create or replace function app.redeem_client_package(
  p_workspace_id uuid,
  p_client_package_id uuid,
  p_appointment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cp public.client_packages%rowtype;
  v_appt public.appointments%rowtype;
  v_item public.client_package_items%rowtype;
  v_redemption_id uuid;
  v_exhausted boolean;
begin
  perform app.assert_package_operator(p_workspace_id);
  perform 1 from public.appointments where id=p_appointment_id and workspace_id=p_workspace_id for update;

  select *
  into v_cp
  from public.client_packages
  where id=p_client_package_id
    and workspace_id=p_workspace_id
  for update;

  if v_cp.id is null then
    raise exception 'client_package_not_found' using errcode='P0002';
  end if;

  if v_cp.status <> 'active'::public.client_package_status then
    raise exception 'client_package_not_active' using errcode='22023';
  end if;

  if v_cp.expires_at is not null and v_cp.expires_at <= now() then
    raise exception 'client_package_expired' using errcode='22023';
  end if;

  select *
  into v_appt
  from public.appointments
  where id=p_appointment_id
    and workspace_id=p_workspace_id
  for share;

  if v_appt.id is null then
    raise exception 'appointment_not_found' using errcode='22023';
  end if;

  if v_appt.client_id <> v_cp.client_id then
    raise exception 'package_client_mismatch' using errcode='22023';
  end if;

  if v_appt.status <> 'completed'::public.appointment_status then
    raise exception 'appointment_must_be_completed_for_redemption' using errcode='22023';
  end if;

  select *
  into v_item
  from public.client_package_items
  where client_package_id=v_cp.id
    and workspace_id=p_workspace_id
    and service_id=v_appt.service_id
  for update;

  if v_item.id is null then
    raise exception 'service_not_in_package' using errcode='22023';
  end if;

  if v_item.used_quantity >= v_item.included_quantity then
    raise exception 'package_service_exhausted' using errcode='22023';
  end if;

  insert into public.package_redemptions(
    workspace_id,
    client_package_id,
    client_package_item_id,
    appointment_id,
    quantity,
    created_by
  ) values(
    p_workspace_id,
    v_cp.id,
    v_item.id,
    v_appt.id,
    1,
    auth.uid()
  )
  returning id into v_redemption_id;

  update public.client_package_items
  set used_quantity=used_quantity+1
  where id=v_item.id
    and workspace_id=p_workspace_id;

  select not exists(
    select 1
    from public.client_package_items i
    where i.client_package_id=v_cp.id
      and i.workspace_id=p_workspace_id
      and i.used_quantity<i.included_quantity
  )
  into v_exhausted;

  if v_exhausted then
    update public.client_packages
    set status='exhausted'::public.client_package_status
    where id=v_cp.id
      and workspace_id=p_workspace_id;
  end if;

  return jsonb_build_object(
    'redemption_id',v_redemption_id,
    'client_package_id',v_cp.id,
    'appointment_id',v_appt.id,
    'remaining',v_item.included_quantity-(v_item.used_quantity+1),
    'package_exhausted',v_exhausted
  );
end;
$$;

create or replace function app.reverse_package_redemption(
  p_workspace_id uuid,
  p_redemption_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_r public.package_redemptions%rowtype;
  v_item public.client_package_items%rowtype;
  v_cp public.client_packages%rowtype;
  v_appt public.appointments%rowtype;
  v_new_status public.client_package_status;
begin
  perform app.assert_package_manager(p_workspace_id);
  perform 1 from public.appointments where workspace_id=p_workspace_id and id=(
    select appointment_id from public.package_redemptions where id=p_redemption_id and workspace_id=p_workspace_id
  ) for update;

  if char_length(btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'reversal_reason_required' using errcode='22023';
  end if;

  select * into v_r
  from public.package_redemptions
  where id=p_redemption_id
    and workspace_id=p_workspace_id
  for update;

  if v_r.id is null then
    raise exception 'package_redemption_not_found' using errcode='P0002';
  end if;

  if v_r.reversed_at is not null then
    raise exception 'package_redemption_already_reversed' using errcode='22023';
  end if;

  select * into v_item
  from public.client_package_items
  where id=v_r.client_package_item_id
    and workspace_id=p_workspace_id
  for update;

  select * into v_cp
  from public.client_packages
  where id=v_r.client_package_id
    and workspace_id=p_workspace_id
  for update;

  select * into v_appt
  from public.appointments
  where id=v_r.appointment_id
    and workspace_id=p_workspace_id
  for share;

  if v_item.id is null or v_cp.id is null or v_appt.id is null then
    raise exception 'package_redemption_integrity_error' using errcode='22023';
  end if;

  if v_item.used_quantity <= 0 then
    raise exception 'package_item_usage_invalid' using errcode='22023';
  end if;

  update public.client_package_items
  set used_quantity=used_quantity-1
  where id=v_item.id
    and workspace_id=p_workspace_id;

  if v_cp.status='cancelled'::public.client_package_status then
    v_new_status := 'cancelled'::public.client_package_status;
  elsif v_cp.expires_at is not null and v_cp.expires_at <= now() then
    v_new_status := 'expired'::public.client_package_status;
  else
    v_new_status := 'active'::public.client_package_status;
  end if;

  update public.client_packages
  set status=v_new_status
  where id=v_cp.id
    and workspace_id=p_workspace_id;

  perform set_config('app.package_redemption_mutating','on',true);
  update public.package_redemptions
  set reversed_at=now(),
      reversed_by=auth.uid(),
      reversal_reason=btrim(p_reason)
  where id=v_r.id
    and workspace_id=p_workspace_id;
  perform set_config('app.package_redemption_mutating','off',true);

  return jsonb_build_object(
    'redemption_id',v_r.id,
    'client_package_id',v_cp.id,
    'appointment_id',v_appt.id,
    'package_status',v_new_status,
    'remaining_after_reversal',
      v_item.included_quantity-(v_item.used_quantity-1)
  );
end;
$$;

create or replace function app.finance_before_package_redemption()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_status public.financial_entry_status;
begin
  select status into v_status
  from public.financial_entries
  where appointment_id=new.appointment_id and source='appointment'
  for update;
  if exists(select 1 from public.financial_entries f where f.appointment_id=new.appointment_id and f.source='appointment'
    and (select coalesce(sum(amount_cents),0) from public.financial_receipts where financial_entry_id=f.id)>
        (select coalesce(sum(amount_cents),0) from public.financial_refunds where financial_entry_id=f.id)) then
    raise exception 'refund_received_money_first' using errcode='22023';
  end if;
  if v_status='paid' AND NOT EXISTS(SELECT 1 FROM public.financial_refunds r JOIN public.financial_entries f ON f.id=r.financial_entry_id WHERE f.appointment_id=new.appointment_id) then
    raise exception 'appointment_already_paid' using errcode='22023';
  elsif v_status in ('pending','paid') then
    update public.financial_entries
    set status='cancelled',cancelled_at=now(),paid_at=null,payment_method=null
    where appointment_id=new.appointment_id and source='appointment';
  end if;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION app.get_commissions_page(
  p_workspace_id uuid,
  p_professional_member_id uuid DEFAULT NULL,
  p_before timestamptz DEFAULT NULL,
  p_before_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50
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
  IF p_limit IS NULL OR p_limit<1 OR p_limit>100 OR (p_before IS NULL)<>(p_before_id IS NULL) THEN
    RAISE EXCEPTION 'invalid_commission_page' USING ERRCODE='22023';
  END IF;
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
      ) ORDER BY c.created_at DESC,c.id DESC)
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
          AND (p_before IS NULL OR (ce.created_at,ce.id)<(p_before,p_before_id))
        ORDER BY ce.created_at DESC,ce.id DESC
        LIMIT (p_limit+1)
      ) c
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION app.get_commissions_page(uuid,uuid,timestamptz,uuid,integer) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_commissions_page(p_workspace_id uuid,p_professional_member_id uuid DEFAULT NULL,
 p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT app.get_commissions_page(p_workspace_id,p_professional_member_id,p_before,p_before_id,p_limit);
$$;
REVOKE ALL ON FUNCTION public.get_commissions_page(uuid,uuid,timestamptz,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_commissions_page(uuid,uuid,timestamptz,uuid,integer) TO authenticated;

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

-- Cash facts are dated movements, never whole receivables attributed to the last method.
CREATE OR REPLACE FUNCTION app.finance_period_payload(p_workspace uuid,p_start date,p_end date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH bounds AS (
 SELECT p_start::timestamp AT TIME ZONE app.workspace_timezone(p_workspace) lo,
 (p_end+1)::timestamp AT TIME ZONE app.workspace_timezone(p_workspace) hi
 ), facts AS (
 SELECT f.entry_type,f.category_id,r.amount_cents::bigint paid,0::bigint pending,0::bigint refunded
 FROM public.financial_receipts r JOIN public.financial_entries f ON f.id=r.financial_entry_id AND f.workspace_id=r.workspace_id,bounds b
 WHERE r.workspace_id=p_workspace AND r.received_at>=b.lo AND r.received_at<b.hi
 UNION ALL
 SELECT f.entry_type,f.category_id,f.amount_cents,0,0 FROM public.financial_entries f,bounds b
 WHERE f.workspace_id=p_workspace AND f.entry_type='expense' AND f.status='paid' AND f.paid_at>=b.lo AND f.paid_at<b.hi
 UNION ALL
 SELECT f.entry_type,f.category_id,0,0,r.amount_cents FROM public.financial_refunds r
 JOIN public.financial_entries f ON f.id=r.financial_entry_id AND f.workspace_id=r.workspace_id,bounds b
 WHERE r.workspace_id=p_workspace AND r.refunded_at>=b.lo AND r.refunded_at<b.hi
 UNION ALL
 SELECT f.entry_type,f.category_id,0,greatest(f.amount_cents-coalesce((SELECT sum(r.amount_cents)
 FROM public.financial_receipts r WHERE r.financial_entry_id=f.id AND r.workspace_id=f.workspace_id),0),0),0
 FROM public.financial_entries f,bounds b WHERE f.workspace_id=p_workspace AND f.status='pending' AND f.created_at<b.hi
 ), cats AS (
 SELECT x.entry_type,coalesce(c.name,'Sem categoria') category_name,sum(x.paid)::bigint paid_cents,
 sum(x.pending)::bigint pending_cents,sum(x.refunded)::bigint refunded_cents,
 (sum(x.paid)-sum(x.refunded))::bigint net_cents FROM facts x
 LEFT JOIN public.financial_categories c ON c.id=x.category_id AND c.workspace_id=p_workspace GROUP BY x.entry_type,c.name
 ), totals AS (
 SELECT coalesce(sum(paid_cents) FILTER(WHERE entry_type='income'),0)::bigint inc,
 coalesce(sum(paid_cents) FILTER(WHERE entry_type='expense'),0)::bigint exp,
 coalesce(sum(pending_cents) FILTER(WHERE entry_type='income'),0)::bigint pending_inc,
 coalesce(sum(pending_cents) FILTER(WHERE entry_type='expense'),0)::bigint pending_exp,
 coalesce(sum(refunded_cents),0)::bigint refunds FROM cats
 ) SELECT jsonb_build_object(
 'finance',jsonb_build_object('paid_income_cents',inc,'paid_expense_cents',exp,'pending_income_cents',pending_inc,
 'pending_expense_cents',pending_exp,'refunded_income_cents',refunds,'net_collected_income_cents',inc-refunds,'net_paid_cents',inc-refunds-exp),
 'finance_by_category',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.entry_type,c.category_name) FROM cats c),'[]'::jsonb),
 'payment_methods',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.total_cents DESC) FROM (
 SELECT r.payment_method,count(*)::int payments,sum(r.amount_cents)::bigint total_cents
 FROM public.financial_receipts r,bounds b WHERE r.workspace_id=p_workspace AND r.received_at>=b.lo AND r.received_at<b.hi
 GROUP BY r.payment_method) m),'[]'::jsonb)) FROM totals;
$$;
REVOKE ALL ON FUNCTION app.finance_period_payload(uuid,date,date) FROM PUBLIC,anon,authenticated;


create or replace function app.get_inventory_ui(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  perform app.assert_member_permission(p_workspace_id,'inventory.view');

  return jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'products', count(*) filter(where active and archived_at is null),
        'low_stock', count(*) filter(where active and archived_at is null and quantity > 0 and quantity <= minimum_quantity),
        'out_of_stock', count(*) filter(where active and archived_at is null and quantity = 0),
        'estimated_cost_cents', coalesce(
          round(sum(quantity * cost_cents) filter(where active and archived_at is null and cost_cents is not null)),
          0
        )
      )
      from public.inventory_products
      where workspace_id=p_workspace_id
    ),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',p.id,
          'name',p.name,
          'description',p.description,
          'sku',p.sku,
          'unit',p.unit,
          'quantity',p.quantity,
          'minimum_quantity',p.minimum_quantity,
          'cost_cents',p.cost_cents,
          'active',p.active,
          'archived_at',p.archived_at,
          'created_at',p.created_at
        )
        order by
          case when p.quantity=0 then 0 when p.quantity<=p.minimum_quantity then 1 else 2 end,
          p.name
      )
      from public.inventory_products p
      where p.workspace_id=p_workspace_id
    ),'[]'::jsonb),
    'recent_movements', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select
          m.id,m.product_id,p.name as product_name,m.type,m.quantity,
          m.quantity_before,m.quantity_after,m.reason,m.created_at
        from public.inventory_movements m
        join public.inventory_products p
          on p.id=m.product_id and p.workspace_id=m.workspace_id
        where m.workspace_id=p_workspace_id
        order by m.created_at desc
        limit 20
      ) x
    ),'[]'::jsonb)
  );
end;
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
    WHEN 'inventory.view' THEN p_role IN ('owner'::public.member_role,'admin'::public.member_role)
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

create or replace function app.get_finance_ui(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
begin
  perform app.require_confirmed_email();
  perform app.assert_workspace_entitled(p_workspace_id);
  if not (
    app.member_has_permission(p_workspace_id, 'finance.view')
    or app.member_has_permission(p_workspace_id, 'finance.manage')
  ) then
    raise exception 'not_authorized' using errcode='42501';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date<p_start_date or p_end_date-p_start_date>366 then
    raise exception 'invalid_report_period' using errcode='22023';
  end if;

  v_tz:=app.workspace_timezone(p_workspace_id);
  v_start:=(p_start_date::timestamp at time zone v_tz);
  v_end:=((p_end_date+1)::timestamp at time zone v_tz);

  return jsonb_build_object(
    'report',app.workspace_advanced_report_payload(p_workspace_id,p_start_date,p_end_date),
    'entries',coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
      from (
        select
          f.id,f.entry_type,f.status,f.source,f.description,f.amount_cents,
          f.due_date,f.paid_at,f.payment_method,f.created_at,
          (f.commission_payment_id IS NOT NULL) as commission_cash_locked,
          (f.source='appointment' AND f.status='cancelled' AND EXISTS(SELECT 1 FROM public.package_redemptions pr WHERE pr.appointment_id=f.appointment_id AND pr.workspace_id=f.workspace_id)) as package_receivable_locked,
          c.name as category_name,
          wc.full_name as client_name,
          coalesce((
            select sum(r.amount_cents)
            from public.financial_refunds r
            where r.financial_entry_id=f.id and r.workspace_id=f.workspace_id
          ),0)::bigint as refunded_cents,
          coalesce((
            select sum(rc.amount_cents)
            from public.financial_receipts rc
            where rc.financial_entry_id=f.id and rc.workspace_id=f.workspace_id
          ),0)::bigint as received_cents
        from public.financial_entries f
        left join public.financial_categories c
          on c.id=f.category_id and c.workspace_id=f.workspace_id
        left join public.workspace_clients wc
          on wc.id=f.client_id and wc.workspace_id=f.workspace_id
        where f.workspace_id=p_workspace_id
          and ((f.created_at>=v_start and f.created_at<v_end)
            or (f.status='pending' and f.created_at<v_end)
            or (f.entry_type='expense' and f.paid_at>=v_start and f.paid_at<v_end)
            or exists(select 1 from public.financial_receipts rc where rc.financial_entry_id=f.id and rc.received_at>=v_start and rc.received_at<v_end)
            or exists(select 1 from public.financial_refunds rr where rr.financial_entry_id=f.id and rr.refunded_at>=v_start and rr.refunded_at<v_end))
        order by f.created_at desc
        limit 100
      ) x
    ),'[]'::jsonb),
    'categories',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',c.id,'name',c.name,'entry_type',c.entry_type,
          'system_key',c.system_key,'active',c.active,'archived_at',c.archived_at
        )
        order by c.entry_type,c.name
      )
      from public.financial_categories c
      where c.workspace_id=p_workspace_id
    ),'[]'::jsonb)
  );
end;
$$;

create or replace function app.workspace_report_payload(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_paid_income bigint;
  v_pending_income bigint;
  v_paid_expense bigint;
  v_pending_expense bigint;
  v_refunded_income bigint;
  v_result jsonb;
begin

  if p_start_date is null or p_end_date is null
     or p_end_date < p_start_date
     or p_end_date - p_start_date > 366 then
    raise exception 'invalid_report_period' using errcode='22023';
  end if;

  v_tz := app.workspace_timezone(p_workspace_id);
  v_start := (p_start_date::timestamp at time zone v_tz);
  v_end := ((p_end_date + 1)::timestamp at time zone v_tz);

  select
    coalesce(sum(amount_cents) filter(where entry_type='income' and status='paid'),0),
    coalesce(sum(amount_cents) filter(where entry_type='income' and status='pending'),0),
    coalesce(sum(amount_cents) filter(where entry_type='expense' and status='paid'),0),
    coalesce(sum(amount_cents) filter(where entry_type='expense' and status='pending'),0)
  into
    v_paid_income,
    v_pending_income,
    v_paid_expense,
    v_pending_expense
  from public.financial_entries f
  where f.workspace_id=p_workspace_id
    and f.created_at>=v_start
    and f.created_at<v_end;

  select coalesce(sum(r.amount_cents),0)
  into v_refunded_income
  from public.financial_refunds r
  where r.workspace_id=p_workspace_id
    and r.refunded_at>=v_start
    and r.refunded_at<v_end;

  v_result := jsonb_build_object(
    'period', jsonb_build_object(
      'start_date',p_start_date,
      'end_date',p_end_date,
      'timezone',v_tz
    ),
    'finance', jsonb_build_object(
      'paid_income_cents',v_paid_income,
      'refunded_income_cents',v_refunded_income,
      'net_collected_income_cents',v_paid_income-v_refunded_income,
      'pending_income_cents',v_pending_income,
      'paid_expense_cents',v_paid_expense,
      'pending_expense_cents',v_pending_expense,
      'net_paid_cents',(v_paid_income-v_refunded_income)-v_paid_expense
    )
  );

  v_result := v_result || jsonb_build_object(
    'appointments', (
      select jsonb_build_object(
        'total',count(*),
        'scheduled',count(*) filter(where status='scheduled'),
        'confirmed',count(*) filter(where status='confirmed'),
        'in_progress',count(*) filter(where status='in_progress'),
        'completed',count(*) filter(where status='completed'),
        'cancelled',count(*) filter(where status='cancelled'),
        'no_show',count(*) filter(where status='no_show')
      )
      from public.appointments a
      where a.workspace_id=p_workspace_id
        and a.starts_at>=v_start
        and a.starts_at<v_end
    ),
    'clients', (
      select jsonb_build_object('new_clients',count(*))
      from public.workspace_clients c
      where c.workspace_id=p_workspace_id
        and c.created_at>=v_start
        and c.created_at<v_end
    ),
    'packages', (
      select jsonb_build_object(
        'sold',count(*),
        'gross_sales_cents',coalesce(sum(price_cents),0),
        'active_now',count(*) filter(
          where status='active' and (expires_at is null or expires_at>now())
        ),
        'expired_now',count(*) filter(
          where status='active' and expires_at is not null and expires_at<=now()
        ),
        'exhausted',count(*) filter(where status='exhausted'),
        'cancelled',count(*) filter(where status='cancelled')
      )
      from public.client_packages cp
      where cp.workspace_id=p_workspace_id
        and cp.purchased_at>=v_start
        and cp.purchased_at<v_end
    ),
    'inventory', (
      select jsonb_build_object(
        'active_products',count(*) filter(where archived_at is null and active),
        'low_stock',count(*) filter(
          where archived_at is null and active
            and quantity>0 and quantity<=minimum_quantity
        ),
        'out_of_stock',count(*) filter(
          where archived_at is null and active and quantity=0
        )
      )
      from public.inventory_products ip
      where ip.workspace_id=p_workspace_id
    ),
    'top_services', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.completed_count desc,x.revenue_cents desc)
      from (
        select
          a.service_id,
          coalesce(s.name,'Serviço') as service_name,
          count(*)::int as completed_count,
          coalesce(sum(a.price_cents),0)::bigint as revenue_cents
        from public.appointments a
        left join public.services s
          on s.id=a.service_id
         and s.workspace_id=a.workspace_id
        where a.workspace_id=p_workspace_id
          and a.starts_at>=v_start
          and a.starts_at<v_end
          and a.status='completed'
        group by a.service_id,s.name
        order by completed_count desc,revenue_cents desc
        limit 5
      ) x
    ),'[]'::jsonb)
  );

  return v_result || jsonb_build_object('finance',app.finance_period_payload(p_workspace_id,p_start_date,p_end_date)->'finance');
end;
$$;

create or replace function app.workspace_advanced_report_payload(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_result jsonb;
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_total bigint;
  v_completed bigint;
  v_cancelled bigint;
  v_no_show bigint;
  v_service_value bigint;
begin

  if p_start_date is null or p_end_date is null
     or p_end_date<p_start_date
     or p_end_date-p_start_date>366 then
    raise exception 'invalid_report_period' using errcode='22023';
  end if;

  v_tz:=app.workspace_timezone(p_workspace_id);
  v_start:=(p_start_date::timestamp at time zone v_tz);
  v_end:=((p_end_date+1)::timestamp at time zone v_tz);

  select
    count(*),
    count(*) filter(where status='completed'),
    count(*) filter(where status='cancelled'),
    count(*) filter(where status='no_show'),
    coalesce(sum(price_cents) filter(where status='completed'),0)
  into
    v_total,v_completed,v_cancelled,v_no_show,v_service_value
  from public.appointments
  where workspace_id=p_workspace_id
    and starts_at>=v_start
    and starts_at<v_end;

  v_result := jsonb_build_object(
    'period',jsonb_build_object(
      'start_date',p_start_date,
      'end_date',p_end_date,
      'timezone',v_tz
    ),
    'operations',jsonb_build_object(
      'appointments_total',v_total,
      'completed',v_completed,
      'cancelled',v_cancelled,
      'no_show',v_no_show,
      'completion_rate_pct',
        case when v_total=0 then 0
             else round((v_completed::numeric/v_total::numeric)*100,2) end,
      'cancellation_rate_pct',
        case when v_total=0 then 0
             else round((v_cancelled::numeric/v_total::numeric)*100,2) end,
      'no_show_rate_pct',
        case when v_total=0 then 0
             else round((v_no_show::numeric/v_total::numeric)*100,2) end,
      'average_service_ticket_cents',
        case when v_completed=0 then 0
             else round(v_service_value::numeric/v_completed::numeric) end,
      'completed_service_value_cents',v_service_value
    ),
    'clients',jsonb_build_object(
      'unique_clients',
        (select count(distinct a.client_id)
         from public.appointments a
         where a.workspace_id=p_workspace_id
           and a.starts_at>=v_start
           and a.starts_at<v_end),
      'new_clients',
        (select count(*)
         from public.workspace_clients c
         where c.workspace_id=p_workspace_id
           and c.created_at>=v_start
           and c.created_at<v_end),
      'repeat_clients',
        (select count(*)
         from (
           select a.client_id
           from public.appointments a
           where a.workspace_id=p_workspace_id
             and a.starts_at>=v_start
             and a.starts_at<v_end
             and a.status='completed'
           group by a.client_id
           having count(*)>=2
         ) r)
    ),
    'top_professionals',
      coalesce((
        select jsonb_agg(to_jsonb(x) order by x.completed_count desc,x.service_value_cents desc)
        from (
          select
            a.professional_member_id,
            coalesce(p.display_name,'Profissional') as professional_name,
            count(*)::int as completed_count,
            coalesce(sum(a.price_cents),0)::bigint as service_value_cents
          from public.appointments a
          left join public.professional_profiles p
            on p.member_id=a.professional_member_id
           and p.workspace_id=a.workspace_id
          where a.workspace_id=p_workspace_id
            and a.starts_at>=v_start
            and a.starts_at<v_end
            and a.status='completed'
          group by a.professional_member_id,p.display_name
          order by completed_count desc,service_value_cents desc
          limit 10
        ) x
      ),'[]'::jsonb),
    'finance_by_category',
      coalesce((
        select jsonb_agg(to_jsonb(x) order by x.entry_type,x.net_cents desc,x.category_name)
        from (
          select
            f.entry_type,
            coalesce(c.name,'Sem categoria') as category_name,
            sum(f.amount_cents) filter(where f.status='paid')::bigint as paid_cents,
            sum(f.amount_cents) filter(where f.status='pending')::bigint as pending_cents,
            coalesce(sum(r.refunded_cents),0)::bigint as refunded_cents,
            (
              coalesce(sum(f.amount_cents) filter(where f.status='paid'),0)
              - case
                  when f.entry_type='income' then coalesce(sum(r.refunded_cents),0)
                  else 0
                end
            )::bigint as net_cents
          from public.financial_entries f
          left join public.financial_categories c
            on c.id=f.category_id
           and c.workspace_id=f.workspace_id
          left join lateral (
            select coalesce(sum(fr.amount_cents),0)::bigint as refunded_cents
            from public.financial_refunds fr
            where fr.financial_entry_id=f.id
              and fr.workspace_id=f.workspace_id
              and fr.refunded_at>=v_start
              and fr.refunded_at<v_end
          ) r on true
          where f.workspace_id=p_workspace_id
            and f.created_at>=v_start
            and f.created_at<v_end
          group by f.entry_type,c.name
        ) x
      ),'[]'::jsonb),
    'payment_methods',
      coalesce((
        select jsonb_agg(to_jsonb(x) order by x.total_cents desc)
        from (
          select
            f.payment_method,
            count(*)::int as payments,
            sum(f.amount_cents)::bigint as total_cents
          from public.financial_entries f
          where f.workspace_id=p_workspace_id
            and f.status='paid'
            and f.entry_type='income'
            and f.paid_at>=v_start
            and f.paid_at<v_end
          group by f.payment_method
        ) x
      ),'[]'::jsonb),
    'packages',jsonb_build_object(
      'sold',
        (select count(*)
         from public.client_packages cp
         where cp.workspace_id=p_workspace_id
           and cp.purchased_at>=v_start
           and cp.purchased_at<v_end),
      'redemptions',
        (select count(*)
         from public.package_redemptions pr
         where pr.workspace_id=p_workspace_id
           and pr.created_at>=v_start
           and pr.created_at<v_end
           and pr.reversed_at is null),
      'reversed_redemptions',
        (select count(*)
         from public.package_redemptions pr
         where pr.workspace_id=p_workspace_id
           and pr.reversed_at>=v_start
           and pr.reversed_at<v_end)
    ),
    'inventory',jsonb_build_object(
      'active_products',
        (select count(*)
         from public.inventory_products i
         where i.workspace_id=p_workspace_id
           and i.active and i.archived_at is null),
      'low_stock',
        (select count(*)
         from public.inventory_products i
         where i.workspace_id=p_workspace_id
           and i.active and i.archived_at is null
           and i.quantity>0 and i.quantity<=i.minimum_quantity),
      'out_of_stock',
        (select count(*)
         from public.inventory_products i
         where i.workspace_id=p_workspace_id
           and i.active and i.archived_at is null
           and i.quantity=0),
      'estimated_stock_cost_cents',
        (select coalesce(round(sum(i.quantity*i.cost_cents)),0)
         from public.inventory_products i
         where i.workspace_id=p_workspace_id
           and i.active and i.archived_at is null
           and i.cost_cents is not null)
    )
  );
  return v_result || (app.finance_period_payload(p_workspace_id,p_start_date,p_end_date)-'finance');
end;
$$;

-- New helpers revoke EXECUTE in their creation transaction. Replacements retain prior ACLs.
COMMENT ON COLUMN public.commission_payments.professional_member_id IS 'Immutable actual beneficiary; historical payments prohibit beneficiary reassignment.';
COMMENT ON COLUMN public.financial_entries.commission_payment_id IS 'One immutable cash movement per payout/recovery. Method other means not specified by the legacy commission API.';
