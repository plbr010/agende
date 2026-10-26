-- Final PR84 correction. Local validation only; this file does not authorize rollout.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.financial_entries f WHERE f.entry_type='income' AND f.status='paid'
   AND f.amount_cents<>(SELECT coalesce(sum(r.amount_cents),0) FROM public.financial_receipts r WHERE r.financial_entry_id=f.id)) THEN
   RAISE EXCEPTION 'paid_receipts_require_reconciliation' USING ERRCODE='22023';
 END IF;
END $$;

CREATE TABLE public.financial_settlement_operations (
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
 idempotency_key text NOT NULL CHECK(char_length(idempotency_key) BETWEEN 8 AND 120),
 financial_entry_id uuid NOT NULL,
 payment_method public.payment_method NOT NULL,
 requested_paid_at timestamptz,
 received_delta_cents integer NOT NULL CHECK(received_delta_cents>=0),
 created_by uuid REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,idempotency_key),
 FOREIGN KEY(financial_entry_id,workspace_id) REFERENCES public.financial_entries(id,workspace_id) ON DELETE RESTRICT
);
CREATE INDEX financial_settlement_operations_entry_idx ON public.financial_settlement_operations(financial_entry_id,workspace_id);
CREATE INDEX financial_settlement_operations_actor_idx ON public.financial_settlement_operations(created_by);
ALTER TABLE public.financial_settlement_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_settlement_operations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.financial_settlement_operations FROM PUBLIC,anon,authenticated;
CREATE TRIGGER financial_settlement_operations_immutable BEFORE UPDATE OR DELETE ON public.financial_settlement_operations
 FOR EACH ROW EXECUTE FUNCTION app.forbid_history_mutation();

CREATE OR REPLACE FUNCTION app.mark_financial_entry_paid(
 p_workspace_id uuid,p_entry_id uuid,p_payment_method public.payment_method,p_paid_at timestamptz DEFAULT now()
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.financial_entries; received bigint;
BEGIN
 PERFORM app.assert_finance_operator(p_workspace_id);
 PERFORM app.lock_financial_parent(p_workspace_id,p_entry_id);
 SELECT * INTO e FROM public.financial_entries WHERE id=p_entry_id AND workspace_id=p_workspace_id FOR UPDATE;
 IF e.id IS NULL THEN RAISE EXCEPTION 'financial_entry_not_found' USING ERRCODE='P0002'; END IF;
 IF e.entry_type='expense' THEN PERFORM app.assert_finance_manager(p_workspace_id); END IF;
 IF p_payment_method IS NULL THEN RAISE EXCEPTION 'payment_method_required' USING ERRCODE='22023'; END IF;
 IF e.entry_type='income' THEN
   SELECT coalesce(sum(amount_cents),0) INTO received FROM public.financial_receipts WHERE financial_entry_id=e.id;
   IF received>e.amount_cents OR (e.status='paid' AND received<>e.amount_cents) THEN
     RAISE EXCEPTION 'paid_receipts_require_reconciliation' USING ERRCODE='22023';
   END IF;
 END IF;
 IF e.status='paid' THEN
   IF e.payment_method IS DISTINCT FROM p_payment_method THEN RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE='22023'; END IF;
   RETURN e.id;
 END IF;
 IF e.status<>'pending' THEN RAISE EXCEPTION 'financial_entry_not_pending' USING ERRCODE='22023'; END IF;
 -- Existing trigger records exactly the unreceived remainder, in this transaction.
 UPDATE public.financial_entries SET status='paid',paid_at=coalesce(p_paid_at,clock_timestamp()),
   payment_method=p_payment_method,cancelled_at=NULL WHERE id=e.id;
 RETURN e.id;
END $$;

CREATE OR REPLACE FUNCTION app.settle_financial_entry(
 p_workspace_id uuid,p_entry_id uuid,p_payment_method public.payment_method,p_idempotency_key text,p_paid_at timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.financial_entries; previous public.financial_settlement_operations; k text:=nullif(btrim(p_idempotency_key),''); before_received bigint;
BEGIN
 PERFORM app.assert_finance_operator(p_workspace_id);
 IF k IS NULL OR char_length(k) NOT BETWEEN 8 AND 120 THEN RAISE EXCEPTION 'invalid_idempotency_key' USING ERRCODE='22023'; END IF;
 PERFORM app.lock_financial_parent(p_workspace_id,p_entry_id);
 SELECT * INTO e FROM public.financial_entries WHERE id=p_entry_id AND workspace_id=p_workspace_id FOR UPDATE;
 IF e.id IS NULL THEN RAISE EXCEPTION 'financial_entry_not_found' USING ERRCODE='P0002'; END IF;
 IF e.entry_type='expense' THEN PERFORM app.assert_finance_manager(p_workspace_id); END IF;
 SELECT * INTO previous FROM public.financial_settlement_operations WHERE workspace_id=p_workspace_id AND idempotency_key=k;
 IF previous.financial_entry_id IS NOT NULL THEN
   IF previous.financial_entry_id<>e.id OR previous.payment_method IS DISTINCT FROM p_payment_method
      OR previous.requested_paid_at IS DISTINCT FROM p_paid_at THEN RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE='22023'; END IF;
   RETURN previous.financial_entry_id;
 END IF;
 SELECT coalesce(sum(amount_cents),0) INTO before_received FROM public.financial_receipts WHERE financial_entry_id=e.id;
 PERFORM app.mark_financial_entry_paid(p_workspace_id,e.id,p_payment_method,p_paid_at);
 INSERT INTO public.financial_settlement_operations(workspace_id,idempotency_key,financial_entry_id,payment_method,requested_paid_at,received_delta_cents,created_by)
 VALUES(p_workspace_id,k,e.id,p_payment_method,p_paid_at,
   CASE WHEN e.entry_type='income' THEN greatest(e.amount_cents-before_received,0)::integer ELSE 0 END,auth.uid());
 RETURN e.id;
EXCEPTION WHEN unique_violation THEN
 -- A key reused concurrently for another entry is a conflict; the whole subtransaction rolls back.
 RAISE EXCEPTION 'idempotency_key_conflict' USING ERRCODE='22023';
END $$;
REVOKE ALL ON FUNCTION app.settle_financial_entry(uuid,uuid,public.payment_method,text,timestamptz) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.settle_financial_entry(
 p_workspace_id uuid,p_entry_id uuid,p_payment_method public.payment_method,p_idempotency_key text,p_paid_at timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT app.settle_financial_entry(p_workspace_id,p_entry_id,p_payment_method,p_idempotency_key,p_paid_at);
$$;
REVOKE ALL ON FUNCTION public.settle_financial_entry(uuid,uuid,public.payment_method,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.settle_financial_entry(uuid,uuid,public.payment_method,text,timestamptz) TO authenticated;

-- Commit-time invariant: allows receipt + status changes in either order within one transaction,
-- including the recovery income INSERT followed by its receipt. No paid income can commit with a gap.
CREATE OR REPLACE FUNCTION app.check_paid_receipts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry_id uuid; e public.financial_entries; received bigint;
BEGIN
 IF TG_TABLE_NAME='financial_entries' THEN entry_id:=NEW.id; ELSE entry_id:=NEW.financial_entry_id; END IF;
 SELECT * INTO e FROM public.financial_entries WHERE id=entry_id FOR UPDATE;
 IF e.id IS NULL OR e.entry_type<>'income' THEN RETURN NULL; END IF;
 SELECT coalesce(sum(amount_cents),0) INTO received FROM public.financial_receipts WHERE financial_entry_id=e.id;
 IF received>e.amount_cents OR (e.status='paid' AND received<>e.amount_cents) THEN
   RAISE EXCEPTION 'paid_receipts_mismatch' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION app.check_paid_receipts() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER financial_entries_receipts_consistent AFTER INSERT OR UPDATE ON public.financial_entries
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_paid_receipts();
CREATE CONSTRAINT TRIGGER financial_receipts_entry_consistent AFTER INSERT ON public.financial_receipts
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_paid_receipts();
