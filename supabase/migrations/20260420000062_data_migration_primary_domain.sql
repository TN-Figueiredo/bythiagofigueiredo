-- Sprint 4.75 data migration — Step 3/5: sites.primary_domain NOT NULL.
-- Fallback for legacy sites with empty/null domains[] so ALTER doesn't abort.
-- This file contains ONE DO block + ALTER (Supabase CLI 2.90 tolerates single
-- dollar-quoted blocks in a migration; multiple $$ blocks in one file trigger
-- the prepared-statement splitter bug).

UPDATE sites
SET primary_domain = COALESCE(primary_domain, 'site-' || slug || '.invalid')
WHERE primary_domain IS NULL;

DO $$
DECLARE v_missing integer;
BEGIN
  SELECT count(*) INTO v_missing FROM sites WHERE primary_domain IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Pre-NOT-NULL check failed: % sites still have NULL primary_domain', v_missing;
  END IF;
END $$;

ALTER TABLE sites ALTER COLUMN primary_domain SET NOT NULL;
