-- Pipeline API Intelligence v5: permissive ref_group CHECK + sistema group
-- Replaces rigid enum CHECK with regex to allow Cowork-driven category evolution

BEGIN;

-- Replace rigid CHECK with permissive regex
ALTER TABLE public.reference_content
  DROP CONSTRAINT IF EXISTS reference_content_ref_group_check;

ALTER TABLE public.reference_content
  ADD CONSTRAINT reference_content_ref_group_check
  CHECK (ref_group ~ '^[a-z][a-z0-9_]{0,29}$');

COMMIT;
