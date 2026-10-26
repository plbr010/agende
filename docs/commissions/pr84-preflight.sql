-- Read-only diagnostics for a future separately authorized target review.
-- Run only where commission tables already exist; before the first migration,
-- inventory the existing financial entries and migration history separately.
SELECT f.workspace_id,f.id,f.source,f.status,f.amount_cents,f.paid_at,f.payment_method,
 coalesce(r.received,0) received_cents,coalesce(x.refunded,0) refunded_cents,
 CASE WHEN f.status='paid' AND r.received IS NOT NULL AND r.received<>f.amount_cents
      THEN 'paid_receipts_require_reconciliation'
      WHEN f.status='cancelled' AND coalesce(r.received,0)>coalesce(x.refunded,0)
      THEN 'cancelled_receipts_require_reconciliation'
      WHEN coalesce(x.refunded,0)>coalesce(r.received,0) THEN 'refund_history_requires_review'
      ELSE 'legacy_opening_receipt_candidate' END diagnosis
FROM public.financial_entries f
LEFT JOIN LATERAL(SELECT sum(amount_cents) received FROM public.financial_receipts WHERE financial_entry_id=f.id) r ON true
LEFT JOIN LATERAL(SELECT sum(amount_cents) refunded FROM public.financial_refunds WHERE financial_entry_id=f.id) x ON true
WHERE f.entry_type='income' AND (
 (f.status='paid' AND coalesce(r.received,0)<>f.amount_cents)
 OR (f.status='cancelled' AND coalesce(r.received,0)>coalesce(x.refunded,0))
 OR coalesce(x.refunded,0)>coalesce(r.received,0))
ORDER BY f.workspace_id,f.id;

SELECT workspace_id,count(*) historical_commission_payments
FROM public.commission_payments GROUP BY workspace_id;
