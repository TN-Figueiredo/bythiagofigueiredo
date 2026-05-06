# Migration Squash — 197 → 4 files

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 197 incremental dev-phase migrations into a clean base (schema + storage + seeds + data cleanup), repair remote migration history, and sync both branches.

**Architecture:** Dump the live schema from the single Supabase project (prod, ref `novkqtvcnsiwhkxihurk`), replace all migration files locally, verify via round-trip test, repair remote history with `supabase migration repair`, then push a data-cleanup migration to wipe dev content.

**Tech Stack:** Supabase CLI v2.90+, PostgreSQL 17, pg_dump (via `supabase db dump`), bash scripting

**Critical mental model:** Migrations 0001–0003 are NEVER executed on remote — they represent the *existing* state and are marked as `applied` via `migration repair`. Only 0004 (data cleanup) actually runs on remote. The 0001–0003 files exist so `supabase db reset` on a fresh local Docker produces an identical schema.

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

- [ ] **Step 2: Review the dump for completeness**

```bash
grep -c 'CREATE TABLE' /tmp/raw_schema_dump.sql
grep -c 'CREATE POLICY' /tmp/raw_schema_dump.sql
grep -c 'CREATE.*FUNCTION' /tmp/raw_schema_dump.sql
grep 'CREATE TYPE' /tmp/raw_schema_dump.sql
grep 'CREATE EXTENSION' /tmp/raw_schema_dump.sql
grep 'CREATE VIEW\|CREATE OR REPLACE VIEW' /tmp/raw_schema_dump.sql
```

Expected minimums: 30+ tables, 50+ policies, 30+ functions, 2+ types, 2 extensions (citext, pgcrypto), 2 views (newsletter_click_events, newsletter_click_events_unified).

Check for problematic patterns:

```bash
# Should NOT contain any ALTER TYPE ADD VALUE (would fail inside transaction)
grep 'ALTER TYPE.*ADD VALUE' /tmp/raw_schema_dump.sql

# Should NOT contain data statements
grep '^INSERT INTO\|^COPY' /tmp/raw_schema_dump.sql

# Check for OWNER TO statements (will strip these in step 3)
grep -c 'OWNER TO' /tmp/raw_schema_dump.sql
```

- [ ] **Step 3: Clean the dump**

Strip `OWNER TO` statements (they reference Supabase-internal roles like `supabase_admin` that differ between environments), `SET` preamble statements, and trailing `GRANT`/`REVOKE` blocks:

```bash
sed -E '/^ALTER .* OWNER TO/d; /^SET /d; /^SELECT pg_catalog/d; /^GRANT /d; /^REVOKE /d' \
  /tmp/raw_schema_dump.sql > supabase/migrations/20260507000001_schema.sql
```

Then prepend a header comment at the top of the file:

```sql
-- =============================================================================
-- 0001_schema.sql — Squashed from 196 incremental dev-phase migrations.
-- Generated via `supabase db dump --schema public` on 2026-05-06.
-- This is the full DDL for the public schema at Sprint 5f completion.
-- OWNER TO / SET / GRANT statements stripped (role-dependent, recreated by Supabase).
-- =============================================================================

```

- [ ] **Step 4: Verify critical objects are present**

```bash
# All core tables
for t in blog_posts blog_translations campaigns campaign_translations \
  newsletter_types newsletter_subscriptions newsletter_editions newsletter_sends \
  tracked_links link_clicks link_daily_metrics contact_submissions \
  organizations sites authors site_memberships audit_log \
  consents consent_texts lgpd_requests ad_campaigns ad_placeholders \
  youtube_channels youtube_videos blog_tags hashtags; do
  grep -q "CREATE TABLE.*$t" supabase/migrations/20260507000001_schema.sql && echo "✓ $t" || echo "✗ MISSING: $t"
done

# Partitions
grep 'link_clicks_2026_0' supabase/migrations/20260507000001_schema.sql

# Views
grep 'newsletter_click_events' supabase/migrations/20260507000001_schema.sql

# Key RLS helpers
for f in is_super_admin is_org_admin can_view_site can_edit_site is_member_staff site_visible user_role is_staff; do
  grep -q "FUNCTION.*$f" supabase/migrations/20260507000001_schema.sql && echo "✓ $f()" || echo "✗ MISSING: $f()"
done
```

---

### Task 3: Create `0002_storage.sql` — buckets + policies

**Files:**
- Create: `supabase/migrations/20260507000002_storage.sql`

`supabase db dump --schema public` does NOT include storage buckets or storage.objects policies. These must be added manually.

- [ ] **Step 1: Create the storage migration file**

Write `supabase/migrations/20260507000002_storage.sql`:

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

- [ ] **Step 2: Verify completeness against remote**

```bash
# Check remote has exactly these 6 buckets
npx supabase db dump --schema storage -f /tmp/storage_dump.sql 2>/dev/null
grep 'bucket' /tmp/storage_dump.sql | head -20
```

If the storage dump reveals additional buckets or policies not in our file, add them.

---

### Task 4: Create `0003_seed.sql` — config/structural data

**Files:**
- Create: `supabase/migrations/20260507000003_seed.sql`

This file only matters for LOCAL `db reset` — it is marked as "applied" on remote via repair (never executed there). It seeds config tables so a fresh local DB is functional.

- [ ] **Step 1: Extract seed data from the data dump**

```bash
# Extract specific table data from the full data dump
for table in organizations sites authors consent_texts cron_config kill_switches ad_placeholders ad_slot_config link_settings newsletter_types; do
  echo "=== $table ===" 
  grep "^INSERT INTO public\.$table\b\|^COPY public\.$table\b" supabase/backup_data_pre_squash.sql | head -5
done
```

Review the output. The data dump uses either `INSERT INTO` or `COPY` format. We need to convert to `INSERT ... ON CONFLICT DO NOTHING` for idempotency.

- [ ] **Step 2: Write 0003_seed.sql**

Create `supabase/migrations/20260507000003_seed.sql`. The file must insert in FK-dependency order:

```sql
-- =============================================================================
-- 0003_seed.sql — Structural/config seed data.
-- Only runs on LOCAL db reset. Marked as "applied" on remote via migration repair.
-- Insert order respects FK dependencies.
-- =============================================================================

BEGIN;

-- ─── 1. Master organization ───
-- [Paste the INSERT for organizations from the data dump]
-- Must use ON CONFLICT (slug) DO NOTHING for idempotency

-- ─── 2. Master site ───
-- [Paste the INSERT for sites from the data dump]
-- Must use ON CONFLICT (org_id, slug) DO NOTHING

-- ─── 3. Default author ───
-- [Paste the INSERT for the author with is_default=true from the data dump]
-- Must use ON CONFLICT DO NOTHING

-- ─── 4. Single default newsletter type ───
-- Only seed one: main-pt (Diário do bythiago)
-- Must reference the site_id from step 2

-- ─── 5. Consent texts (ALL versions — LGPD accountability) ───
-- [Paste ALL consent_texts rows from the data dump]
-- These are legal records — every version must be preserved

-- ─── 6. Cron config ───
-- [Paste cron_config rows from the data dump]

-- ─── 7. Kill switches ───
-- [Paste kill_switches rows from the data dump]

-- ─── 8. Ad placeholders ───
-- [Paste ad_placeholders rows from the data dump]

-- ─── 9. Ad slot config (if any rows exist) ───
-- [Paste ad_slot_config rows from the data dump, or skip if empty]

-- ─── 10. Link settings (if any rows exist) ───
-- [Paste link_settings rows from the data dump, or skip if empty]

COMMIT;
```

**Implementation note:** The exact INSERT statements come from the data dump in Step 1. This is a manual extraction step — the executor must:
1. Open `supabase/backup_data_pre_squash.sql`
2. Find each config table's INSERT/COPY block
3. Convert COPY to INSERT if needed
4. Add ON CONFLICT clauses
5. Paste into the seed file

If pg_dump used `COPY` format, convert with:
```bash
# Example conversion (adjust per table):
# COPY public.organizations (id, name, slug, ...) FROM stdin;
# <tab-separated values>
# \.
# → INSERT INTO public.organizations (id, name, slug, ...) VALUES (...) ON CONFLICT DO NOTHING;
```

---

### Task 5: Create `0004_data_cleanup.sql` — wipe all dev content

**Files:**
- Create: `supabase/migrations/20260507000004_data_cleanup.sql`

This is the ONLY migration that actually RUNS on remote. It must handle all FK chains correctly.

- [ ] **Step 1: Write the cleanup migration**

```sql
-- =============================================================================
-- 0004_data_cleanup.sql — Wipe all dev/test content data.
--
-- KEEPS: organizations, sites, consent_texts, cron_config, kill_switches,
--        ad_placeholders, ad_slot_config, link_settings.
-- KEEPS: 1 default author (is_default=true), 1 default newsletter type (main-pt).
-- DELETES: everything else (posts, editions, campaigns, links, ads, youtube, etc).
--
-- This migration RUNS on remote (the only one that does — 0001-0003 are repair-marked).
-- =============================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Blog content (bottom-up for FK safety)
--    blog_posts.author_id → authors (RESTRICT), so delete posts first
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.post_hashtags;
DELETE FROM public.blog_translations;
DELETE FROM public.blog_posts;
DELETE FROM public.hashtags;
DELETE FROM public.blog_cadence;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Newsletter data
--    sends CASCADE from editions, but explicit for clarity
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.newsletter_sends;
DELETE FROM public.newsletter_editions;
DELETE FROM public.newsletter_subscriptions;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Blog tags (must come after posts — post_hashtags FK)
--    Null out bidirectional FK before deleting types/tags
-- ═══════════════════════════════════════════════════════════════════════
UPDATE public.blog_tags SET linked_newsletter_type_id = NULL
  WHERE linked_newsletter_type_id IS NOT NULL;
UPDATE public.newsletter_types SET linked_tag_id = NULL
  WHERE linked_tag_id IS NOT NULL;
DELETE FROM public.blog_tags;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Newsletter types — delete all EXCEPT the main-pt default
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.newsletter_types WHERE id != 'main-pt';

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Campaigns
--    campaign_submissions.campaign_id is RESTRICT — delete submissions first
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.campaign_submissions;
DELETE FROM public.campaign_translations;
DELETE FROM public.campaigns;

-- ═══════════════════════════════════════════════════════════════════════
-- 6. Contact / forms
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.contact_submissions;

-- ═══════════════════════════════════════════════════════════════════════
-- 7. Links (partitioned — delete from parent cascades to partitions)
--    FK chain: link_daily_metrics, link_annotations, link_goals, link_alerts
--    all CASCADE from tracked_links, but explicit deletion avoids surprises
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.link_daily_metrics;
DELETE FROM public.link_annotations;
DELETE FROM public.link_goals;
DELETE FROM public.link_alerts;
DELETE FROM public.link_clicks;
DELETE FROM public.tracked_links;
DELETE FROM public.link_utm_presets;
DELETE FROM public.link_qr_templates;
DELETE FROM public.link_aggregation_watermark;

-- ═══════════════════════════════════════════════════════════════════════
-- 8. Ads (keep placeholders, kill_switches, slot_config)
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.ad_slot_metrics;
DELETE FROM public.ad_slot_creatives;
DELETE FROM public.ad_events;
DELETE FROM public.ad_campaigns;
DELETE FROM public.ad_inquiries;
DELETE FROM public.ad_media;
DELETE FROM public.ad_revenue_daily;
DELETE FROM public.user_app_presence;

-- ═══════════════════════════════════════════════════════════════════════
-- 9. YouTube
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.youtube_curated_comments;
DELETE FROM public.youtube_sync_log;
DELETE FROM public.youtube_videos;
DELETE FROM public.youtube_channels;
DELETE FROM public.youtube_categories;

-- ═══════════════════════════════════════════════════════════════════════
-- 10. Email / Audit / Webhooks / Auth artifacts
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.sent_emails;
DELETE FROM public.webhook_events;
DELETE FROM public.audit_log;
DELETE FROM public.invitations;
DELETE FROM public.password_reset_attempts;
DELETE FROM public.unsubscribe_tokens;

-- ═══════════════════════════════════════════════════════════════════════
-- 11. LGPD (no real users yet — safe to clean)
-- ═══════════════════════════════════════════════════════════════════════
DELETE FROM public.lgpd_requests;
DELETE FROM public.consents;

-- ═══════════════════════════════════════════════════════════════════════
-- 12. Authors — keep only the default
--     blog_posts already deleted above, so author_id RESTRICT is safe
-- ═══════════════════════════════════════════════════════════════════════
UPDATE public.newsletter_types SET author_id = NULL
  WHERE author_id IS NOT NULL;
DELETE FROM public.author_about_translations
  WHERE author_id NOT IN (SELECT id FROM public.authors WHERE is_default = true);
DELETE FROM public.authors WHERE is_default != true;

COMMIT;
```

---

### Task 6: Delete old migrations + place new ones

**Files:**
- Delete: all 197 files in `supabase/migrations/`
- Keep: the 4 new files (0001–0004)

- [ ] **Step 1: Safeguard new files, delete old ones**

```bash
mv supabase/migrations/20260507*.sql /tmp/
rm supabase/migrations/*.sql
mv /tmp/20260507*.sql supabase/migrations/
```

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

Critical safety check: apply squashed schema from scratch on local Docker and compare against remote.

- [ ] **Step 1: Temporarily remove 0004 (cleanup) — we only want schema parity**

```bash
mv supabase/migrations/20260507000004_data_cleanup.sql /tmp/0004_data_cleanup.sql
```

- [ ] **Step 2: Reset local DB with new migrations**

```bash
npx supabase db reset
```

Expected: local DB recreated from scratch using 0001 + 0002 + 0003. No errors.

If errors appear, investigate and fix. Common issues:
- Functions referencing tables not yet created (ordering — fix in 0001)
- `CREATE EXTENSION` needs to come before tables using the extension's types
- Partitioned table syntax issues

- [ ] **Step 3: Structural comparison (object counts)**

Instead of naive line diff, compare actual database objects:

```bash
echo "=== REMOTE ==="
npx supabase db dump --schema public -f /tmp/remote_check.sql
echo "Tables:" && grep -c 'CREATE TABLE' /tmp/remote_check.sql
echo "Functions:" && grep -c 'CREATE.*FUNCTION' /tmp/remote_check.sql
echo "Policies:" && grep -c 'CREATE POLICY' /tmp/remote_check.sql
echo "Indexes:" && grep -c 'CREATE.*INDEX' /tmp/remote_check.sql
echo "Triggers:" && grep -c 'CREATE TRIGGER' /tmp/remote_check.sql
echo "Views:" && grep -c 'CREATE.*VIEW' /tmp/remote_check.sql
echo "Types:" && grep -c 'CREATE TYPE' /tmp/remote_check.sql

echo ""
echo "=== LOCAL ==="
npx supabase db dump --local --schema public -f /tmp/local_check.sql
echo "Tables:" && grep -c 'CREATE TABLE' /tmp/local_check.sql
echo "Functions:" && grep -c 'CREATE.*FUNCTION' /tmp/local_check.sql
echo "Policies:" && grep -c 'CREATE POLICY' /tmp/local_check.sql
echo "Indexes:" && grep -c 'CREATE.*INDEX' /tmp/local_check.sql
echo "Triggers:" && grep -c 'CREATE TRIGGER' /tmp/local_check.sql
echo "Views:" && grep -c 'CREATE.*VIEW' /tmp/local_check.sql
echo "Types:" && grep -c 'CREATE TYPE' /tmp/local_check.sql
```

Expected: all counts match. If any count diverges, investigate by comparing the specific object lists:

```bash
diff <(grep 'CREATE TABLE' /tmp/remote_check.sql | sort) \
     <(grep 'CREATE TABLE' /tmp/local_check.sql | sort)
```

- [ ] **Step 4: Verify key tables exist locally**

```bash
# Quick sanity: query local DB for critical tables
npx supabase db dump --local --schema public 2>/dev/null | grep 'CREATE TABLE' | wc -l
```

- [ ] **Step 5: Restore the cleanup migration**

```bash
mv /tmp/0004_data_cleanup.sql supabase/migrations/20260507000004_data_cleanup.sql
```

---

### Task 8: Repair remote migration history

**Files:**
- Create: `scripts/squash-repair-remote.sh` (one-time, deleted after use)

Tell Supabase that the 196 old migrations are "reverted" and the 3 schema/storage/seed migrations are "applied". Migration 0004 stays pending (it will be pushed next).

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

FAILED=0
for v in "${OLD_VERSIONS[@]}"; do
  echo -n "  Reverting $v... "
  if npx supabase migration repair "$v" --status reverted 2>&1; then
    echo "OK"
  else
    echo "FAILED"
    FAILED=$((FAILED + 1))
  fi
done

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "⚠️  $FAILED versions failed to revert. Check output above."
  echo "    This may happen if a version was already reverted. Continuing..."
fi

echo ""
echo "=== Phase 2: Mark new squashed migrations as applied ==="

for v in 20260507000001 20260507000002 20260507000003; do
  echo -n "  Marking $v as applied... "
  npx supabase migration repair "$v" --status applied
  echo "OK"
done

echo ""
echo "=== Done! Verify with: npx supabase migration list ==="
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/squash-repair-remote.sh
```

- [ ] **Step 3: Run the repair script (USER INTERACTIVE)**

```bash
npm run db:link:prod && bash scripts/squash-repair-remote.sh
```

Type `YES` when prompted. Each version prints status. Takes 2-5 minutes (196 API calls).

- [ ] **Step 4: Verify migration list**

```bash
npx supabase migration list
```

Expected: Only 4 migrations shown:
- `20260507000001` — applied (schema)
- `20260507000002` — applied (storage)
- `20260507000003` — applied (seed)
- `20260507000004` — pending (data cleanup)

---

### Task 9: Push data cleanup to remote

**Files:** None (remote operation)

- [ ] **Step 1: Push the cleanup migration (USER INTERACTIVE)**

```bash
npm run db:push:prod
```

When prompted, type `YES`, then `y` to apply `20260507000004_data_cleanup.sql`.

Expected: all DELETE/UPDATE statements succeed, no FK violations.

- [ ] **Step 2: If any table errors with "does not exist"**

Some tables may not exist if they were added conditionally. Wrap the failing statement in:

```sql
DO $$ BEGIN
  DELETE FROM public.<table_name>;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
```

Then re-push.

- [ ] **Step 3: Verify remote is clean**

```bash
npx supabase migration list
```

Expected: all 4 migrations applied.

---

### Task 10: Update CI + commit + sync branches

**Files:**
- Modify: `.github/workflows/ci.yml`
- Delete: `scripts/squash-repair-remote.sh`
- Modify: `apps/web/src/app/cms/(authed)/newsletters/actions.ts` (the deleteNewsletterType fix from earlier)

- [ ] **Step 1: Update CI workflow — replace stale migration check job**

In `.github/workflows/ci.yml`, find the `check-migration-applied` job (around line 140+). Replace:

```yaml
  check-migration-applied:
    name: SEO Migration Pre-Check
```

With:

```yaml
  check-migration-applied:
    name: Schema Sanity Check
```

And remove the comment block about "PR-A migrations" (it references the old 197-migration era).

- [ ] **Step 2: Remove the one-time repair script**

```bash
rm scripts/squash-repair-remote.sh
```

- [ ] **Step 3: Clean up temporary files**

```bash
rm -f supabase/backup_schema_pre_squash.sql supabase/backup_data_pre_squash.sql
rm -f /tmp/raw_schema_dump.sql /tmp/raw_data_dump.sql /tmp/local_check.sql /tmp/remote_check.sql
```

- [ ] **Step 4: Run test suite**

```bash
npm run test:web
```

Expected: 2715 tests pass.

- [ ] **Step 5: Commit on staging**

```bash
git add -A supabase/migrations/ .github/workflows/ci.yml apps/web/src/app/cms/\(authed\)/newsletters/actions.ts
git add .gitignore
git status
```

Review staged files, then:

```bash
git commit -m "chore: squash 197 migrations into 4 clean base files

Consolidates all dev-phase incremental migrations into:
- 0001_schema.sql (full public DDL from pg_dump)
- 0002_storage.sql (6 buckets + 16 policies)
- 0003_seed.sql (org, site, author, consent_texts, config)
- 0004_data_cleanup.sql (wipe all dev content)

Also fixes deleteNewsletterType FK violation (NOT NULL columns).

Remote migration history repaired via supabase migration repair.
Schema is identical — round-trip verified via local db reset + structural diff."
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

Start the dev server and check:
- Homepage loads
- `/cms` dashboard loads (empty content — expected)
- `/cms/newsletters` shows only "Diário do bythiago" type
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

- [ ] **Step 4: Delete the safety git tag (optional)**

Once confident everything is clean:

```bash
git tag -d pre-squash-197
```

---

## Rollback Plan

| Stage | Recovery |
|-------|----------|
| Before repair ran | `git checkout pre-squash-197 -- supabase/migrations/` restores all 197 files |
| After repair, before push | Re-run repair: mark old as `applied`, new as `reverted`. Then restore files from tag |
| After push (cleanup ran) | Data is intentionally deleted. Restore from `backup_data_pre_squash.sql` via `psql` if needed |

## Summary

| Before | After |
|--------|-------|
| 197 migration files | 4 migration files |
| Incremental ALTER chains | Single clean DDL |
| Dev test data in all tables | Clean slate for real data |
| 51 seed/data migrations scattered | 1 consolidated seed file |
| 8 newsletter types | 1 default (main-pt) |
| Multiple test authors | 1 default author |
| deleteNewsletterType broken | Fixed (DELETE instead of SET NULL) |
