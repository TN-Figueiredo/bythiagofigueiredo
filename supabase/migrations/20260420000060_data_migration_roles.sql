-- Sprint 4.75 data migration — Step 1/5: remap legacy roles.
-- Wrapped in DO block (single statement) because Supabase CLI 2.90 fails
-- on multi-statement files even with BEGIN/COMMIT — sequential statements
-- of the same type get conflated into one prepared statement.
-- Inner `EXECUTE $stmt$ ... $stmt$;` runs each mutation atomically within
-- the implicit transaction of the DO block.

DO $mig$ BEGIN
  -- Step 1: remap org-level roles (owner,admin → org_admin)
  EXECUTE $stmt$UPDATE organization_members SET role = 'org_admin' WHERE role IN ('owner','admin')$stmt$;

  -- Step 2: lift editor/author org-level rows to site_memberships
  EXECUTE $stmt$
    INSERT INTO site_memberships (site_id, user_id, role)
    SELECT s.id, om.user_id,
      CASE om.role WHEN 'editor' THEN 'editor' WHEN 'author' THEN 'reporter' END
    FROM organization_members om
    JOIN sites s ON s.org_id = om.org_id
    WHERE om.role IN ('editor','author')
    ON CONFLICT (site_id, user_id) DO NOTHING
  $stmt$;

  -- Step 3: delete org-level editor/author rows
  EXECUTE $stmt$DELETE FROM organization_members WHERE role IN ('editor','author')$stmt$;

  -- Step 4: enforce new CHECK (v3: only org_admin at org level)
  EXECUTE $stmt$ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check$stmt$;
  EXECUTE $stmt$ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check CHECK (role = 'org_admin')$stmt$;
END $mig$;
