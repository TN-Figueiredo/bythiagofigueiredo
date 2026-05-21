-- Auto-clear cadence_label when cadence_days changes, so deriveCadenceLabel()
-- always derives a fresh label from cadence_days + cadence_start_date.
-- Prevents stale hardcoded labels from surviving cadence changes.

CREATE OR REPLACE FUNCTION public.clear_cadence_label_on_days_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cadence_days IN (7, 14, 30) THEN
      NEW.cadence_label := NULL;
    END IF;
  ELSIF NEW.cadence_days IS DISTINCT FROM OLD.cadence_days THEN
    NEW.cadence_label := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_cadence_label ON newsletter_types;

CREATE TRIGGER trg_clear_cadence_label
  BEFORE INSERT OR UPDATE ON newsletter_types
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_cadence_label_on_days_change();
