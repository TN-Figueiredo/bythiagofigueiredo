-- Sprint 4.75: add branding columns to sites table.
-- These were specified in the v4 design spec but omitted from migration
-- 20260420000001_rbac_v3_schema.sql by the implementing subagent. The
-- follow-up RPC get_site_branding (now at 20260420000016) reads them.
-- Safe to apply to prod even though 001 already ran (IF NOT EXISTS).

ALTER TABLE sites ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS primary_color text;
