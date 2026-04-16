-- Sprint 4.75 data migration — Step 3a/7: populate primary_domain for any
-- legacy site with empty/null domains[]. Single UPDATE statement (no $$).
UPDATE sites
SET primary_domain = COALESCE(primary_domain, 'site-' || slug || '.invalid')
WHERE primary_domain IS NULL;
