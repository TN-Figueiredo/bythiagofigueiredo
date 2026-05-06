# Migration Squash — 197 → 4 files

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 197 incremental dev-phase migrations into a clean base (schema + storage + seeds + data cleanup), repair remote migration history, and sync both branches.

**Architecture:** Dump the live schema from the single Supabase project (prod, ref `novkqtvcnsiwhkxihurk`), replace all migration files locally, verify via round-trip test, repair remote history with `supabase migration repair`, then push a data-cleanup migration to wipe dev content.

**Tech Stack:** Supabase CLI v2.90+, PostgreSQL 17, pg_dump (via `supabase db dump`), bash scripting

---

## Pre-requisites

- Supabase CLI linked to project: `npm run db:link:prod`
- Local Docker running for round-trip test: `npm run db:start`
- On `staging` branch, clean working tree (except known untracked files)

---

### Task 1: Safety net — git tag + backup dumps

**Files:**
- Create: `supabase/backup_schema_pre_squash.sql` (temporary, gitignored)
- Create: `supabase/backup_data_pre_squash.sql` (temporary, gitignored)

- [ ] **Step 1: Create git tag as rollback point**

```bash
git tag pre-squash-197
```

Expected: tag created, no output.

- [ ] **Step 2: Dump current remote schema (public)**

```bash
npx supabase db dump --schema public -f supabase/backup_schema_pre_squash.sql
```

Expected: file created with full DDL (CREATE TABLE, CREATE FUNCTION, CREATE POLICY, etc).

- [ ] **Step 3: Dump current remote data**

```bash
npx supabase db dump --data-only -f supabase/backup_data_pre_squash.sql
```

Expected: file created with INSERT statements for all rows.

- [ ] **Step 4: Verify both files exist and are non-empty**

```bash
wc -l supabase/backup_schema_pre_squash.sql supabase/backup_data_pre_squash.sql
```

Expected: both files have significant line counts (schema likely 2000+ lines).

- [ ] **Step 5: Ensure backup files are gitignored**

Add to `.gitignore` if not already present:

```
supabase/backup_*_pre_squash.sql
```

---

### Task 2: Dump remote schema and create `0001_schema.sql`

**Files:**
- Create: `supabase/migrations/20260507000001_schema.sql`

- [ ] **Step 1: Dump public schema from remote**

```bash
npx supabase db dump --schema public -f /tmp/raw_schema_dump.sql
```

- [ ] **Step 2: Review the dump for issues**

Open `/tmp/raw_schema_dump.sql` and check:
1. Extensions are present (`CREATE EXTENSION IF NOT EXISTS citext`, `pgcrypto`)
2. All enum types are defined with full value sets (`post_status`, `campaign_status`, `email_provider`, `link_source_type`)
3. All tables are present (check for: `blog_posts`, `newsletter_types`, `tracked_links`, `link_clicks` partitioned table + partitions)
4. Functions use `SECURITY DEFINER` + `SET search_path = public` where needed
5. RLS is enabled on tables + all policies present
6. Views: `newsletter_click_events`, `newsletter_click_events_unified`
7. No references to `supabase_migrations` schema (should not be in public dump)
8. No leftover data statements (this is schema-only)

```bash
grep -c 'CREATE TABLE' /tmp/raw_schema_dump.sql
grep -c 'CREATE POLICY' /tmp/raw_schema_dump.sql
grep -c 'CREATE.*FUNCTION' /tmp/raw_schema_dump.sql
grep 'CREATE TYPE' /tmp/raw_schema_dump.sql
grep 'CREATE EXTENSION' /tmp/raw_schema_dump.sql
grep 'CREATE VIEW\|CREATE OR REPLACE VIEW' /tmp/raw_schema_dump.sql
```

Expected: Dozens of tables, 50+ policies, 30+ functions, 2-4 types, 2 extensions, 2 views.

- [ ] **Step 3: Clean the dump and save as migration 0001**

The dump from `supabase db dump` is already in dependency order (pg_dump handles this). Copy it as the first migration:

```bash
cp /tmp/raw_schema_dump.sql supabase/migrations/20260507000001_schema.sql
```

Then prepend a header comment at the top of the file:

```sql
-- =============================================================================
-- 0001_schema.sql — Squashed from 196 incremental dev-phase migrations.
-- Generated via `supabase db dump --schema public` on 2026-05-06.
-- This is the full DDL for the public schema at Sprint 5f completion.
-- =============================================================================

```

---

### Task 3: Create `0002_storage.sql` — buckets + policies

**Files:**
- Create: `supabase/migrations/20260507000002_storage.sql`

The `supabase db dump --schema public` does NOT include storage buckets or storage.objects policies. These must be added manually from the original migrations.

- [ ] **Step 1: Create the storage migration file**

Write `supabase/migrations/20260507000002_storage.sql` with this exact content:

```sql
-- =============================================================================
-- 0002_storage.sql — Storage buckets + object policies.
-- Extracted from 6 original migrations. Not captured by `db dump --schema public`.
-- =============================================================================

-- ─── 1. Buckets ───

INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-files', 'campaign-files', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-files', 'content-files', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('lgpd-exports', 'lgpd-exports', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'newsletter-assets', 'newsletter-assets', true,
  5242880, ARRAY['image/jpeg','image/png','image/gif','image/webp','image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'author-avatars', 'author-avatars', true,
  2097152, ARRAY['image/jpeg','image/png','image/webp']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'link-assets', 'link-assets', true,
  1048576, ARRAY['image/svg+xml','image/png']
) ON CONFLICT (id) DO NOTHING;

-- ─── 2. Storage policies ───

-- campaign-files: staff all
DROP POLICY IF EXISTS "campaign-files staff all" ON storage.objects;
CREATE POLICY "campaign-files staff all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'campaign-files' AND public.is_staff())
  WITH CHECK (bucket_id = 'campaign-files' AND public.is_staff());

-- content-files: staff all
DROP POLICY IF EXISTS "content-files staff all" ON storage.objects;
CREATE POLICY "content-files staff all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'content-files' AND public.is_staff())
  WITH CHECK (bucket_id = 'content-files' AND public.is_staff());

-- lgpd-exports: own select + service insert/delete
DROP POLICY IF EXISTS "lgpd_exports_own_select" ON storage.objects;
CREATE POLICY "lgpd_exports_own_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lgpd-exports' AND name LIKE auth.uid()::text || '/%');

DROP POLICY IF EXISTS "lgpd_exports_service_insert" ON storage.objects;
CREATE POLICY "lgpd_exports_service_insert" ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'lgpd-exports');

DROP POLICY IF EXISTS "lgpd_exports_service_delete" ON storage.objects;
CREATE POLICY "lgpd_exports_service_delete" ON storage.objects FOR DELETE TO service_role
  USING (bucket_id = 'lgpd-exports');

-- newsletter-assets: staff upload, public read, staff delete
DROP POLICY IF EXISTS "staff_upload_newsletter_assets" ON storage.objects;
CREATE POLICY "staff_upload_newsletter_assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'newsletter-assets' AND public.is_member_staff());

DROP POLICY IF EXISTS "public_read_newsletter_assets" ON storage.objects;
CREATE POLICY "public_read_newsletter_assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'newsletter-assets');

DROP POLICY IF EXISTS "staff_delete_newsletter_assets" ON storage.objects;
CREATE POLICY "staff_delete_newsletter_assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'newsletter-assets' AND public.is_member_staff());

-- author-avatars: staff write, public read
DROP POLICY IF EXISTS "author-avatars staff write" ON storage.objects;
CREATE POLICY "author-avatars staff write"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'author-avatars' AND public.is_staff())
  WITH CHECK (bucket_id = 'author-avatars' AND public.is_staff());

DROP POLICY IF EXISTS "author-avatars public read" ON storage.objects;
CREATE POLICY "author-avatars public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'author-avatars');

-- link-assets: public read, service insert/update/delete
DROP POLICY IF EXISTS "link_assets_public_read" ON storage.objects;
CREATE POLICY "link_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'link-assets');

DROP POLICY IF EXISTS "link_assets_service_insert" ON storage.objects;
CREATE POLICY "link_assets_service_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'link-assets');

DROP POLICY IF EXISTS "link_assets_service_update" ON storage.objects;
CREATE POLICY "link_assets_service_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'link-assets');

DROP POLICY IF EXISTS "link_assets_service_delete" ON storage.objects;
CREATE POLICY "link_assets_service_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'link-assets');
```

---

### Task 4: Create `0003_seed.sql` — config/structural data

**Files:**
- Create: `supabase/migrations/20260507000003_seed.sql`

This seeds: master org + site, default author, 1 newsletter type, consent_texts (v1+v2+v3), cron_config, kill_switches, ad_placeholders. No content data.

- [ ] **Step 1: Extract current seed data from remote**

We need the actual data for config tables. Query remote:

```bash
npx supabase db dump --data-only -f /tmp/raw_data_dump.sql
```

Then extract only the rows for config tables. The tables to seed:
- `organizations` (1 row: master org)
- `sites` (1 row: bythiagofigueiredo)
- `authors` (default author)
- `consent_texts` (v1 + v2 + v3 — LGPD accountability records)
- `cron_config` (system config)
- `kill_switches` (feature flags)
- `ad_placeholders` (default slot configs)
- `newsletter_types` (1 default type)
- `link_settings` (per-site defaults, if any)

```bash
grep -A5 "INSERT INTO public.organizations" /tmp/raw_data_dump.sql | head -10
grep -A10 "INSERT INTO public.sites" /tmp/raw_data_dump.sql | head -20
grep -A5 "INSERT INTO public.consent_texts" /tmp/raw_data_dump.sql | head -50
grep -A5 "INSERT INTO public.cron_config" /tmp/raw_data_dump.sql | head -20
grep -A5 "INSERT INTO public.kill_switches" /tmp/raw_data_dump.sql | head -30
grep -A5 "INSERT INTO public.ad_placeholders" /tmp/raw_data_dump.sql | head -50
grep -A5 "INSERT INTO public.authors" /tmp/raw_data_dump.sql | head -10
```

- [ ] **Step 2: Assemble `0003_seed.sql`**

Create `supabase/migrations/20260507000003_seed.sql`. Structure:

```sql
-- =============================================================================
-- 0003_seed.sql — Structural/config seed data.
-- Master org, site, default author, consent texts, cron config, kill switches,
-- ad placeholders, 1 default newsletter type.
-- =============================================================================

BEGIN;

-- 1. Master organization
-- [INSERT from data dump — use ON CONFLICT DO NOTHING for idempotency]

-- 2. Master site (bythiagofigueiredo)
-- [INSERT from data dump — ON CONFLICT DO NOTHING]

-- 3. Default author
-- [INSERT from data dump — ON CONFLICT DO NOTHING]

-- 4. Consent texts (LGPD accountability — all versions)
-- [INSERT from data dump — ON CONFLICT DO NOTHING]

-- 5. Cron config
-- [INSERT from data dump — ON CONFLICT DO NOTHING]

-- 6. Kill switches
-- [INSERT from data dump — ON CONFLICT DO NOTHING]

-- 7. Ad placeholders
-- [INSERT from data dump — ON CONFLICT DO NOTHING]

-- 8. Newsletter types (1 default)
-- [Single INSERT for main-pt newsletter type — ON CONFLICT DO NOTHING]

COMMIT;
```

Use the actual row data from the data dump. Every INSERT must have `ON CONFLICT DO NOTHING` or `ON CONFLICT ... DO UPDATE` for idempotency.

**Important:** The `organizations` INSERT must come before `sites` (FK dependency). `sites` before `authors`/`newsletter_types` (FK).

---

### Task 5: Create `0004_data_cleanup.sql` — wipe all dev content

**Files:**
- Create: `supabase/migrations/20260507000004_data_cleanup.sql`

- [ ] **Step 1: Write the cleanup migration**

```sql
-- =============================================================================
-- 0004_data_cleanup.sql — Wipe all dev/test content data.
-- Keeps: organizations, sites, authors, consent_texts, cron_config,
--        kill_switches, ad_placeholders, newsletter_types, link_settings.
-- Deletes everything else.
-- =============================================================================

BEGIN;

-- ─── Blog (bottom-up for FK safety) ───
DELETE FROM public.post_hashtags;
DELETE FROM public.blog_translations;
DELETE FROM public.blog_posts;
DELETE FROM public.hashtags;
DELETE FROM public.blog_tags;
DELETE FROM public.blog_cadence;

-- ─── Newsletter data (not types) ───
DELETE FROM public.newsletter_sends;
DELETE FROM public.newsletter_editions;
DELETE FROM public.newsletter_subscriptions;

-- ─── Campaigns ───
DELETE FROM public.campaign_submissions;
DELETE FROM public.campaign_translations;
DELETE FROM public.campaigns;

-- ─── Contact ───
DELETE FROM public.contact_submissions;

-- ─── Links (partitioned — delete from parent cascades to partitions) ───
DELETE FROM public.link_daily_metrics;
DELETE FROM public.link_annotations;
DELETE FROM public.link_goals;
DELETE FROM public.link_alerts;
DELETE FROM public.link_clicks;
DELETE FROM public.tracked_links;
TRUNCATE public.link_aggregation_watermark;

-- ─── Ads (keep placeholders + kill_switches + slot_config) ───
DELETE FROM public.ad_slot_metrics;
DELETE FROM public.ad_slot_creatives;
DELETE FROM public.ad_events;
DELETE FROM public.ad_campaigns;
DELETE FROM public.ad_inquiries;
DELETE FROM public.ad_media;
DELETE FROM public.ad_revenue_daily;
DELETE FROM public.user_app_presence;

-- ─── YouTube ───
DELETE FROM public.youtube_curated_comments;
DELETE FROM public.youtube_sync_log;
DELETE FROM public.youtube_videos;
DELETE FROM public.youtube_channels;
DELETE FROM public.youtube_categories;

-- ─── Email / Audit / Webhooks ───
DELETE FROM public.sent_emails;
DELETE FROM public.webhook_events;
DELETE FROM public.audit_log;

-- ─── Link templates (keep link_settings) ───
DELETE FROM public.link_utm_presets;
DELETE FROM public.link_qr_templates;

-- ─── LGPD (no real users yet, safe to clean) ───
DELETE FROM public.lgpd_requests;
DELETE FROM public.consents;

-- ─── Unsubscribe tokens ───
DELETE FROM public.unsubscribe_tokens;

COMMIT;
```

---

### Task 6: Delete old migrations + place new ones

**Files:**
- Delete: all 197 files in `supabase/migrations/`
- Keep: the 4 new files (0001–0004)

- [ ] **Step 1: Delete all old migration files**

```bash
# Move new files to /tmp first so the glob doesn't catch them
mv supabase/migrations/20260507*.sql /tmp/
rm supabase/migrations/*.sql
mv /tmp/20260507*.sql supabase/migrations/
```

Expected: all 197 old files deleted, 4 new files preserved.

- [ ] **Step 2: Verify only new files remain**

```bash
ls supabase/migrations/
```

Expected:
```
20260507000001_schema.sql
20260507000002_storage.sql
20260507000003_seed.sql
20260507000004_data_cleanup.sql
```

- [ ] **Step 3: Also delete the untracked backfill file**

```bash
rm -f supabase/migrations/20260505000005_backfill_anchor_left_placeholder.sql
```

---

### Task 7: Round-trip verification (local)

**Files:** None (validation only)

This is the critical safety check. We apply the squashed schema from scratch on local Docker and compare against the remote dump.

- [ ] **Step 1: Temporarily remove 0004 (cleanup) — we only want schema parity**

```bash
mv supabase/migrations/20260507000004_data_cleanup.sql /tmp/0004_data_cleanup.sql
```

- [ ] **Step 2: Reset local DB with new migrations**

```bash
npx supabase db reset
```

Expected: local DB recreated from scratch using 0001 + 0002 + 0003. No errors.

If errors appear, investigate and fix the schema/storage/seed files. Common issues:
- Functions referencing tables that don't exist yet (ordering issue in dump)
- `CREATE EXTENSION` needs `schema` qualifier
- Partitioned table syntax issues

- [ ] **Step 3: Dump local schema for comparison**

```bash
npx supabase db dump --local --schema public -f /tmp/local_schema_dump.sql
```

- [ ] **Step 4: Compare local dump vs remote dump**

```bash
diff <(grep -v '^--' supabase/backup_schema_pre_squash.sql | sed '/^$/d' | sort) \
     <(grep -v '^--' /tmp/local_schema_dump.sql | sed '/^$/d' | sort)
```

Expected: minimal or zero differences. Acceptable diffs:
- Comment differences
- Whitespace differences
- `SET` statement ordering

If structural differences exist (missing tables, functions, policies), fix `0001_schema.sql` and re-run from Step 2.

- [ ] **Step 5: Restore the cleanup migration**

```bash
mv /tmp/0004_data_cleanup.sql supabase/migrations/20260507000004_data_cleanup.sql
```

---

### Task 8: Repair remote migration history

**Files:**
- Create: `scripts/squash-repair-remote.sh`

This is the tedious part — tell Supabase that the 196 old migrations are "reverted" and the new ones are "applied". Migration 0001/0002/0003 are already represented by the existing schema (they're a squash, not new DDL). Only 0004 needs actual execution.

- [ ] **Step 1: Create the repair script**

Write `scripts/squash-repair-remote.sh`:

```bash
#!/bin/bash
set -euo pipefail

echo "⚠️  This will rewrite the migration history on the REMOTE Supabase project."
echo "    196 old migrations → reverted"
echo "    3 new migrations (schema+storage+seed) → applied"
echo ""
read -p "Type YES to continue: " confirm
if [ "$confirm" != "YES" ]; then
  echo "Cancelled."
  exit 1
fi

echo ""
echo "=== Phase 1: Mark 196 old migrations as reverted ==="

OLD_VERSIONS=(
20260414000001 20260414000002 20260414000003 20260414000004 20260414000005
20260414000006 20260414000007 20260414000008 20260414000010 20260414000011
20260414000012 20260414000013 20260414000014 20260414000015 20260414000016
20260414000017 20260414000018 20260414000019 20260415000020 20260415000021
20260415000022 20260415000023 20260415000024 20260415000025 20260415000026
20260415000027 20260415000028 20260415000029 20260416000001 20260416000002
20260416000003 20260416000004 20260416000005 20260416000006 20260416000007
20260416000008 20260416000009 20260416000010 20260416000011 20260416000012
20260416000013 20260416000014 20260416000016 20260416000017 20260416000019
20260417000000 20260418000001 20260418000002 20260418000003 20260420000001
20260420000002 20260420000003 20260420000004 20260420000005 20260420000006
20260420000007 20260420000008 20260420000009 20260420000010 20260420000011
20260420000012 20260420000013 20260420000015 20260420000016 20260420000017
20260420000020 20260420000050 20260420000060 20260420000061 20260420000062
20260420000063 20260420000064 20260420000070 20260420000071 20260430000000
20260430000001 20260430000002 20260430000003 20260430000004 20260430000005
20260430000006 20260430000007 20260430000009 20260430000010 20260430000011
20260430000012 20260430000013 20260430000014 20260430000015 20260430000016
20260430000017 20260430000018 20260430000019 20260430000020 20260430000021
20260430000022 20260430000023 20260430000024 20260430000025 20260430000026
20260501000001 20260501000002 20260501000003 20260501000004 20260501000005
20260501000006 20260501000007 20260501000008 20260501000009 20260501000010
20260501000011 20260501000012 20260501000013 20260501000014 20260501000015
20260501000016 20260501000017 20260501000018 20260501000019 20260501000020
20260501000021 20260501000022 20260501000023 20260501000024 20260501000025
20260501000026 20260501000027 20260501000028 20260501100000 20260501100001
20260501100002 20260501100003 20260501100004 20260501100005 20260501100006
20260501100007 20260501100008 20260501100009 20260501100010 20260501100011
20260501100012 20260501100013 20260501100014 20260501100015 20260501100016
20260501100017 20260501100018 20260501100020 20260501100021 20260501100022
20260501100023 20260501100024 20260501100025 20260501100026 20260502000001
20260502000002 20260502000003 20260503000001 20260503000002 20260503000003
20260503000004 20260503000005 20260503000006 20260503000007 20260503000008
20260503000009 20260504000001 20260504000002 20260504000003 20260504000004
20260504000005 20260504000006 20260504100001 20260504100002 20260504100003
20260505000001 20260505000002 20260505000003 20260505000004 20260505000005
20260505100001 20260505100002 20260505100003 20260506000001 20260506000002
20260506000003 20260506000004 20260506000005 20260506000006 20260506000007
20260506000008 20260506000010 20260506000011 20260506000012 20260506000013
20260506000014
)
# NOTE: 20260506000015 intentionally excluded — it was never applied on remote (failed migration).

for v in "${OLD_VERSIONS[@]}"; do
  echo "  Reverting $v..."
  npx supabase migration repair "$v" --status reverted
done

echo ""
echo "=== Phase 2: Mark new squashed migrations as applied ==="

for v in 20260507000001 20260507000002 20260507000003; do
  echo "  Marking $v as applied..."
  npx supabase migration repair "$v" --status applied
done

echo ""
echo "=== Done! Verify with: npx supabase migration list ==="
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/squash-repair-remote.sh
```

- [ ] **Step 3: Run the repair script**

The user runs this interactively:

```bash
npm run db:link:prod && bash scripts/squash-repair-remote.sh
```

Expected: Each version prints "Reverting..." or "Marking applied...", no errors.

- [ ] **Step 4: Verify migration list**

```bash
npx supabase migration list
```

Expected: Only 4 migrations shown:
- `20260507000001` — applied
- `20260507000002` — applied
- `20260507000003` — applied
- `20260507000004` — pending (the data cleanup)

---

### Task 9: Push data cleanup to remote

**Files:** None (remote operation)

- [ ] **Step 1: Push the cleanup migration**

```bash
npm run db:push:prod
```

When prompted, type `YES`, then `y` to apply `20260507000004_data_cleanup.sql`.

Expected: all DELETE statements succeed, no FK violations.

If a table doesn't exist (because it was created in a later sprint than expected), the DELETE will error. Fix by wrapping in `DO $$ BEGIN ... EXCEPTION WHEN undefined_table THEN NULL; END $$;` or simply removing that line.

- [ ] **Step 2: Verify remote is clean**

```bash
npx supabase migration list
```

Expected: all 4 migrations show as applied.

---

### Task 10: Update CI + commit + sync branches

**Files:**
- Modify: `.github/workflows/ci.yml` — remove or update `check-migration-applied` job
- Delete: `scripts/squash-repair-remote.sh` (one-time tool, not needed in repo)

- [ ] **Step 1: Update CI workflow**

The `check-migration-applied` job checks for specific SEO column names. Since the schema is unchanged (just squashed), the check still works. But the job name and comments reference "PR-A migrations" which is now stale. Update the job name and comments to be generic:

In `.github/workflows/ci.yml`, find the `check-migration-applied` job and update:
- Job name: `Schema Pre-Check` (was `SEO Migration Pre-Check`)
- Remove comments about "PR-A" migrations
- Keep the actual column check logic (it still validates the schema is correct)

- [ ] **Step 2: Remove the one-time repair script**

```bash
rm scripts/squash-repair-remote.sh
```

- [ ] **Step 3: Remove temporary backup files**

```bash
rm -f supabase/backup_schema_pre_squash.sql supabase/backup_data_pre_squash.sql
rm -f /tmp/raw_schema_dump.sql /tmp/raw_data_dump.sql /tmp/local_schema_dump.sql
```

- [ ] **Step 4: Run test suite to confirm nothing broke**

```bash
npm run test:web
```

Expected: 2715 tests pass (same as before — schema didn't change, just migration files).

- [ ] **Step 5: Commit on staging**

```bash
git add supabase/migrations/ .github/workflows/ci.yml .gitignore
git commit -m "chore: squash 197 migrations into 4 clean base files

Consolidates all dev-phase incremental migrations into:
- 0001_schema.sql (full public DDL from pg_dump)
- 0002_storage.sql (6 buckets + 16 policies)
- 0003_seed.sql (org, site, author, consent_texts, config)
- 0004_data_cleanup.sql (wipe all dev content)

Remote migration history repaired via supabase migration repair.
Schema is identical — round-trip verified via local db reset + diff."
```

- [ ] **Step 6: Merge staging → main**

```bash
git checkout main
git merge staging
git checkout staging
```

Both branches now have identical migration files pointing at the same clean remote state.

---

### Task 11: Post-squash smoke test

**Files:** None (validation only)

- [ ] **Step 1: Verify dev server starts**

```bash
npm run dev -w apps/web
```

Open the app in browser. Check:
- Homepage loads
- `/cms` dashboard loads (may show empty content — expected)
- No console errors related to missing tables/columns

- [ ] **Step 2: Verify local DB reset works from scratch**

```bash
npx supabase db reset
```

Expected: clean reset with 4 migrations applied, no errors.

- [ ] **Step 3: Final migration list check**

```bash
npx supabase migration list
```

Expected: 4 migrations, all applied on both local and remote.

---

## Rollback Plan

If anything goes wrong at any point:

1. **Before repair script ran:** Just `git checkout -- supabase/migrations/` to restore old files.
2. **After repair but before push:** Re-run repair in reverse — mark old versions as `applied`, new ones as `reverted`. Then restore files from git tag: `git checkout pre-squash-197 -- supabase/migrations/`.
3. **After push (cleanup ran):** Data is gone but schema is intact. Restore data from `backup_data_pre_squash.sql` via `psql` if needed. But since this is dev data being intentionally deleted, this is expected.

## Summary

| Before | After |
|--------|-------|
| 197 migration files | 4 migration files |
| Incremental ALTER chains | Single clean DDL |
| Dev test data in all tables | Clean slate for real data |
| 51 seed/data migrations scattered | 1 consolidated seed file |
