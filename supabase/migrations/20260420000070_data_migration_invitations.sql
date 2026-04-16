-- Sprint 4.75 data migration — Step 4/5: migrate legacy invitations to v3.
-- Wrapped in DO block (single statement) — see 20260420000060 header note.

DO $mig$ BEGIN
  -- Remap org-level invitation roles (owner/admin → org_admin).
  EXECUTE $stmt$UPDATE invitations SET role = 'org_admin' WHERE role IN ('owner','admin')$stmt$;

  -- Editor/author invitations without site_id → coerce to org_admin (single-tenant
  -- MVP fallback; operator can re-invite with scope if they need site-level).
  EXECUTE $stmt$UPDATE invitations SET role = 'org_admin' WHERE role = 'editor' AND site_id IS NULL$stmt$;

  -- Editor/author invitations WITH site_id → v3 site-scope.
  EXECUTE $stmt$UPDATE invitations SET role_scope = 'site', role = 'editor' WHERE role = 'editor' AND site_id IS NOT NULL$stmt$;
  EXECUTE $stmt$UPDATE invitations SET role = 'reporter', role_scope = 'site' WHERE role = 'author' AND site_id IS NOT NULL$stmt$;

  -- Author without site → org_admin fallback (same logic as editor).
  EXECUTE $stmt$UPDATE invitations SET role = 'org_admin' WHERE role = 'author' AND site_id IS NULL$stmt$;

  -- Swap CHECK: only v3 role vocabulary allowed.
  EXECUTE $stmt$ALTER TABLE invitations DROP CONSTRAINT IF EXISTS invitations_role_check$stmt$;
  EXECUTE $stmt$ALTER TABLE invitations ADD CONSTRAINT invitations_role_check CHECK (role IN ('org_admin','editor','reporter'))$stmt$;

  -- Final scope check: role_scope + site_id + role must be consistent.
  EXECUTE $stmt$ALTER TABLE invitations DROP CONSTRAINT IF EXISTS inv_scope_check$stmt$;
  EXECUTE $stmt$
    ALTER TABLE invitations ADD CONSTRAINT inv_scope_check CHECK (
      (role_scope = 'org' AND site_id IS NULL AND role = 'org_admin')
      OR (role_scope = 'site' AND site_id IS NOT NULL AND role IN ('editor','reporter'))
    )
  $stmt$;
END $mig$;
