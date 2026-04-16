-- Sprint 4.75 data migration — Step 1/5: remap legacy roles.
-- Single-statement-friendly (no $$ blocks) to work around Supabase CLI
-- 2.90 prepared-statement splitter bug.

-- Step 1: remap org-level roles (owner,admin → org_admin)

BEGIN;

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

-- Step 4: enforce new CHECK (v3: only org_admin at org level)
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
  CHECK (role = 'org_admin');

COMMIT;
