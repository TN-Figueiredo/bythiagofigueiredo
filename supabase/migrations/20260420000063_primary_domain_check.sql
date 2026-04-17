-- Sprint 4.75 data migration — Step 3b/7: assert primary_domain populated
-- before applying NOT NULL. Single DO $$ block.
DO $$
DECLARE v_missing integer;
BEGIN
  SELECT count(*) INTO v_missing FROM sites WHERE primary_domain IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Pre-NOT-NULL check failed: % sites still have NULL primary_domain', v_missing;
  END IF;
END $$;
