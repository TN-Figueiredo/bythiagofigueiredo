-- Sprint 4.75 data migration — Step 5/5: final validation.
-- Single DO block (CLI-safe) that asserts AT MOST one master ring exists.
-- Permissive on 0 (prod may not have orgs bootstrapped yet — expected
-- initial state for bythiagofigueiredo pre-first-sign-up). Strict on >1
-- (defense in depth; `organizations_single_master` unique index should
-- have prevented this).

DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM organizations WHERE parent_org_id IS NULL;
  IF v_count = 0 THEN
    RAISE NOTICE 'Sprint 4.75 validation: no master ring yet. App must bootstrap one (name=bythiagofigueiredo, slug=bythiagofigueiredo, parent_org_id=NULL) before inviting users. The unique index organizations_single_master will enforce uniqueness going forward.';
  ELSIF v_count > 1 THEN
    RAISE EXCEPTION 'data migration check failed: multiple master rings (parent_org_id IS NULL) — unique index should have prevented this';
  END IF;
END $$;
