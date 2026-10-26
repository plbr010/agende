-- Automatic finance rows keep the visit date, or the payment date when there is no visit.
CREATE OR REPLACE FUNCTION app.fill_financial_due_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tz text;
BEGIN
  IF NEW.due_date IS NOT NULL THEN
    RETURN NEW;
  END IF;
  v_tz := app.workspace_timezone(NEW.workspace_id);
  IF NEW.appointment_id IS NOT NULL THEN
    SELECT (a.starts_at AT TIME ZONE v_tz)::date
      INTO NEW.due_date
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id
      AND a.workspace_id = NEW.workspace_id;
  END IF;
  IF NEW.due_date IS NULL AND NEW.paid_at IS NOT NULL THEN
    NEW.due_date := (NEW.paid_at AT TIME ZONE v_tz)::date;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION app.fill_financial_due_date() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS financial_entries_fill_due_date ON public.financial_entries;
CREATE TRIGGER financial_entries_fill_due_date
  BEFORE INSERT ON public.financial_entries
  FOR EACH ROW EXECUTE FUNCTION app.fill_financial_due_date();
