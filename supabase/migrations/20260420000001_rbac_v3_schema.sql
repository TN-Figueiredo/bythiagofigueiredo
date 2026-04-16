-- supabase/migrations/20260420000001_rbac_v3_schema.sql
-- Sprint 4.75: RBAC v3 schema — base tables and columns
-- Idempotent: safe to re-run.

BEGIN;

-- 1. Renormalize organization_members role
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'organization_members_role_check'
      AND table_name = 'organization_members'
  ) THEN
    ALTER TABLE organization_members DROP CONSTRAINT organization_members_role_check;
  END IF;
END $$;

-- (New constraint applied AFTER data migration in 20260420000008)

-- 2. site_memberships
CREATE TABLE IF NOT EXISTS site_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('editor','reporter')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(site_id, user_id)
);
CREATE INDEX IF NOT EXISTS site_memberships_user ON site_memberships (user_id);
CREATE INDEX IF NOT EXISTS site_memberships_site ON site_memberships (site_id);
ALTER TABLE site_memberships ENABLE ROW LEVEL SECURITY;

-- 3. Master ring singleton index
DROP INDEX IF EXISTS organizations_single_master;
CREATE UNIQUE INDEX organizations_single_master
  ON organizations ((parent_org_id IS NULL))
  WHERE parent_org_id IS NULL;

-- 4. sites.primary_domain
ALTER TABLE sites ADD COLUMN IF NOT EXISTS primary_domain text;
UPDATE sites SET primary_domain = domains[1] WHERE primary_domain IS NULL AND array_length(domains, 1) >= 1;
-- NOTE: NOT NULL applied in 20260420000008 after verifying backfill succeeds

-- 5. sites.cms_enabled
ALTER TABLE sites ADD COLUMN IF NOT EXISTS cms_enabled boolean NOT NULL DEFAULT true;

-- 6. Content ownership
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id);

-- Trigger: auto-fill owner_user_id on INSERT
CREATE OR REPLACE FUNCTION set_owner_user_id_on_insert() RETURNS trigger AS $$
BEGIN
  IF NEW.owner_user_id IS NULL THEN
    NEW.owner_user_id := auth.uid();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_owner_blog ON blog_posts;
CREATE TRIGGER trg_set_owner_blog
  BEFORE INSERT ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION set_owner_user_id_on_insert();

DROP TRIGGER IF EXISTS trg_set_owner_campaign ON campaigns;
CREATE TRIGGER trg_set_owner_campaign
  BEFORE INSERT ON campaigns
  FOR EACH ROW EXECUTE FUNCTION set_owner_user_id_on_insert();

-- 7. pending_review enum values
-- Note: both blog_posts.status and campaigns.status use the shared `post_status`
-- enum in this codebase, so only one ALTER TYPE is needed. The plan referenced
-- a separate `campaign_status` type which doesn't exist here — guarded so the
-- statement is a no-op if it stays missing (or fires if later added).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE e.enumlabel = 'pending_review' AND t.typname = 'post_status'
  ) THEN
    ALTER TYPE post_status ADD VALUE 'pending_review' BEFORE 'published';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status' AND typtype = 'e')
    AND NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE e.enumlabel = 'pending_review' AND t.typname = 'campaign_status'
    ) THEN
    EXECUTE 'ALTER TYPE campaign_status ADD VALUE ''pending_review'' BEFORE ''published''';
  END IF;
END $$;

-- 8. Invitation scope columns
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS role_scope text NOT NULL DEFAULT 'org' CHECK (role_scope IN ('org','site'));

-- Constraint applied in 20260420000008 after data migration so existing rows don't violate

COMMIT;
