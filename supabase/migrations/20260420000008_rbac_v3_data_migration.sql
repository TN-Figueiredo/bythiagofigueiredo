-- supabase/migrations/20260420000008_rbac_v3_data_migration.sql
-- Deterministic migration of existing role data to RBAC v3 model.
-- Must run AFTER 20260420000001 (schema) and BEFORE adding final CHECK constraints.

BEGIN;

-- Step 1: remap org-level roles (owner,admin → org_admin)
UPDATE organization_members SET role = 'org_admin' WHERE role IN ('owner','admin');

-- Step 2: lift editor/author org-level rows to site_memberships
INSERT INTO site_memberships (site_id, user_id, role)
SELECT s.id, om.user_id,
  CASE om.role WHEN 'editor' THEN 'editor' WHEN 'author' THEN 'reporter' END
FROM organization_members om
JOIN sites s ON s.org_id = om.org_id
WHERE om.role IN ('editor','author')
ON CONFLICT (site_id, user_id) DO NOTHING;

-- Step 3: delete org-level editor/author rows
DELETE FROM organization_members WHERE role IN ('editor','author');

-- Step 4: enforce new CHECK
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
  CHECK (role = 'org_admin');

-- Step 5: backfill blog_posts.owner_user_id from authors.user_id
UPDATE blog_posts bp SET owner_user_id = a.user_id
FROM authors a WHERE bp.author_id = a.id AND bp.owner_user_id IS NULL;

-- Fallback: assign each campaign's owner_user_id to any org_admin of the
-- campaign's org. PostgreSQL doesn't allow LIMIT on UPDATE, so we use a
-- DISTINCT ON subquery to pick one deterministic candidate per site.
UPDATE campaigns c SET owner_user_id = sub.user_id
FROM (
  SELECT DISTINCT ON (s.id) s.id AS site_id, om.user_id
  FROM organization_members om
  JOIN sites s ON s.org_id = om.org_id
  WHERE om.role = 'org_admin'
  ORDER BY s.id, om.user_id
) sub
WHERE c.site_id = sub.site_id AND c.owner_user_id IS NULL;

-- Step 6: sites.primary_domain NOT NULL
-- Fallback for any site with empty/null domains[] so ALTER doesn't fail in prod.
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

-- Step 7: migrate legacy invitation rows to v3 roles
-- Existing rows use owner/admin/editor/author; rewrite so the new
-- scope check below can be applied without violating legacy data.
UPDATE invitations SET role = 'org_admin' WHERE role IN ('owner','admin');
-- Any pending 'editor'/'author' invitations left over need a target site;
-- if caller hasn't populated site_id, convert them to org_admin to keep
-- the data valid (single-tenant MVP; can be manually re-issued).
UPDATE invitations SET role = 'org_admin' WHERE role = 'editor' AND site_id IS NULL;
UPDATE invitations SET role_scope = 'site', role = 'editor' WHERE role = 'editor' AND site_id IS NOT NULL;
UPDATE invitations SET role = 'reporter', role_scope = 'site' WHERE role = 'author' AND site_id IS NOT NULL;
UPDATE invitations SET role = 'org_admin' WHERE role = 'author' AND site_id IS NULL;

ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check;
-- Replace with a role check that matches the v3 vocabulary.
ALTER TABLE invitations ADD CONSTRAINT invitations_role_check
  CHECK (role IN ('org_admin','editor','reporter'));

-- Step 7b: invitations final scope check
ALTER TABLE invitations DROP CONSTRAINT IF EXISTS inv_scope_check;
ALTER TABLE invitations ADD CONSTRAINT inv_scope_check CHECK (
  (role_scope = 'org' AND site_id IS NULL AND role = 'org_admin')
  OR (role_scope = 'site' AND site_id IS NOT NULL AND role IN ('editor','reporter'))
);

-- Step 8: validate master ring exists (single org with parent_org_id IS NULL)
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

COMMIT;
