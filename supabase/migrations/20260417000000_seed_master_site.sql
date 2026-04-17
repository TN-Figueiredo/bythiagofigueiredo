-- supabase/migrations/20260417000000_seed_master_site.sql
-- No-op stub.
--
-- Original content seeded the master ring organization + bythiagofigueiredo
-- site row, but referenced `sites.primary_domain` — a column added later in
-- 20260420000001_rbac_v3_schema.sql. Lexicographic migration order meant this
-- file ran before the column existed, breaking fresh DB setup (CI + local
-- `supabase db reset`). Prod was unaffected because the column was already
-- present at the time this migration was applied there.
--
-- The seed logic was moved to 20260501000004_seed_master_site.sql, which
-- runs after all column-adding migrations and remains idempotent.
--
-- This file is retained as a no-op to preserve the reference in
-- `supabase_migrations.schema_migrations` on environments (prod) where the
-- original version was already applied.

select 1;
