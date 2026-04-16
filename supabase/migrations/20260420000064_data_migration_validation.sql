-- Sprint 4.75 data migration — Step 5/5: final validation.
-- Single DO block (CLI-safe) that asserts exactly one master ring exists.
-- If 0: migration failed somewhere earlier and data is inconsistent.
-- If >1: the organizations_single_master unique index from migration 001
-- should have prevented this; failing here is defense in depth.

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM organizations WHERE parent_org_id IS NULL;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'data migration check failed: no master ring (parent_org_id IS NULL) found';
  ELSIF v_count > 1 THEN
    RAISE EXCEPTION 'data migration check failed: multiple master rings — unique index should have prevented this';
  END IF;
END $$;
