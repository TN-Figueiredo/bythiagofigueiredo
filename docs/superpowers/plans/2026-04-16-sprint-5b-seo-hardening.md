# Sprint 5b — SEO Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship maximalist JSON-LD + dynamic OG images + multi-domain-ready sitemap/robots for `bythiagofigueiredo.com`, with Lighthouse CI + post-deploy smoke as quality gates, gated behind 4 feature flags for granular rollback.

**Architecture:** Wrapper layer over `@tn-figueiredo/seo@0.1.0` at `apps/web/lib/seo/` (package has gaps — blanket hreflang, no `alternates.languages`, no host-aware robots). `@graph`-consolidated JSON-LD via `schema-dts@1.1.5`. Dynamic OG via `next/og` Node-runtime routes. `app/sitemap.ts` + `app/robots.ts` resolve site by host directly (not via middleware headers — verified risk per Next #58436). Frontmatter parsed via `gray-matter@4.0.3` before `compileMdx`. Identity profiles committed to code (security-grade).

**Tech Stack:** Next.js 15 + React 19 + TypeScript 5 + Tailwind 4 + Supabase + `@tn-figueiredo/seo@0.1.0` (wrapper) + `schema-dts@1.1.5` + `gray-matter@4.0.3` + `@lhci/cli@0.13.0` + Sentry.

**Spec:** `docs/superpowers/specs/2026-04-16-sprint-5b-seo-hardening-design.md` (921 lines, 98/100 after 5 rounds of recursive audit + 5 parallel verification agents).

---

## Overview — 5 sequential PRs (~14h total)

| PR | Scope | Effort | Depends on |
|---|---|:-:|---|
| **PR-A** | DB migrations (3 SQL files: identity_type/twitter_handle/seo_default_og_image + blog_translations.seo_extras + backfill) | 0.5h | — |
| **PR-B** | `apps/web/lib/seo/` core modules + `app/sitemap.ts` + `app/robots.ts` + 3 OG routes + middleware short-circuit + CI migration-applied gate | 6h | PR-A in prod |
| **PR-C** | Wire 7 existing pages to new factories + `<JsonLdScript>` per page + 11 server actions call cache-invalidation helpers + fix archivePost bug | 5h | PR-B merged |
| **PR-D** | Lighthouse CI (desktop + mobile) + post-deploy smoke script + schema-dts type gate + operator docs | 2h | PR-B, PR-C |
| **PR-E** | `/api/health/seo` + `docs/runbooks/seo-incident.md` + post-deploy checklist + roadmap + CLAUDE.md | 1h | PR-A → PR-D |

**Pre-flight (before any PR):** user must confirm 3 open decisions from spec:
1. **Twitter handle** `@tnFigueiredo` (confirmed 2026-04-17 — distinct from Instagram/YouTube `thiagonfigueiredo`).
2. **`apps/web/public/identity/thiago.jpg`** photo file (1:1, ≥400×400, JPEG <100KB) — blocks PR-B merge.
3. **AI crawler stance** — default permit (no `Disallow:` for GPTBot/CCBot); env `SEO_AI_CRAWLERS_BLOCKED=true` to flip later.

---

## PR-A: DB Schema (~30 min) — **EXECUTED 2026-04-17 — 4 migrations applied, see PR #32**

**Sprint:** 5b SEO Hardening
**Scope:** 4 idempotent SQL migrations (NOT 3 — a bootstrap migration was added mid-execution after pre-flight discovered prod's `sites`/`organizations` tables were empty). Zero application code.

### EXECUTION DIVERGENCE FROM ORIGINAL PLAN (2026-04-17)

**Discovery:** PR-A pre-flight (Task A.1) found `public.sites` and `public.organizations` tables EMPTY in prod. The site at bythiagofigueiredo.com renders only because the homepage uses hardcoded i18n JSON (no DB dependency). Sprint 5b SEO requires `getSiteByDomain()` to resolve, so a bootstrap migration was added.

**Resolution:** New **Task A.0** — `20260417000000_seed_master_site.sql` — inserts `Figueiredo Technology` master org + `bythiagofigueiredo` site row. Applied first in the push (timestamp ordering). All 4 migrations applied via `npx supabase db push --linked --include-all` (the original plan's `npm run db:push:prod` rejected the older timestamp without the flag).

**Plan command drift to fix:** Tasks A.1 and A.5 use `npx supabase db query --linked` — Supabase CLI 2.90 dropped this; correct is `npx supabase db query --linked`. Future re-runs of this plan section MUST substitute that command.

---

### Task A.0: Bootstrap migration (`20260417000000_seed_master_site.sql`)

**Files:**
- Create: `supabase/migrations/20260417000000_seed_master_site.sql`

**Why:** prod had empty `organizations`/`sites` — Sprint 5b SEO can't function without the master site row. Idempotent via `ON CONFLICT (slug)` on both tables (verified `organizations_slug_key` UNIQUE constraint exists).

```sql
do $$
declare
  v_org_id uuid;
  v_site_id uuid;
begin
  insert into public.organizations (name, slug, parent_org_id)
  values ('Figueiredo Technology', 'figueiredo-tech', null)
  on conflict (slug) do update set name = excluded.name
  returning id into v_org_id;

  insert into public.sites (
    org_id, name, slug, domains, primary_domain,
    default_locale, supported_locales, contact_notification_email
  )
  values (
    v_org_id, 'ByThiagoFigueiredo', 'bythiagofigueiredo',
    array['bythiagofigueiredo.com', 'www.bythiagofigueiredo.com'],
    'bythiagofigueiredo.com', 'pt-BR', array['pt-BR', 'en'],
    'thiago@bythiagofigueiredo.com'
  )
  on conflict (org_id, slug) do update set
    domains = excluded.domains, primary_domain = excluded.primary_domain,
    supported_locales = excluded.supported_locales,
    contact_notification_email = excluded.contact_notification_email
  returning id into v_site_id;

  raise notice 'Seeded master org % and site % (bythiagofigueiredo.com)', v_org_id, v_site_id;
end $$;
```

Verification (post-deploy, ran 2026-04-17):
```sql
select slug, primary_domain, supported_locales from public.organizations o
  join public.sites s on s.org_id = o.id
  where s.slug = 'bythiagofigueiredo';
-- Returns: ('figueiredo-tech', 'bythiagofigueiredo.com', '{pt-BR,en}')
```

---

### Original PR-A plan tasks (3 migrations) below — preserved for audit trail. **DO NOT re-execute** — already applied 2026-04-17.
**Spec section:** "Schema changes" + "Rollout sequence > PR-A — DB schema".

Conventions enforced:
- Naming: `YYYYMMDDHHMMSS_<scope>_<change>.sql` (per existing `supabase/migrations/` log).
- Idempotency: `add column if not exists`, `drop constraint if exists` before `add constraint`, guarded `update ... where` (per CLAUDE.md "Idempotência em migrations").
- Migration files plain SQL; Supabase CLI runs each file as a transaction.
- Commits: `feat(db): <subject>` style (matches `391a604 feat(db): migrate 5 Vercel crons to pg_cron`).

---

### Task A.1: Pre-flight verification against prod

**Files:** none (read-only inspection).

- [ ] **Step 1: Confirm CLI linked to prod**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:which
```

Expected: line containing `novkqtvcnsiwhkxihurk`. If not linked: `npm run db:link:prod`.

- [ ] **Step 2: Snapshot sites row(s)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx supabase db query --linked "select slug, primary_domain, supported_locales, default_locale from public.sites order by slug;"
```

Expected: row with `slug='bythiagofigueiredo'`. Record `supported_locales` — backfill in Task A.4 only fires when it equals `{pt-BR}`.

- [ ] **Step 3: Confirm new columns don't already exist**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx supabase db query --linked "select column_name from information_schema.columns where table_schema='public' and table_name='sites' and column_name in ('identity_type','twitter_handle','seo_default_og_image');"
```

Expected: 0 rows.

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npx supabase db query --linked "select column_name from information_schema.columns where table_schema='public' and table_name='blog_translations' and column_name='seo_extras';"
```

Expected: 0 rows.

- [ ] **Step 4: Confirm Twitter handle decision**

Confirmed 2026-04-17: Twitter handle for master site = `tnFigueiredo` (NOT `thiagonfigueiredo` which is the Instagram/YouTube handle — distinct platforms, distinct usernames).

---

### Task A.2: Migration `20260501000001_sites_seo_columns.sql`

**Files:**
- Create: `supabase/migrations/20260501000001_sites_seo_columns.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260501000001_sites_seo_columns.sql
-- Sprint 5b: SEO hardening — add identity_type, twitter_handle, seo_default_og_image to sites.
-- Idempotent: safe to re-run.

-- 1. identity_type — JSON-LD root entity choice (Person vs Organization)
alter table public.sites
  add column if not exists identity_type text not null default 'person';

alter table public.sites
  drop constraint if exists sites_identity_type_chk;
alter table public.sites
  add constraint sites_identity_type_chk
  check (identity_type in ('person','organization'));

comment on column public.sites.identity_type is
  'Sprint 5b — JSON-LD root entity. person=hub site (bythiagofigueiredo), organization=brand site (future ring).';

-- 2. twitter_handle — Twitter Card meta (handle without @)
alter table public.sites
  add column if not exists twitter_handle text;

alter table public.sites
  drop constraint if exists sites_twitter_handle_chk;
alter table public.sites
  add constraint sites_twitter_handle_chk
  check (twitter_handle is null or twitter_handle ~ '^[A-Za-z0-9_]{1,15}$');

comment on column public.sites.twitter_handle is
  'Sprint 5b — Twitter/X handle without @, used in twitter:site card meta.';

-- 3. seo_default_og_image — site-wide static OG fallback (absolute https URL)
alter table public.sites
  add column if not exists seo_default_og_image text;

alter table public.sites
  drop constraint if exists sites_seo_default_og_image_chk;
alter table public.sites
  add constraint sites_seo_default_og_image_chk
  check (seo_default_og_image is null or seo_default_og_image ~ '^https://');

comment on column public.sites.seo_default_og_image is
  'Sprint 5b — Absolute HTTPS URL fallback OG image when dynamic OG disabled or render fails.';
```

- [ ] **Step 2: Validate locally (if Docker available)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:start && npm run db:reset
```

Expected: all migrations applied through `20260501000001_*.sql` with no errors. If no local DB, skip — rely on `db:push:prod` in Task A.5.

- [ ] **Step 3: Local schema verification (only if Step 2 ran)**

```bash
npx supabase db remote sql --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  "select column_name, data_type, is_nullable, column_default from information_schema.columns \
   where table_schema='public' and table_name='sites' \
   and column_name in ('identity_type','twitter_handle','seo_default_og_image') order by column_name;"
```

Expected 3 rows:
```
identity_type        | text | NO  | 'person'::text
seo_default_og_image | text | YES | (null)
twitter_handle       | text | YES | (null)
```

---

### Task A.3: Migration `20260501000002_blog_translations_seo_extras.sql`

**Files:**
- Create: `supabase/migrations/20260501000002_blog_translations_seo_extras.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260501000002_blog_translations_seo_extras.sql
-- Sprint 5b: SEO hardening — add seo_extras jsonb (FAQ/HowTo/Video + per-translation OG override).
-- Idempotent: safe to re-run.

alter table public.blog_translations
  add column if not exists seo_extras jsonb;

-- Structural CHECK only (defense-in-depth). Full validation in Zod (SeoExtrasSchema)
-- inside savePost server action — Sprint 5b PR-C.
alter table public.blog_translations
  drop constraint if exists blog_translations_seo_extras_shape_chk;

alter table public.blog_translations
  add constraint blog_translations_seo_extras_shape_chk
  check (
    seo_extras is null or (
      jsonb_typeof(seo_extras) = 'object'
      and (not (seo_extras ? 'faq')          or jsonb_typeof(seo_extras->'faq')          = 'array')
      and (not (seo_extras ? 'howTo')        or jsonb_typeof(seo_extras->'howTo')        = 'object')
      and (not (seo_extras ? 'video')        or jsonb_typeof(seo_extras->'video')        = 'object')
      and (not (seo_extras ? 'og_image_url') or jsonb_typeof(seo_extras->'og_image_url') = 'string')
    )
  );

comment on column public.blog_translations.seo_extras is
  'Sprint 5b — Structured-data extras (FAQ/HowTo/Video) + per-translation OG image override. Populated via MDX frontmatter on save, validated by Zod (SeoExtrasSchema) before insert.';
```

- [ ] **Step 2: Validate CHECK behavior locally (if Docker up)**

```bash
npx supabase db remote sql --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  "select column_name, data_type from information_schema.columns \
   where table_schema='public' and table_name='blog_translations' and column_name='seo_extras';"
```

Expected: 1 row, `seo_extras | jsonb`.

---

### Task A.4: Migration `20260501000003_seo_backfill.sql` (idempotent data)

**Files:**
- Create: `supabase/migrations/20260501000003_seo_backfill.sql`

- [ ] **Step 1: Create idempotent backfill migration**

```sql
-- supabase/migrations/20260501000003_seo_backfill.sql
-- Sprint 5b: SEO hardening — backfill twitter handle + ensure supported_locales reflects prod reality.
-- Idempotent: each update has a guard preventing clobber/repeat.

-- 1. Backfill twitter handle for master site. Only sets when currently NULL — re-runs are no-op.
update public.sites
set twitter_handle = 'tnFigueiredo'
where slug = 'bythiagofigueiredo'
  and twitter_handle is null;

-- 2. Ensure supported_locales reflects the live ('pt-BR','en') set. Only fires when current
--    value is the schema default {pt-BR} — preserves manual edits, no-op once applied.
update public.sites
set supported_locales = array['pt-BR','en']
where slug = 'bythiagofigueiredo'
  and supported_locales = array['pt-BR'];
```

- [ ] **Step 2: Local validation (if Docker up) — verify idempotency**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:reset && \
  npx supabase db remote sql --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
    "select slug, supported_locales, twitter_handle from public.sites where slug='bythiagofigueiredo';"
```

Expected: row with `supported_locales = {pt-BR,en}` and `twitter_handle = tnFigueiredo`.

Re-apply backfill (simulating re-run):

```bash
npx supabase db remote sql --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  "$(cat supabase/migrations/20260501000003_seo_backfill.sql)" && \
npx supabase db remote sql --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  "select slug, supported_locales, twitter_handle from public.sites where slug='bythiagofigueiredo';"
```

Expected: identical row, no errors.

---

### Task A.5: Push migrations to production

**Files:** none (deploy only).

- [ ] **Step 1: Re-confirm prod link + dry-run plan**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:which && npx supabase migration list --linked
```

Expected: `db:which` shows `novkqtvcnsiwhkxihurk`; migration list shows 3 new files under "Local" only.

- [ ] **Step 2: Push to prod (interactive YES required)**

```bash
npm run db:push:prod
```

Confirm with `Y` when prompted. If push fails on a pre-existing row violating a CHECK, abort and investigate.

- [ ] **Step 3: Post-deploy verification**

```bash
npx supabase db query --linked \
  "select slug, identity_type, twitter_handle, seo_default_og_image, supported_locales from public.sites order by slug;"
```

Expected: master row with `identity_type='person'`, `twitter_handle='tnFigueiredo'`, `seo_default_og_image=null`, `supported_locales={pt-BR,en}`.

```bash
npx supabase db query --linked \
  "select column_name, data_type from information_schema.columns \
   where table_schema='public' and table_name='blog_translations' and column_name='seo_extras';"
```

Expected: `seo_extras | jsonb`.

```bash
npx supabase db query --linked \
  "select conname from pg_constraint \
   where conrelid in ('public.sites'::regclass, 'public.blog_translations'::regclass) \
   and (conname like '%seo%' or conname like '%identity_type%' or conname like '%twitter%') order by conname;"
```

Expected 4 rows: `blog_translations_seo_extras_shape_chk`, `sites_identity_type_chk`, `sites_seo_default_og_image_chk`, `sites_twitter_handle_chk`.

---

### Task A.6: Commit the migrations

**Files:** stage 3 new files.

- [ ] **Step 1: Stage + verify diff scope**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && \
  git add supabase/migrations/20260501000001_sites_seo_columns.sql \
          supabase/migrations/20260501000002_blog_translations_seo_extras.sql \
          supabase/migrations/20260501000003_seo_backfill.sql && \
  git status
```

Expected: only 3 new files staged.

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(db): Sprint 5b PR-A — SEO schema (sites identity_type/twitter_handle/seo_default_og_image + blog_translations.seo_extras)

3 idempotent migrations:
- 20260501000001: add identity_type/twitter_handle/seo_default_og_image to sites with CHECK constraints.
- 20260501000002: add blog_translations.seo_extras jsonb with structural shape CHECK.
- 20260501000003: idempotent backfill — twitter_handle='tnFigueiredo' + supported_locales={pt-BR,en}.

Application code in PR-B reads with fallbacks; this PR is independently mergeable.
EOF
)"
```

- [ ] **Step 3: Push branch (do NOT open PR yet; PR-B description handles both)**

```bash
git push -u origin HEAD
```

CI should pass — migrations don't touch TypeScript.

---

### Task A.7: ROLLBACK reference (do not run unless reverting)

**Files:** none — incident-response only.

```sql
-- Rollback in REVERSE order. Apply via npx supabase db query --linked.
-- Then ADD new migration 20260501999999_revert_sprint5b_pra.sql with these statements —
-- NEVER delete rows from supabase_migrations.schema_migrations.

-- Revert backfill data (idempotent):
update public.sites set twitter_handle = null
  where slug = 'bythiagofigueiredo' and twitter_handle = 'tnFigueiredo';
update public.sites set supported_locales = array['pt-BR']
  where slug = 'bythiagofigueiredo' and supported_locales = array['pt-BR','en'];

-- Revert 20260501000002:
alter table public.blog_translations drop constraint if exists blog_translations_seo_extras_shape_chk;
alter table public.blog_translations drop column if exists seo_extras;

-- Revert 20260501000001:
alter table public.sites drop constraint if exists sites_identity_type_chk;
alter table public.sites drop constraint if exists sites_twitter_handle_chk;
alter table public.sites drop constraint if exists sites_seo_default_og_image_chk;
alter table public.sites drop column if exists identity_type;
alter table public.sites drop column if exists twitter_handle;
alter table public.sites drop column if exists seo_default_og_image;
```

After rollback: `git revert <commit-from-Task-A.6>` so migration ledger stops re-applying.

---

## PR-B: `lib/seo` Core + Dynamic Routes (~6h)

**Scope:** Add ALL new infrastructure under `apps/web/lib/seo/`, create `app/sitemap.ts`, `app/robots.ts`, 3 OG image route handlers, modify `apps/web/src/middleware.ts` for dev-subdomain short-circuit, add `gray-matter` + `schema-dts` deps. Does NOT modify any existing `page.tsx`. Depends on PR-A migrations being applied.

**Convention:** TDD — failing test → minimal impl → passing test → commit. All test commands run from repo root: `cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && npx vitest run <file>`. Typecheck: `cd apps/web && npx tsc --noEmit`.

**Pre-flight blocking items (verify before Task B.1):**
1. PR-A merged + migrations confirmed in prod (`select identity_type from sites limit 0` succeeds).
2. User has supplied `apps/web/public/identity/thiago.jpg` (1:1, ≥400×400, JPEG <100KB) OR confirmed `.gitkeep` placeholder + delayed photo commit (Person.imageUrl will 404 until real photo lands).

---

### Task B.1: Add deps `gray-matter@4.0.3` + `schema-dts@1.1.5`

**Files:**
- Modify: `apps/web/package.json`
- Regenerate: `package-lock.json`

- [ ] **Step 1: Install deps pinned exact (no `^`, per CLAUDE.md)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && \
  npm install --save-exact gray-matter@4.0.3 schema-dts@1.1.5
```

- [ ] **Step 2: Verify pinning**

```bash
grep -E '"(gray-matter|schema-dts)"' apps/web/package.json
```

Expected: `"gray-matter": "4.0.3"`, `"schema-dts": "1.1.5"` (no `^`).

- [ ] **Step 3: Typecheck sanity**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors (no usages yet).

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(deps): add gray-matter@4.0.3 + schema-dts@1.1.5 for SEO (Sprint 5b PR-B)"
```

---

### Task B.2: Add SEO feature flag env vars to `.env.local.example`

**Files:**
- Modify: `apps/web/.env.local.example`

- [ ] **Step 1: Append SEO section**

Edit `apps/web/.env.local.example`, add at end:

```bash
# --- SEO (Sprint 5b) ---
# Per-surface rollback flags, all default true (empty or 'true' = enabled).
NEXT_PUBLIC_SEO_JSONLD_ENABLED=true
NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED=true
NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED=true
# Emergency kill switch for sitemap (returns [] if 'true'; use only to stop draft leak).
SEO_SITEMAP_KILLED=false
# AI crawler stance (GPTBot/CCBot/anthropic-ai). Default permit; set 'true' to Disallow.
SEO_AI_CRAWLERS_BLOCKED=true
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/.env.local.example
git commit -m "chore(env): add SEO feature flag templates for Sprint 5b PR-B"
```

---

### Task B.3: `lib/seo/identity-profiles.ts`

**Files:**
- Create: `apps/web/lib/seo/identity-profiles.ts`
- Test: `apps/web/test/lib/seo/identity-profiles.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/test/lib/seo/identity-profiles.test.ts
import { describe, it, expect } from 'vitest'
import { IDENTITY_PROFILES, getIdentityProfile } from '@/lib/seo/identity-profiles'

describe('identity-profiles', () => {
  it('has bythiagofigueiredo Person profile with required fields', () => {
    const p = getIdentityProfile('bythiagofigueiredo')
    expect(p).not.toBeNull()
    expect(p!.type).toBe('person')
    if (p!.type !== 'person') throw new Error('unreachable')
    expect(p.name).toBe('Thiago Figueiredo')
    expect(p.jobTitle).toBe('Creator & Builder')
    expect(p.imageUrl).toMatch(/^https:\/\/bythiagofigueiredo\.com\/identity\/thiago\.jpg$/)
    expect(p.sameAs).toEqual(expect.arrayContaining([
      expect.stringMatching(/^https:\/\/www\.instagram\.com\//),
      expect.stringMatching(/^https:\/\/www\.youtube\.com\//),
      expect.stringMatching(/^https:\/\/github\.com\//),
    ]))
    expect(p.sameAs.every((u) => u.startsWith('https://'))).toBe(true)
  })

  it('returns null for unknown slug', () => {
    expect(getIdentityProfile('nonexistent-site')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run test/lib/seo/identity-profiles.test.ts
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement**

```typescript
// apps/web/lib/seo/identity-profiles.ts
export interface PersonProfile {
  type: 'person'
  name: string
  jobTitle: string
  imageUrl: string
  sameAs: string[]
}

export interface OrgProfile {
  type: 'organization'
  name: string
  legalName: string
  logoUrl: string
  founderName: string
  sameAs: string[]
}

export type IdentityProfile = PersonProfile | OrgProfile

export const IDENTITY_PROFILES: Record<string, IdentityProfile> = {
  bythiagofigueiredo: {
    type: 'person',
    name: 'Thiago Figueiredo',
    jobTitle: 'Creator & Builder',
    imageUrl: 'https://bythiagofigueiredo.com/identity/thiago.jpg',
    sameAs: [
      'https://www.instagram.com/thiagonfigueiredo',
      'https://www.youtube.com/@bythiagofigueiredo',
      'https://www.youtube.com/@thiagonfigueiredo',
      'https://github.com/tn-figueiredo',
    ],
  },
}

export function getIdentityProfile(siteSlug: string): IdentityProfile | null {
  return IDENTITY_PROFILES[siteSlug] ?? null
}
```

- [ ] **Step 4: Run test**

```bash
cd apps/web && npx vitest run test/lib/seo/identity-profiles.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/identity-profiles.ts apps/web/test/lib/seo/identity-profiles.test.ts
git commit -m "feat(seo): identity profiles registry (Person/Org for JSON-LD root entity)"
```

---

### Task B.4: `lib/seo/noindex.ts`

**Files:**
- Create: `apps/web/lib/seo/noindex.ts`
- Test: `apps/web/test/lib/seo/noindex.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/test/lib/seo/noindex.test.ts
import { describe, it, expect } from 'vitest'
import { PROTECTED_DISALLOW_PATHS, isPathIndexable } from '@/lib/seo/noindex'

describe('noindex', () => {
  it('PROTECTED_DISALLOW_PATHS covers admin/cms/account/api', () => {
    expect(PROTECTED_DISALLOW_PATHS).toEqual(expect.arrayContaining([
      '/admin', '/cms', '/account', '/api',
    ]))
  })

  it.each([
    ['/admin/dashboard', false],
    ['/cms/blog/new', false],
    ['/account/settings', false],
    ['/api/cron/foo', false],
    ['/newsletter/confirm/abc', false],
    ['/unsubscribe/abc', false],
    ['/lgpd/confirm/abc', false],
    ['/site-error', false],
    ['/site-not-configured', false],
    ['/cms/disabled', false],
    ['/blog/pt-BR/some-post', true],
    ['/campaigns/pt-BR/some-campaign', true],
    ['/privacy', true],
    ['/terms', true],
    ['/contact', true],
    ['/', true],
  ])('isPathIndexable(%s) === %s', (path, expected) => {
    expect(isPathIndexable(path)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/web && npx vitest run test/lib/seo/noindex.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// apps/web/lib/seo/noindex.ts
/**
 * Paths that MUST emit `<meta name="robots" content="noindex,nofollow">` AND
 * appear as `Disallow:` lines in robots.txt. Single source of truth consumed
 * by both page metadata factories and robots route handler.
 */
export const PROTECTED_DISALLOW_PATHS: readonly string[] = [
  '/admin',
  '/cms',
  '/account',
  '/api',
  '/newsletter/confirm',
  '/unsubscribe',
  '/lgpd/confirm',
  '/site-error',
  '/site-not-configured',
  '/cms/disabled',
  '/signup/invite',
  '/auth',
]

export function isPathIndexable(pathname: string): boolean {
  return !PROTECTED_DISALLOW_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/noindex.ts apps/web/test/lib/seo/noindex.test.ts
git commit -m "feat(seo): noindex path constants + isPathIndexable helper"
```

---

### Task B.5: `lib/seo/jsonld/extras-schema.ts` (Zod)

**Files:**
- Create: `apps/web/lib/seo/jsonld/extras-schema.ts`
- Test: `apps/web/test/lib/seo/jsonld/extras-schema.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/test/lib/seo/jsonld/extras-schema.test.ts
import { describe, it, expect } from 'vitest'
import { SeoExtrasSchema } from '@/lib/seo/jsonld/extras-schema'

describe('SeoExtrasSchema', () => {
  it('accepts valid FAQ', () => {
    const r = SeoExtrasSchema.safeParse({
      faq: [{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2' }],
    })
    expect(r.success).toBe(true)
  })

  it('rejects empty FAQ array', () => {
    const r = SeoExtrasSchema.safeParse({ faq: [] })
    expect(r.success).toBe(false)
  })

  it('rejects HowTo with single step', () => {
    const r = SeoExtrasSchema.safeParse({
      howTo: { name: 'Test', steps: [{ name: 'only one', text: 'x' }] },
    })
    expect(r.success).toBe(false)
  })

  it('validates VideoObject ISO duration', () => {
    const ok = SeoExtrasSchema.safeParse({
      video: {
        name: 'Demo', description: 'desc', thumbnailUrl: 'https://x.com/t.jpg',
        uploadDate: '2026-04-15', duration: 'PT5M',
      },
    })
    expect(ok.success).toBe(true)
    const bad = SeoExtrasSchema.safeParse({
      video: { name: 'Demo', description: 'd', thumbnailUrl: 'https://x.com/t.jpg', uploadDate: '2026-04-15', duration: 'five minutes' },
    })
    expect(bad.success).toBe(false)
  })

  it('requires og_image_url to be https', () => {
    const bad = SeoExtrasSchema.safeParse({ og_image_url: 'http://x.com/i.png' })
    expect(bad.success).toBe(false)
    const ok = SeoExtrasSchema.safeParse({ og_image_url: 'https://x.com/i.png' })
    expect(ok.success).toBe(true)
  })

  it('rejects unknown top-level keys (strict)', () => {
    const r = SeoExtrasSchema.safeParse({ extra: 'value' })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// apps/web/lib/seo/jsonld/extras-schema.ts
import { z } from 'zod'

export const FaqEntrySchema = z.object({
  q: z.string().min(1).max(500),
  a: z.string().min(1).max(2000),
})

export const HowToStepSchema = z.object({
  name: z.string().min(1).max(200),
  text: z.string().min(1).max(1000),
  imageUrl: z.string().url().optional(),
})

export const VideoObjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  thumbnailUrl: z.string().url(),
  uploadDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.string().regex(/^PT(\d+H)?(\d+M)?(\d+S)?$/).optional(),
  embedUrl: z.string().url().optional(),
})

export const SeoExtrasSchema = z.object({
  faq: z.array(FaqEntrySchema).min(1).max(20).optional(),
  howTo: z.object({
    name: z.string().min(1).max(200),
    steps: z.array(HowToStepSchema).min(2).max(20),
  }).optional(),
  video: VideoObjectSchema.optional(),
  og_image_url: z.string().url().refine((u) => u.startsWith('https://'), 'must be https').optional(),
}).strict()

export type FaqEntry = z.infer<typeof FaqEntrySchema>
export type HowToStep = z.infer<typeof HowToStepSchema>
export type VideoObjectExtra = z.infer<typeof VideoObjectSchema>
export type SeoExtras = z.infer<typeof SeoExtrasSchema>

export class SeoExtrasValidationError extends Error {
  constructor(public issues: z.ZodIssue[]) {
    super(`SeoExtras validation failed: ${issues.map((i) => i.message).join(', ')}`)
    this.name = 'SeoExtrasValidationError'
  }
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/jsonld/extras-schema.ts apps/web/test/lib/seo/jsonld/extras-schema.test.ts
git commit -m "feat(seo): Zod schemas for FAQ/HowTo/Video frontmatter (seo_extras)"
```

---

### Task B.6: `lib/seo/frontmatter.ts` (gray-matter wrapper)

**Files:**
- Create: `apps/web/lib/seo/frontmatter.ts`
- Test: `apps/web/test/lib/seo/frontmatter.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// apps/web/test/lib/seo/frontmatter.test.ts
import { describe, it, expect } from 'vitest'
import { parseMdxFrontmatter, SeoExtrasValidationError } from '@/lib/seo/frontmatter'

describe('parseMdxFrontmatter', () => {
  it('strips frontmatter and returns content body', () => {
    const src = `---\ntitle: Hello\n---\n\n# Body\n\ntext.\n`
    const r = parseMdxFrontmatter(src)
    expect(r.content.trim()).toBe('# Body\n\ntext.')
    expect(r.raw.title).toBe('Hello')
    expect(r.seoExtras).toBeNull()
  })

  it('validates and returns seo_extras when present', () => {
    const src = `---\ntitle: T\nseo_extras:\n  faq:\n    - q: Question?\n      a: Answer.\n---\nbody\n`
    const r = parseMdxFrontmatter(src)
    expect(r.seoExtras).toEqual({ faq: [{ q: 'Question?', a: 'Answer.' }] })
  })

  it('throws SeoExtrasValidationError for invalid extras', () => {
    const src = `---\nseo_extras:\n  faq: []\n---\nbody\n`
    expect(() => parseMdxFrontmatter(src)).toThrow(SeoExtrasValidationError)
  })

  it('returns null seoExtras when no extras key in frontmatter', () => {
    const src = `---\ntitle: T\n---\nbody\n`
    const r = parseMdxFrontmatter(src)
    expect(r.seoExtras).toBeNull()
  })

  it('handles MDX with no frontmatter', () => {
    const src = `# Just content\n\nno frontmatter.\n`
    const r = parseMdxFrontmatter(src)
    expect(r.content).toBe(src)
    expect(r.raw).toEqual({})
    expect(r.seoExtras).toBeNull()
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// apps/web/lib/seo/frontmatter.ts
import matter from 'gray-matter'
import { SeoExtrasSchema, SeoExtrasValidationError, type SeoExtras } from './jsonld/extras-schema'

export { SeoExtrasValidationError } from './jsonld/extras-schema'

export interface ParsedMdx {
  content: string
  seoExtras: SeoExtras | null
  raw: Record<string, unknown>
}

export function parseMdxFrontmatter(source: string): ParsedMdx {
  const { content, data } = matter(source)
  let seoExtras: SeoExtras | null = null
  if (data.seo_extras !== undefined) {
    const parsed = SeoExtrasSchema.safeParse(data.seo_extras)
    if (!parsed.success) {
      throw new SeoExtrasValidationError(parsed.error.issues)
    }
    seoExtras = parsed.data
  }
  return { content, seoExtras, raw: data }
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/frontmatter.ts apps/web/test/lib/seo/frontmatter.test.ts
git commit -m "feat(seo): MDX frontmatter parser with seo_extras Zod validation"
```

---

### Task B.7: `lib/seo/jsonld/types.ts` (schema-dts re-exports)

**Files:**
- Create: `apps/web/lib/seo/jsonld/types.ts`

No test (pure re-exports; typecheck is the gate).

- [ ] **Step 1: Implement**

```typescript
// apps/web/lib/seo/jsonld/types.ts
export type {
  Person,
  Organization,
  WebSite,
  WebPage,
  ContactPage,
  BlogPosting,
  Article,
  BreadcrumbList,
  ListItem,
  FAQPage,
  Question,
  Answer,
  HowTo,
  HowToStep,
  VideoObject,
  ImageObject,
  Graph,
  Thing,
  WithContext,
} from 'schema-dts'

export type JsonLdNode = { '@type': string; '@id'?: string; [k: string]: unknown }
export type JsonLdGraph = { '@context': 'https://schema.org'; '@graph': JsonLdNode[] }
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/seo/jsonld/types.ts
git commit -m "feat(seo): schema-dts type re-exports + JsonLdGraph brand"
```

---

### Task B.8: `lib/seo/jsonld/builders.ts` (typed builders)

**Files:**
- Create: `apps/web/lib/seo/jsonld/builders.ts`
- Create fixtures: `apps/web/test/lib/seo/__fixtures__/seo.ts`
- Test: `apps/web/test/lib/seo/jsonld/builders.test.ts`

- [ ] **Step 1: Write fixtures**

```typescript
// apps/web/test/lib/seo/__fixtures__/seo.ts
import type { SiteSeoConfig } from '@/lib/seo/config'
import type { PersonProfile, OrgProfile } from '@/lib/seo/identity-profiles'
import type { SeoExtras } from '@/lib/seo/jsonld/extras-schema'

export const mockPersonProfile: PersonProfile = {
  type: 'person',
  name: 'Thiago Figueiredo',
  jobTitle: 'Creator & Builder',
  imageUrl: 'https://example.com/identity/thiago.jpg',
  sameAs: ['https://www.instagram.com/x', 'https://github.com/x'],
}

export const mockOrgProfile: OrgProfile = {
  type: 'organization',
  name: 'TN Figueiredo',
  legalName: 'TN Figueiredo LTDA',
  logoUrl: 'https://example.com/logo.png',
  founderName: 'Thiago Figueiredo',
  sameAs: ['https://github.com/tn-figueiredo'],
}

export const mockConfig: SiteSeoConfig = {
  siteId: 'site-1',
  siteName: 'Example',
  siteUrl: 'https://example.com',
  defaultLocale: 'pt-BR',
  supportedLocales: ['pt-BR', 'en'],
  identityType: 'person',
  primaryColor: '#0F172A',
  logoUrl: null,
  twitterHandle: 'tnFigueiredo',
  defaultOgImageUrl: null,
  contentPaths: { blog: '/blog', campaigns: '/campaigns' },
  personIdentity: mockPersonProfile,
  orgIdentity: null,
}

export const mockPost = {
  id: 'post-1',
  title: 'Hello World',
  slug: 'hello-world',
  translation: { title: 'Hello World', slug: 'hello-world', excerpt: 'excerpt', reading_time_min: 3 },
  updated_at: new Date('2026-04-15T00:00:00Z'),
  published_at: new Date('2026-04-14T00:00:00Z'),
  authorName: 'Thiago Figueiredo',
}

export const mockTxs = [
  { locale: 'pt-BR', slug: 'hello-world', title: 'Olá Mundo', excerpt: 'exc', cover_image_url: null, seo_extras: null, content_toc: [] },
  { locale: 'en', slug: 'hello-world-en', title: 'Hello World', excerpt: 'exc-en', cover_image_url: null, seo_extras: null, content_toc: [] },
]

export const mockExtras: SeoExtras = {
  faq: [{ q: 'Q1?', a: 'A1.' }, { q: 'Q2?', a: 'A2.' }],
  howTo: {
    name: 'Do the thing',
    steps: [
      { name: 'Step 1', text: 'Do step 1.' },
      { name: 'Step 2', text: 'Do step 2.' },
    ],
  },
  video: {
    name: 'Video demo',
    description: 'demo',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    uploadDate: '2026-04-10',
  },
}
```

- [ ] **Step 2: Write failing builders test**

```typescript
// apps/web/test/lib/seo/jsonld/builders.test.ts
import { describe, it, expect } from 'vitest'
import {
  buildPersonNode, buildOrgNode, buildWebSiteNode, buildBlogPostingNode,
  buildArticleNode, buildBreadcrumbNode, buildFaqNode, buildHowToNode, buildVideoNode,
} from '@/lib/seo/jsonld/builders'
import { mockConfig, mockPersonProfile, mockOrgProfile, mockPost, mockTxs, mockExtras } from '../__fixtures__/seo'

describe('builders', () => {
  it('buildPersonNode emits Person with #person @id', () => {
    const n = buildPersonNode(mockConfig, mockPersonProfile)
    expect(n['@type']).toBe('Person')
    expect(n['@id']).toBe('https://example.com/#person')
    expect(n.name).toBe('Thiago Figueiredo')
    expect(n.sameAs).toHaveLength(2)
  })

  it('buildOrgNode emits Organization with #organization @id', () => {
    const n = buildOrgNode(mockConfig, mockOrgProfile)
    expect(n['@type']).toBe('Organization')
    expect(n['@id']).toBe('https://example.com/#organization')
  })

  it('buildWebSiteNode includes SearchAction', () => {
    const n = buildWebSiteNode(mockConfig)
    expect(n['@type']).toBe('WebSite')
    expect((n as any).potentialAction).toBeDefined()
  })

  it('buildBlogPostingNode links author to Person @id', () => {
    const n = buildBlogPostingNode(mockConfig, mockPost, mockTxs)
    expect(n['@type']).toBe('BlogPosting')
    expect((n as any).author).toEqual({ '@id': 'https://example.com/#person' })
    expect((n as any).image).toMatch(/\/og\/blog\//)
  })

  it('buildArticleNode emits Article for campaigns', () => {
    const n = buildArticleNode(mockConfig, mockPost, mockTxs)
    expect(n['@type']).toBe('Article')
  })

  it('buildBreadcrumbNode emits ordered ListItem array', () => {
    const n = buildBreadcrumbNode([
      { name: 'Home', url: 'https://example.com/' },
      { name: 'Blog', url: 'https://example.com/blog/pt-BR' },
    ])
    expect(n['@type']).toBe('BreadcrumbList')
    expect((n as any).itemListElement).toHaveLength(2)
    expect((n as any).itemListElement[0].position).toBe(1)
  })

  it('buildFaqNode emits FAQPage', () => {
    const n = buildFaqNode(mockExtras.faq!)
    expect(n['@type']).toBe('FAQPage')
    expect((n as any).mainEntity).toHaveLength(2)
  })

  it('buildHowToNode emits HowTo with steps', () => {
    const n = buildHowToNode(mockExtras.howTo!)
    expect(n['@type']).toBe('HowTo')
    expect((n as any).step).toHaveLength(2)
  })

  it('buildVideoNode emits VideoObject', () => {
    const n = buildVideoNode(mockExtras.video!)
    expect(n['@type']).toBe('VideoObject')
    expect((n as any).uploadDate).toBe('2026-04-10')
  })
})
```

- [ ] **Step 3: Run — FAIL**

- [ ] **Step 4: Implement builders**

```typescript
// apps/web/lib/seo/jsonld/builders.ts
import type { SiteSeoConfig } from '../config'
import type { PersonProfile, OrgProfile } from '../identity-profiles'
import type { SeoExtras, FaqEntry, VideoObjectExtra } from './extras-schema'
import type { JsonLdNode } from './types'

type BlogPostInput = {
  id: string
  translation: { title: string; slug: string; excerpt: string | null; reading_time_min: number }
  updated_at: Date
  published_at: Date
  authorName?: string
}

type TranslationInput = {
  locale: string
  slug: string
  title: string
  excerpt: string | null
  cover_image_url: string | null
  seo_extras: SeoExtras | null
}

export function buildPersonNode(config: SiteSeoConfig, profile: PersonProfile): JsonLdNode {
  return {
    '@type': 'Person',
    '@id': `${config.siteUrl}/#person`,
    name: profile.name,
    jobTitle: profile.jobTitle,
    image: profile.imageUrl,
    url: config.siteUrl,
    sameAs: profile.sameAs,
  }
}

export function buildOrgNode(config: SiteSeoConfig, profile: OrgProfile): JsonLdNode {
  return {
    '@type': 'Organization',
    '@id': `${config.siteUrl}/#organization`,
    name: profile.name,
    legalName: profile.legalName,
    logo: profile.logoUrl,
    url: config.siteUrl,
    founder: { '@type': 'Person', name: profile.founderName },
    sameAs: profile.sameAs,
  }
}

export function buildWebSiteNode(config: SiteSeoConfig): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': `${config.siteUrl}/#website`,
    url: config.siteUrl,
    name: config.siteName,
    inLanguage: config.defaultLocale,
    publisher: { '@id': `${config.siteUrl}/#${config.identityType}` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${config.siteUrl}/blog/${config.defaultLocale}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildBlogPostingNode(
  config: SiteSeoConfig, post: BlogPostInput, translations: TranslationInput[],
): JsonLdNode {
  const tx = translations.find((t) => t.title === post.translation.title) ?? translations[0]
  if (!tx) throw new Error('buildBlogPostingNode: no translation provided')
  const url = `${config.siteUrl}${config.contentPaths.blog}/${tx.locale}/${tx.slug}`
  const image = resolveOgImageForBlog(config, tx, post)
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#blogposting`,
    headline: tx.title,
    description: tx.excerpt ?? '',
    url,
    mainEntityOfPage: { '@id': url },
    datePublished: post.published_at.toISOString(),
    dateModified: post.updated_at.toISOString(),
    inLanguage: tx.locale,
    author: { '@id': `${config.siteUrl}/#${config.identityType}` },
    publisher: { '@id': `${config.siteUrl}/#${config.identityType}` },
    image,
  }
}

export function buildArticleNode(
  config: SiteSeoConfig, post: BlogPostInput, translations: TranslationInput[],
): JsonLdNode {
  const n = buildBlogPostingNode(config, post, translations)
  return { ...n, '@type': 'Article', '@id': (n['@id'] as string).replace('#blogposting', '#article') }
}

export function buildBreadcrumbNode(crumbs: Array<{ name: string; url: string }>): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  }
}

export function buildFaqNode(faq: FaqEntry[]): JsonLdNode {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map((entry) => ({
      '@type': 'Question',
      name: entry.q,
      acceptedAnswer: { '@type': 'Answer', text: entry.a },
    })),
  }
}

export function buildHowToNode(howTo: NonNullable<SeoExtras['howTo']>): JsonLdNode {
  return {
    '@type': 'HowTo',
    name: howTo.name,
    step: howTo.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.imageUrl ? { image: s.imageUrl } : {}),
    })),
  }
}

export function buildVideoNode(video: VideoObjectExtra): JsonLdNode {
  return {
    '@type': 'VideoObject',
    name: video.name,
    description: video.description,
    thumbnailUrl: video.thumbnailUrl,
    uploadDate: video.uploadDate,
    ...(video.duration ? { duration: video.duration } : {}),
    ...(video.embedUrl ? { embedUrl: video.embedUrl } : {}),
  }
}

function resolveOgImageForBlog(config: SiteSeoConfig, tx: TranslationInput, post: BlogPostInput): string {
  if (tx.seo_extras?.og_image_url) return tx.seo_extras.og_image_url
  if (tx.cover_image_url) return tx.cover_image_url
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED !== 'false') {
    return `${config.siteUrl}/og/blog/${tx.locale}/${encodeURIComponent(tx.slug)}`
  }
  return config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`
}
```

- [ ] **Step 5: Run — PASS**

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/seo/jsonld/builders.ts apps/web/test/lib/seo/__fixtures__/seo.ts apps/web/test/lib/seo/jsonld/builders.test.ts
git commit -m "feat(seo): typed JSON-LD builders (Person/Org/WebSite/BlogPosting/Article/Breadcrumb/FAQ/HowTo/Video)"
```

---

### Task B.9: `lib/seo/jsonld/graph.ts` (composeGraph + dedupeBy_id)

**Files:**
- Create: `apps/web/lib/seo/jsonld/graph.ts`
- Test: `apps/web/test/lib/seo/jsonld/graph.test.ts`

- [ ] **Step 1: Test**

```typescript
// apps/web/test/lib/seo/jsonld/graph.test.ts
import { describe, it, expect } from 'vitest'
import { composeGraph } from '@/lib/seo/jsonld/graph'

describe('composeGraph', () => {
  it('wraps nodes in @context + @graph', () => {
    const g = composeGraph([{ '@type': 'Person', '@id': 'x' }])
    expect(g['@context']).toBe('https://schema.org')
    expect(g['@graph']).toHaveLength(1)
  })

  it('dedupes by @id, richer node wins (more keys)', () => {
    const g = composeGraph([
      { '@type': 'Person', '@id': 'x', name: 'A' },
      { '@type': 'Person', '@id': 'x', name: 'A', jobTitle: 'Eng', sameAs: [] },
    ])
    expect(g['@graph']).toHaveLength(1)
    expect((g['@graph'][0] as any).jobTitle).toBe('Eng')
  })

  it('keeps nodes without @id as-is', () => {
    const g = composeGraph([
      { '@type': 'BreadcrumbList', itemListElement: [] },
      { '@type': 'BreadcrumbList', itemListElement: [{}] },
    ])
    expect(g['@graph']).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// apps/web/lib/seo/jsonld/graph.ts
import type { JsonLdGraph, JsonLdNode } from './types'

export function composeGraph(nodes: JsonLdNode[]): JsonLdGraph {
  const deduped = dedupeBy_id(nodes)
  return { '@context': 'https://schema.org', '@graph': deduped }
}

function dedupeBy_id(nodes: JsonLdNode[]): JsonLdNode[] {
  const byId = new Map<string, JsonLdNode>()
  const noId: JsonLdNode[] = []
  for (const n of nodes) {
    if (typeof n['@id'] === 'string') {
      const existing = byId.get(n['@id'])
      if (!existing || countKeys(n) > countKeys(existing)) {
        byId.set(n['@id'], n)
      }
    } else {
      noId.push(n)
    }
  }
  return [...byId.values(), ...noId]
}

function countKeys(n: JsonLdNode): number {
  return Object.keys(n).length
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/jsonld/graph.ts apps/web/test/lib/seo/jsonld/graph.test.ts
git commit -m "feat(seo): @graph composer with @id-based dedupe (richer-wins)"
```

---

### Task B.10: `lib/seo/jsonld/render.tsx` (SSR-safe JsonLdScript)

**Files:**
- Create: `apps/web/lib/seo/jsonld/render.tsx`
- Test: `apps/web/test/lib/seo/jsonld/render.test.tsx`

- [ ] **Step 1: Test**

```typescript
// apps/web/test/lib/seo/jsonld/render.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { JsonLdScript } from '@/lib/seo/jsonld/render'

describe('JsonLdScript', () => {
  it('renders SSR script with escaped JSON', () => {
    const html = renderToString(
      <JsonLdScript graph={{ '@context': 'https://schema.org', '@graph': [{ '@type': 'Person', name: '</script>' }] }} />
    )
    expect(html).toContain('type="application/ld+json"')
    expect(html).not.toContain('</script>')
    expect(html).toContain('\\u003c/script')
  })

  it('returns null when flag disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_SEO_JSONLD_ENABLED', 'false')
    const html = renderToString(
      <JsonLdScript graph={{ '@context': 'https://schema.org', '@graph': [] }} />
    )
    expect(html).toBe('')
    vi.unstubAllEnvs()
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```tsx
// apps/web/lib/seo/jsonld/render.tsx
import type { JsonLdGraph } from './types'

export function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function JsonLdScript({ graph }: { graph: JsonLdGraph }) {
  if (process.env.NEXT_PUBLIC_SEO_JSONLD_ENABLED === 'false') return null
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: escapeJsonForScript(JSON.stringify(graph)) }}
    />
  )
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/jsonld/render.tsx apps/web/test/lib/seo/jsonld/render.test.tsx
git commit -m "feat(seo): SSR-safe <JsonLdScript> with escapeJsonForScript"
```

---

### Task B.11: `lib/seo/host.ts` (isPreviewOrDevHost + resolveSiteByHost)

**Files:**
- Create: `apps/web/lib/seo/host.ts`
- Test: `apps/web/test/lib/seo/host.test.ts`

- [ ] **Step 1: Test**

```typescript
// apps/web/test/lib/seo/host.test.ts
import { describe, it, expect, vi } from 'vitest'
import { isPreviewOrDevHost } from '@/lib/seo/host'

describe('isPreviewOrDevHost', () => {
  it.each([
    ['dev.bythiagofigueiredo.com', true],
    ['foo.vercel.app', true],
    ['localhost', true],
    ['localhost:3001', true],
    ['dev.localhost', true],
    ['bythiagofigueiredo.com', false],
    ['www.bythiagofigueiredo.com', false],
  ])('isPreviewOrDevHost(%s) === %s', (host, expected) => {
    expect(isPreviewOrDevHost(host)).toBe(expected)
  })
})

describe('resolveSiteByHost', () => {
  it('returns null for unknown host', async () => {
    vi.doMock('@/lib/cms/repositories', () => ({ ringContext: () => ({ getSiteByDomain: vi.fn().mockResolvedValue(null) }) }))
    const { resolveSiteByHost } = await import('@/lib/seo/host')
    expect(await resolveSiteByHost('unknown.test')).toBeNull()
  })

  it('returns site record for known host', async () => {
    vi.doMock('@/lib/cms/repositories', () => ({
      ringContext: () => ({ getSiteByDomain: vi.fn().mockResolvedValue({ id: 'site-1', slug: 'bythiagofigueiredo' }) }),
    }))
    const { resolveSiteByHost } = await import('@/lib/seo/host')
    const r = await resolveSiteByHost('bythiagofigueiredo.com')
    expect(r?.slug).toBe('bythiagofigueiredo')
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// apps/web/lib/seo/host.ts
import * as Sentry from '@sentry/nextjs'
import { ringContext } from '@/lib/cms/repositories'

export interface ResolvedSite {
  id: string
  slug: string
  primary_domain: string
}

export function isPreviewOrDevHost(host: string): boolean {
  if (!host) return true
  if (host === 'dev.bythiagofigueiredo.com') return true
  if (host === 'dev.localhost') return true
  if (host.endsWith('.vercel.app')) return true
  if (host === 'localhost' || host.startsWith('localhost:')) return true
  if (host === '127.0.0.1' || host.startsWith('127.0.0.1:')) return true
  return false
}

export async function resolveSiteByHost(host: string): Promise<ResolvedSite | null> {
  try {
    const ring = ringContext()
    const site = (await ring.getSiteByDomain(host)) as ResolvedSite | null
    return site
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'seo-host-resolve', host } })
    return null
  }
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/host.ts apps/web/test/lib/seo/host.test.ts
git commit -m "feat(seo): host helpers (isPreviewOrDevHost + resolveSiteByHost via SupabaseRingContext)"
```

---

### Task B.12: `lib/seo/config.ts` (SiteSeoConfig + getSiteSeoConfig)

**Files:**
- Create: `apps/web/lib/seo/config.ts`
- Test: `apps/web/test/lib/seo/config.test.ts`

- [ ] **Step 1: Test**

```typescript
// apps/web/test/lib/seo/config.test.ts
import { describe, it, expect, vi } from 'vitest'

describe('getSiteSeoConfig', () => {
  it('assembles SiteSeoConfig from sites row + identity profile', async () => {
    vi.doMock('@/lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'site-1', name: 'Thiago Figueiredo', slug: 'bythiagofigueiredo',
                  primary_domain: 'bythiagofigueiredo.com', default_locale: 'pt-BR',
                  supported_locales: ['pt-BR', 'en'], identity_type: 'person',
                  primary_color: '#FF0066', logo_url: null, twitter_handle: 'tnFigueiredo',
                  seo_default_og_image: null,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }))
    const { getSiteSeoConfig } = await import('@/lib/seo/config')
    const c = await getSiteSeoConfig('site-1', 'bythiagofigueiredo.com')
    expect(c.siteUrl).toBe('https://bythiagofigueiredo.com')
    expect(c.identityType).toBe('person')
    expect(c.personIdentity).not.toBeNull()
    expect(c.orgIdentity).toBeNull()
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// apps/web/lib/seo/config.ts
import { unstable_cache } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getIdentityProfile, type PersonProfile, type OrgProfile } from './identity-profiles'

export interface SiteSeoConfig {
  siteId: string
  siteName: string
  siteUrl: string
  defaultLocale: string
  supportedLocales: string[]
  identityType: 'person' | 'organization'
  primaryColor: string
  logoUrl: string | null
  twitterHandle: string | null
  defaultOgImageUrl: string | null
  contentPaths: { blog: string; campaigns: string }
  personIdentity: PersonProfile | null
  orgIdentity: OrgProfile | null
}

async function assembleConfig(siteId: string, host: string): Promise<SiteSeoConfig> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('sites')
    .select('id, name, slug, primary_domain, default_locale, supported_locales, identity_type, primary_color, logo_url, twitter_handle, seo_default_og_image')
    .eq('id', siteId)
    .single()
  if (error || !data) throw new Error(`getSiteSeoConfig: site ${siteId} not found: ${error?.message}`)

  const bareDomain = (data as any).primary_domain?.replace(/^https?:\/\//, '') ?? host
  const identityType = ((data as any).identity_type ?? 'person') as 'person' | 'organization'
  const profile = getIdentityProfile((data as any).slug)

  return {
    siteId: (data as any).id,
    siteName: (data as any).name,
    siteUrl: `https://${bareDomain}`,
    defaultLocale: (data as any).default_locale ?? 'pt-BR',
    supportedLocales: (data as any).supported_locales ?? ['pt-BR'],
    identityType,
    primaryColor: (data as any).primary_color ?? '#0F172A',
    logoUrl: (data as any).logo_url ?? null,
    twitterHandle: (data as any).twitter_handle ?? null,
    defaultOgImageUrl: (data as any).seo_default_og_image ?? null,
    contentPaths: { blog: '/blog', campaigns: '/campaigns' },
    personIdentity: profile?.type === 'person' ? profile : null,
    orgIdentity: profile?.type === 'organization' ? profile : null,
  }
}

export const getSiteSeoConfig = unstable_cache(
  assembleConfig,
  ['seo-config-v1'],
  { revalidate: 3600, tags: ['seo-config'] },
)
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/config.ts apps/web/test/lib/seo/config.test.ts
git commit -m "feat(seo): SiteSeoConfig + cached getSiteSeoConfig (unstable_cache 1h)"
```

---

### Task B.13: `lib/seo/page-metadata.ts` (7 factories)

**Files:**
- Create: `apps/web/lib/seo/page-metadata.ts`
- Test: `apps/web/test/lib/seo/page-metadata.test.ts`

- [ ] **Step 1: Test (snapshot all 7 factories)**

```typescript
// apps/web/test/lib/seo/page-metadata.test.ts
import { describe, it, expect } from 'vitest'
import {
  generateRootMetadata, generateBlogIndexMetadata, generateBlogPostMetadata,
  generateCampaignMetadata, generateLegalMetadata, generateContactMetadata, generateNoindexMetadata,
} from '@/lib/seo/page-metadata'
import { mockConfig, mockPost, mockTxs } from '../__fixtures__/seo'

describe('page-metadata factories', () => {
  it('root metadata has siteName + metadataBase', () => {
    const m = generateRootMetadata(mockConfig)
    expect(m.title).toMatchObject({ default: expect.any(String), template: expect.any(String) })
    expect(m.metadataBase?.href).toBe('https://example.com/')
    expect((m.openGraph as any).siteName).toBe('Example')
  })

  it('blog index has hreflang for supported locales', () => {
    const m = generateBlogIndexMetadata(mockConfig, 'pt-BR')
    const langs = (m.alternates as any).languages
    expect(langs).toMatchObject({ 'pt-BR': '/blog/pt-BR', en: '/blog/en' })
    expect(langs['x-default']).toBe('/blog/pt-BR')
  })

  it('blog post metadata has per-translation hreflang', () => {
    const m = generateBlogPostMetadata(mockConfig, mockPost, mockTxs)
    const langs = (m.alternates as any).languages
    expect(langs['pt-BR']).toBe('/blog/pt-BR/hello-world')
    expect(langs['en']).toBe('/blog/en/hello-world-en')
    expect((m.openGraph as any).type).toBe('article')
  })

  it('legal metadata has noindex=false (indexable)', () => {
    const m = generateLegalMetadata(mockConfig, 'privacy', 'pt-BR')
    expect((m.robots as any)?.index).not.toBe(false)
  })

  it('noindex metadata has robots.index=false', () => {
    const m = generateNoindexMetadata(mockConfig)
    expect((m.robots as any).index).toBe(false)
    expect((m.robots as any).follow).toBe(false)
  })

  it('campaign metadata preserves og_image_url when set', () => {
    const m = generateCampaignMetadata(mockConfig, {
      slug: 'c1', locale: 'pt-BR', meta_title: 'T', meta_description: 'D', og_image_url: 'https://x.com/og.png',
    })
    expect((m.openGraph as any).images?.[0]).toMatchObject({ url: 'https://x.com/og.png' })
  })

  it('contact metadata is indexable with ContactPage-relevant OG', () => {
    const m = generateContactMetadata(mockConfig, 'pt-BR')
    expect(m.title).toMatch(/contact|fale/i)
    expect((m.robots as any)?.index).not.toBe(false)
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement factories (abbreviated; see spec for full rationale)**

```typescript
// apps/web/lib/seo/page-metadata.ts
import type { Metadata } from 'next'
import type { SiteSeoConfig } from './config'

type BlogPostInput = Parameters<typeof import('./jsonld/builders').buildBlogPostingNode>[1]
type TranslationInput = Parameters<typeof import('./jsonld/builders').buildBlogPostingNode>[2][number]
type CampaignInput = { slug: string; locale: string; meta_title: string; meta_description: string; og_image_url?: string | null }

function baseMetadata(config: SiteSeoConfig): Metadata {
  return {
    metadataBase: new URL(config.siteUrl),
    openGraph: { siteName: config.siteName, locale: config.defaultLocale.replace('-', '_') },
    ...(config.twitterHandle ? { twitter: { site: `@${config.twitterHandle}`, creator: `@${config.twitterHandle}`, card: 'summary_large_image' } } : {}),
  }
}

export function generateRootMetadata(config: SiteSeoConfig): Metadata {
  return {
    ...baseMetadata(config),
    title: { default: config.siteName, template: `%s — ${config.siteName}` },
    description: config.personIdentity
      ? `Hub de ${config.personIdentity.name}. Build in public, learn out loud.`
      : `${config.siteName} — conteúdo editorial.`,
    alternates: { canonical: '/' },
  }
}

export function generateBlogIndexMetadata(config: SiteSeoConfig, locale: string): Metadata {
  const languages: Record<string, string> = {}
  for (const loc of config.supportedLocales) languages[loc] = `${config.contentPaths.blog}/${loc}`
  languages['x-default'] = `${config.contentPaths.blog}/${config.defaultLocale}`
  return {
    ...baseMetadata(config),
    title: 'Blog',
    description: `Últimos posts de ${config.siteName}.`,
    alternates: { canonical: `${config.contentPaths.blog}/${locale}`, languages },
  }
}

export function generateBlogPostMetadata(
  config: SiteSeoConfig, post: BlogPostInput, translations: TranslationInput[],
): Metadata {
  const tx = translations.find((t) => t.title === post.translation.title) ?? translations[0]
  if (!tx) throw new Error('generateBlogPostMetadata: no translation')
  const languages: Record<string, string> = {}
  for (const t of translations) {
    languages[t.locale] = `${config.contentPaths.blog}/${t.locale}/${encodeURIComponent(t.slug)}`
  }
  const defaultTx = translations.find((t) => t.locale === config.defaultLocale) ?? tx
  languages['x-default'] = `${config.contentPaths.blog}/${defaultTx.locale}/${encodeURIComponent(defaultTx.slug)}`
  const ogImage = resolveOgImage(config, tx, post)
  return {
    ...baseMetadata(config),
    title: tx.title,
    description: tx.excerpt ?? undefined,
    alternates: { canonical: `${config.contentPaths.blog}/${tx.locale}/${encodeURIComponent(tx.slug)}`, languages },
    openGraph: {
      ...baseMetadata(config).openGraph,
      type: 'article',
      publishedTime: post.published_at.toISOString(),
      modifiedTime: post.updated_at.toISOString(),
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
  }
}

export function generateCampaignMetadata(config: SiteSeoConfig, c: CampaignInput): Metadata {
  const ogImage = c.og_image_url ?? `${config.siteUrl}/og/campaigns/${c.locale}/${encodeURIComponent(c.slug)}`
  return {
    ...baseMetadata(config),
    title: c.meta_title,
    description: c.meta_description,
    alternates: { canonical: `${config.contentPaths.campaigns}/${c.locale}/${encodeURIComponent(c.slug)}` },
    openGraph: { ...baseMetadata(config).openGraph, type: 'article', images: [{ url: ogImage, width: 1200, height: 630 }] },
  }
}

export function generateLegalMetadata(config: SiteSeoConfig, type: 'privacy' | 'terms', locale: string): Metadata {
  const titles = { privacy: { 'pt-BR': 'Política de Privacidade', en: 'Privacy Policy' }, terms: { 'pt-BR': 'Termos de Uso', en: 'Terms of Use' } }
  const descs = { privacy: { 'pt-BR': 'LGPD — dados, direitos, cookies.', en: 'GDPR/LGPD — data, rights, cookies.' }, terms: { 'pt-BR': 'Termos de uso.', en: 'Terms of use.' } }
  const loc = (locale === 'en' ? 'en' : 'pt-BR') as 'pt-BR' | 'en'
  return {
    ...baseMetadata(config),
    title: titles[type][loc],
    description: descs[type][loc],
    alternates: { canonical: `/${type}` },
    robots: { index: true, follow: true },
  }
}

export function generateContactMetadata(config: SiteSeoConfig, locale: string): Metadata {
  const t = locale === 'en' ? { title: 'Contact', desc: `Get in touch with ${config.siteName}.` } : { title: 'Fale comigo', desc: `Entre em contato com ${config.siteName}.` }
  return {
    ...baseMetadata(config),
    title: t.title, description: t.desc,
    alternates: { canonical: '/contact' },
    robots: { index: true, follow: true },
  }
}

export function generateNoindexMetadata(config: SiteSeoConfig): Metadata {
  return {
    ...baseMetadata(config),
    robots: { index: false, follow: false },
  }
}

function resolveOgImage(config: SiteSeoConfig, tx: TranslationInput, post: BlogPostInput): string {
  if (tx.seo_extras?.og_image_url) return tx.seo_extras.og_image_url
  if (tx.cover_image_url) return tx.cover_image_url
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED !== 'false') {
    return `${config.siteUrl}/og/blog/${tx.locale}/${encodeURIComponent(tx.slug)}`
  }
  return config.defaultOgImageUrl ?? `${config.siteUrl}/og-default.png`
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/page-metadata.ts apps/web/test/lib/seo/page-metadata.test.ts
git commit -m "feat(seo): 7 page metadata factories + OG image precedence chain"
```

---

### Task B.14a: Extend `test/helpers/db-seed.ts` with blog-post helpers

**Files:**
- Modify: `apps/web/test/helpers/db-seed.ts` (extend existing helper module)

CLAUDE.md confirms `db-seed.ts` exports `seedSite`, `seedStaffUser`, `seedPendingNewsletterSub`, `seedUnsubscribeToken`, `seedCampaign`, `signUserJwt` — but no blog-post helpers. B.14 enumerator test depends on 3 new helpers.

- [ ] **Step 1: Read existing helpers to match conventions**

```bash
cat apps/web/test/helpers/db-seed.ts
```

Note the patterns: returns inserted row id, uses service-role client, idempotent where applicable.

- [ ] **Step 2: Append helpers**

```typescript
// Append to apps/web/test/helpers/db-seed.ts
export async function seedPublishedPost(
  siteId: string,
  opts: { slug: string; locale: string; title?: string; ownerUserId?: string },
): Promise<{ postId: string; translationId: string }> {
  const supabase = getSupabaseServiceClient()
  const { data: post, error: pe } = await supabase
    .from('blog_posts')
    .insert({
      site_id: siteId, status: 'published',
      published_at: new Date(Date.now() - 1000).toISOString(),
      owner_user_id: opts.ownerUserId ?? null,
    })
    .select('id').single()
  if (pe || !post) throw new Error(`seedPublishedPost: ${pe?.message}`)
  const { data: tx, error: te } = await supabase
    .from('blog_translations')
    .insert({
      post_id: post.id, locale: opts.locale, slug: opts.slug,
      title: opts.title ?? `Post ${opts.slug}`, content_mdx: '# Body', excerpt: 'excerpt',
      reading_time_min: 1, content_toc: [],
    })
    .select('id').single()
  if (te || !tx) throw new Error(`seedPublishedPost translation: ${te?.message}`)
  return { postId: post.id, translationId: tx.id }
}

export async function seedDraftPost(
  siteId: string, opts: { slug: string; locale: string; ownerUserId?: string },
): Promise<{ postId: string }> {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({ site_id: siteId, status: 'draft', published_at: null, owner_user_id: opts.ownerUserId ?? null })
    .select('id').single()
  if (error || !data) throw new Error(`seedDraftPost: ${error?.message}`)
  await supabase.from('blog_translations').insert({
    post_id: data.id, locale: opts.locale, slug: opts.slug, title: 'Draft',
    content_mdx: '# Body', excerpt: 'x', reading_time_min: 1, content_toc: [],
  })
  return { postId: data.id }
}

export async function seedFutureScheduledPost(
  siteId: string, opts: { slug: string; locale: string; ownerUserId?: string },
): Promise<{ postId: string }> {
  const supabase = getSupabaseServiceClient()
  const future = new Date(Date.now() + 7 * 86400_000).toISOString()
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({ site_id: siteId, status: 'scheduled', published_at: future, owner_user_id: opts.ownerUserId ?? null })
    .select('id').single()
  if (error || !data) throw new Error(`seedFutureScheduledPost: ${error?.message}`)
  await supabase.from('blog_translations').insert({
    post_id: data.id, locale: opts.locale, slug: opts.slug, title: 'Future',
    content_mdx: '# Body', excerpt: 'x', reading_time_min: 1, content_toc: [],
  })
  return { postId: data.id }
}
```

- [ ] **Step 3: Verify imports compile**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/helpers/db-seed.ts
git commit -m "test(seo): extend db-seed helpers (seedPublishedPost/Draft/FutureScheduledPost) for enumerator tests"
```

---

### Task B.14: `lib/seo/enumerator.ts` (RLS-mirroring sitemap enumerator)

**Files:**
- Create: `apps/web/lib/seo/enumerator.ts`
- Test: `apps/web/test/lib/seo/enumerator.test.ts` (DB-gated integration)

- [ ] **Step 1: Test (DB-gated, requires Task B.14a helpers)**

```typescript
// apps/web/test/lib/seo/enumerator.test.ts
import { describe, it, expect } from 'vitest'
import { skipIfNoLocalDb } from '@/test/helpers/db-skip'

describe.skipIf(skipIfNoLocalDb())('enumerateSiteRoutes (RLS mirror)', () => {
  it('excludes drafts and future-scheduled posts', async () => {
    const { seedSite, seedPublishedPost, seedDraftPost, seedFutureScheduledPost } = await import('@/test/helpers/db-seed')
    const site = await seedSite({ slug: 'test-site' })
    await seedPublishedPost(site.id, { slug: 'published-1', locale: 'pt-BR' })
    await seedDraftPost(site.id, { slug: 'draft-1', locale: 'pt-BR' })
    await seedFutureScheduledPost(site.id, { slug: 'future-1', locale: 'pt-BR' })

    const { enumerateSiteRoutes } = await import('@/lib/seo/enumerator')
    const { getSiteSeoConfig } = await import('@/lib/seo/config')
    const config = await getSiteSeoConfig(site.id, 'test-site.invalid')
    const routes = await enumerateSiteRoutes(site.id, config)
    const paths = routes.map((r) => r.path)
    expect(paths).toContain('/blog/pt-BR/published-1')
    expect(paths).not.toContain('/blog/pt-BR/draft-1')
    expect(paths).not.toContain('/blog/pt-BR/future-1')
  })

  it('includes static routes for supported locales', async () => {
    const { seedSite } = await import('@/test/helpers/db-seed')
    const site = await seedSite({ slug: 'static-test' })
    const { enumerateSiteRoutes } = await import('@/lib/seo/enumerator')
    const { getSiteSeoConfig } = await import('@/lib/seo/config')
    const config = await getSiteSeoConfig(site.id, 'static-test.invalid')
    const routes = await enumerateSiteRoutes(site.id, config)
    expect(routes.map((r) => r.path)).toEqual(expect.arrayContaining(['/', '/privacy', '/terms', '/contact']))
  })
})
```

(Assumes `seedPublishedPost`, `seedDraftPost`, `seedFutureScheduledPost` exist in `test/helpers/db-seed.ts`; add if missing — extend `test/helpers/db-seed.ts` with the 3 helpers that insert blog_posts + blog_translations with status/published_at matching.)

- [ ] **Step 2: Run — FAIL (if local DB up, else SKIP)**

```bash
HAS_LOCAL_DB=1 cd apps/web && npx vitest run test/lib/seo/enumerator.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// apps/web/lib/seo/enumerator.ts
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { SiteSeoConfig } from './config'

export interface SitemapRouteEntry {
  path: string
  lastModified: Date
  changeFrequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  priority: number
  alternates: Record<string, string>
}

const STATIC_ROUTE_DEFS: Array<Omit<SitemapRouteEntry, 'lastModified' | 'alternates'> & { alternates?: Record<string, string> }> = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
]

export async function enumerateSiteRoutes(
  siteId: string, config: SiteSeoConfig,
): Promise<SitemapRouteEntry[]> {
  if (process.env.SEO_SITEMAP_KILLED === 'true') {
    Sentry.captureMessage('sitemap: killed via SEO_SITEMAP_KILLED', { level: 'warning' })
    return []
  }

  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const [posts, campaigns] = await Promise.all([
    supabase
      .from('blog_translations')
      .select('slug, locale, updated_at, blog_posts!inner(id, status, published_at, site_id)')
      .eq('blog_posts.site_id', siteId)
      .eq('blog_posts.status', 'published')
      .lte('blog_posts.published_at', now)
      .not('blog_posts.published_at', 'is', null),
    supabase
      .from('campaign_translations')
      .select('slug, locale, updated_at, campaigns!inner(id, status, site_id)')
      .eq('campaigns.site_id', siteId)
      .eq('campaigns.status', 'active'),
  ])

  if (posts.error || campaigns.error) {
    Sentry.captureException(posts.error ?? campaigns.error, {
      tags: { component: 'seo-enumerator', siteId },
    })
    return buildStaticRoutes(config)
  }

  const postsById = new Map<string, Array<{ locale: string; slug: string; updated_at: string }>>()
  for (const t of posts.data ?? []) {
    const p = (t as any).blog_posts
    if (!p) continue
    if (!postsById.has(p.id)) postsById.set(p.id, [])
    postsById.get(p.id)!.push({ locale: (t as any).locale, slug: (t as any).slug, updated_at: (t as any).updated_at })
  }

  const postRoutes: SitemapRouteEntry[] = []
  for (const translations of postsById.values()) {
    for (const t of translations) {
      const alternates: Record<string, string> = {}
      for (const alt of translations) alternates[alt.locale] = `${config.contentPaths.blog}/${alt.locale}/${alt.slug}`
      postRoutes.push({
        path: `${config.contentPaths.blog}/${t.locale}/${t.slug}`,
        lastModified: new Date(t.updated_at),
        changeFrequency: 'weekly', priority: 0.7,
        alternates,
      })
    }
  }

  const campaignsById = new Map<string, Array<{ locale: string; slug: string; updated_at: string }>>()
  for (const t of campaigns.data ?? []) {
    const c = (t as any).campaigns
    if (!c) continue
    if (!campaignsById.has(c.id)) campaignsById.set(c.id, [])
    campaignsById.get(c.id)!.push({ locale: (t as any).locale, slug: (t as any).slug, updated_at: (t as any).updated_at })
  }
  const campaignRoutes: SitemapRouteEntry[] = []
  for (const translations of campaignsById.values()) {
    for (const t of translations) {
      const alternates: Record<string, string> = {}
      for (const alt of translations) alternates[alt.locale] = `${config.contentPaths.campaigns}/${alt.locale}/${alt.slug}`
      campaignRoutes.push({
        path: `${config.contentPaths.campaigns}/${t.locale}/${t.slug}`,
        lastModified: new Date(t.updated_at),
        changeFrequency: 'monthly', priority: 0.8,
        alternates,
      })
    }
  }

  const blogIndex: SitemapRouteEntry = {
    path: `${config.contentPaths.blog}/${config.defaultLocale}`,
    lastModified: new Date(),
    changeFrequency: 'daily', priority: 0.9,
    alternates: Object.fromEntries(config.supportedLocales.map((l) => [l, `${config.contentPaths.blog}/${l}`])),
  }

  const all = [...buildStaticRoutes(config), blogIndex, ...postRoutes, ...campaignRoutes]
  return all.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
}

function buildStaticRoutes(config: SiteSeoConfig): SitemapRouteEntry[] {
  const now = new Date()
  return STATIC_ROUTE_DEFS.map((s) => ({
    ...s,
    lastModified: now,
    alternates: {},
  }))
}
```

- [ ] **Step 4: Run — PASS (DB-gated)**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/enumerator.ts apps/web/test/lib/seo/enumerator.test.ts
git commit -m "feat(seo): RLS-mirroring sitemap enumerator with kill switch (SEO_SITEMAP_KILLED)"
```

---

### Task B.15: `lib/seo/cache-invalidation.ts`

**Files:**
- Create: `apps/web/lib/seo/cache-invalidation.ts`
- Test: `apps/web/test/lib/seo/cache-invalidation.test.ts`

- [ ] **Step 1: Test**

```typescript
// apps/web/test/lib/seo/cache-invalidation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const revalidateTag = vi.fn()
const revalidatePath = vi.fn()

vi.mock('next/cache', () => ({ revalidateTag, revalidatePath }))

describe('cache-invalidation helpers', () => {
  beforeEach(() => { revalidateTag.mockClear(); revalidatePath.mockClear() })

  it('revalidateBlogPostSeo invalidates post/og/sitemap tags + 2 paths', async () => {
    const { revalidateBlogPostSeo } = await import('@/lib/seo/cache-invalidation')
    revalidateBlogPostSeo('site-1', 'post-123', 'pt-BR', 'my-post')
    expect(revalidateTag).toHaveBeenCalledWith('blog:post:post-123')
    expect(revalidateTag).toHaveBeenCalledWith('og:blog:post-123')
    expect(revalidateTag).toHaveBeenCalledWith('sitemap:site-1')
    expect(revalidatePath).toHaveBeenCalledWith('/blog/pt-BR/my-post')
    expect(revalidatePath).toHaveBeenCalledWith('/blog/pt-BR')
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// apps/web/lib/seo/cache-invalidation.ts
import { revalidateTag, revalidatePath } from 'next/cache'

export function revalidateBlogPostSeo(siteId: string, postId: string, locale: string, slug: string): void {
  revalidateTag(`blog:post:${postId}`)
  revalidateTag(`og:blog:${postId}`)
  revalidateTag(`sitemap:${siteId}`)
  revalidatePath(`/blog/${locale}/${slug}`)
  revalidatePath(`/blog/${locale}`)
}

export function revalidateCampaignSeo(siteId: string, campaignId: string, locale: string, slug: string): void {
  revalidateTag(`campaign:${campaignId}`)
  revalidateTag(`og:campaign:${campaignId}`)
  revalidateTag(`sitemap:${siteId}`)
  revalidatePath(`/campaigns/${locale}/${slug}`)
}

export function revalidateSiteBranding(): void {
  revalidateTag('seo-config')
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/cache-invalidation.ts apps/web/test/lib/seo/cache-invalidation.test.ts
git commit -m "feat(seo): cache invalidation helpers (revalidateBlogPostSeo/CampaignSeo/SiteBranding)"
```

---

### Task B.16: `lib/seo/robots-config.ts` (buildRobotsRules)

**Files:**
- Create: `apps/web/lib/seo/robots-config.ts`
- Test: `apps/web/test/lib/seo/robots-config.test.ts`

- [ ] **Step 1: Test**

```typescript
// apps/web/test/lib/seo/robots-config.test.ts
import { describe, it, expect } from 'vitest'
import { buildRobotsRules } from '@/lib/seo/robots-config'
import { mockConfig } from '../__fixtures__/seo'

describe('buildRobotsRules', () => {
  it('emits Allow:/ + Disallow protected paths', () => {
    const rules = buildRobotsRules({ config: mockConfig, host: 'example.com', aiCrawlersBlocked: false, protectedPaths: ['/admin', '/cms'] })
    const main = rules.find((r) => r.userAgent === '*')!
    expect(main.allow).toBe('/')
    expect(main.disallow).toEqual(expect.arrayContaining(['/admin', '/cms']))
  })

  it('appends AI crawler rules when aiCrawlersBlocked=true', () => {
    const rules = buildRobotsRules({ config: mockConfig, host: 'example.com', aiCrawlersBlocked: true, protectedPaths: [] })
    expect(rules.map((r) => r.userAgent)).toEqual(expect.arrayContaining(['GPTBot', 'CCBot', 'anthropic-ai']))
  })

  it('falls back to permissive rules when config is null', () => {
    const rules = buildRobotsRules({ config: null, host: 'example.com', aiCrawlersBlocked: false, protectedPaths: [] })
    expect(rules[0]).toMatchObject({ userAgent: '*', allow: '/' })
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// apps/web/lib/seo/robots-config.ts
import type { MetadataRoute } from 'next'
import type { SiteSeoConfig } from './config'

type Rule = NonNullable<MetadataRoute.Robots['rules']>[number] | Record<string, unknown>

// AI/LLM crawlers + scrapers blocked when SEO_AI_CRAWLERS_BLOCKED=true.
// Curated list — explicitly KEEPS social-preview bots (facebookexternalhit,
// Twitterbot, LinkedInBot, Slackbot, WhatsApp, TelegramBot) and search engines
// (Googlebot, Bingbot, DuckDuckBot, YandexBot) under the default `User-agent: *`
// Allow rule. Only model-training and aggressive scrapers are denied.
const AI_CRAWLERS = [
  'GPTBot',                  // OpenAI training
  'ChatGPT-User',            // OpenAI live retrieval
  'OAI-SearchBot',           // OpenAI search index
  'ClaudeBot',               // Anthropic training (current)
  'anthropic-ai',            // Anthropic legacy UA
  'Claude-Web',              // Anthropic search retrieval
  'CCBot',                   // Common Crawl (feeds many LLMs)
  'PerplexityBot',           // Perplexity AI
  'Google-Extended',         // Google AI training opt-out (does NOT affect Googlebot for search)
  'Applebot-Extended',       // Apple AI training opt-out (does NOT affect Applebot for Spotlight/Siri)
  'FacebookBot',             // Meta AI (NOT facebookexternalhit which is link-share preview)
  'Bytespider',              // ByteDance/TikTok
  'Amazonbot',               // Amazon LLM
  'Diffbot',                 // structured-data scraper
  'Omgilibot',               // aggregator scraper
  'YouBot',                  // You.com
  'cohere-ai',               // Cohere training
  'AI2Bot',                  // Allen AI
]

export function buildRobotsRules(input: {
  config: SiteSeoConfig | null
  host: string
  aiCrawlersBlocked: boolean
  protectedPaths: readonly string[]
}): Rule[] {
  const main: Rule = {
    userAgent: '*',
    allow: '/',
    disallow: [...input.protectedPaths],
  }
  const rules: Rule[] = [main]
  if (input.aiCrawlersBlocked) {
    for (const agent of AI_CRAWLERS) rules.push({ userAgent: agent, disallow: '/' })
  }
  return rules
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/seo/robots-config.ts apps/web/test/lib/seo/robots-config.test.ts
git commit -m "feat(seo): buildRobotsRules with AI crawler opt-in block"
```

---

### Task B.17: `lib/seo/og/template.tsx` (3 templates)

**Files:**
- Create: `apps/web/lib/seo/og/template.tsx`

These are JSX used by `ImageResponse`. No unit tests — route tests cover end-to-end PNG.

- [ ] **Step 1: Implement**

```tsx
// apps/web/lib/seo/og/template.tsx
/* eslint-disable @next/next/no-img-element */
export function BlogOgTemplate({ title, author, locale, brandColor, logoUrl }: {
  title: string; author: string; locale: string; brandColor: string; logoUrl: string | null
}) {
  const darker = darkenHex(brandColor, 30)
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: `linear-gradient(135deg, ${brandColor}, ${darker})`,
      color: '#fff', fontFamily: 'Inter', padding: 80,
    }}>
      {logoUrl && <img src={logoUrl} width={64} height={64} style={{ borderRadius: 12 }} alt="" />}
      <h1 style={{
        fontSize: title.length > 60 ? 56 : 64, lineHeight: 1.1, marginTop: 'auto',
        maxWidth: 1040, fontWeight: 700,
      }}>{truncate(title, 100)}</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, alignItems: 'center' }}>
        <span style={{ fontSize: 28, opacity: 0.9 }}>{author}</span>
        <span style={{ fontSize: 24, opacity: 0.7 }}>{locale.toUpperCase()}</span>
      </div>
    </div>
  )
}

export function CampaignOgTemplate(props: React.ComponentProps<typeof BlogOgTemplate>) {
  return <BlogOgTemplate {...props} />  // same visual, distinct export for future divergence
}

export function GenericOgTemplate({ title, siteName, brandColor }: { title: string; siteName: string; brandColor: string }) {
  const darker = darkenHex(brandColor, 30)
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      background: `linear-gradient(135deg, ${brandColor}, ${darker})`,
      color: '#fff', fontFamily: 'Inter', padding: 80,
    }}>
      <h1 style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>{truncate(title, 80)}</h1>
      <div style={{ fontSize: 28, opacity: 0.8, marginTop: 32 }}>{siteName}</div>
    </div>
  )
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…'
}

function darkenHex(hex: string, pct: number): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return hex
  const r = Math.max(0, Math.round(parseInt(m[1]!, 16) * (100 - pct) / 100))
  const g = Math.max(0, Math.round(parseInt(m[2]!, 16) * (100 - pct) / 100))
  const b = Math.max(0, Math.round(parseInt(m[3]!, 16) * (100 - pct) / 100))
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd apps/web && npx tsc --noEmit
git add apps/web/lib/seo/og/template.tsx
git commit -m "feat(seo): OG image templates (Blog/Campaign/Generic) + hex darken helper"
```

---

### Task B.18: `lib/seo/og/render.ts` (generateOgImage)

**Files:**
- Create: `apps/web/lib/seo/og/render.ts`
- Create: `apps/web/lib/seo/og/fonts/.gitkeep` (font file added in Task B.22)

- [ ] **Step 1: Implement**

```typescript
// apps/web/lib/seo/og/render.ts
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import * as path from 'node:path'
import { BlogOgTemplate, CampaignOgTemplate, GenericOgTemplate } from './template'

let fontCache: ArrayBuffer | null = null

async function loadInterBoldSubset(): Promise<ArrayBuffer> {
  if (fontCache) return fontCache
  const p = path.join(process.cwd(), 'apps/web/lib/seo/og/fonts/Inter-Bold.subset.ttf')
  const buf = await readFile(p)
  fontCache = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  return fontCache
}

const OG_RESPONSE_INIT = {
  width: 1200, height: 630,
  headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
} as const

export async function renderBlogOgImage(props: Parameters<typeof BlogOgTemplate>[0]): Promise<Response> {
  const font = await loadInterBoldSubset()
  return new ImageResponse(<BlogOgTemplate {...props} />, {
    ...OG_RESPONSE_INIT,
    fonts: [{ name: 'Inter', data: font, weight: 700, style: 'normal' }],
  })
}

export async function renderCampaignOgImage(props: Parameters<typeof CampaignOgTemplate>[0]): Promise<Response> {
  const font = await loadInterBoldSubset()
  return new ImageResponse(<CampaignOgTemplate {...props} />, {
    ...OG_RESPONSE_INIT,
    fonts: [{ name: 'Inter', data: font, weight: 700, style: 'normal' }],
  })
}

export async function renderGenericOgImage(props: Parameters<typeof GenericOgTemplate>[0]): Promise<Response> {
  const font = await loadInterBoldSubset()
  return new ImageResponse(<GenericOgTemplate {...props} />, {
    ...OG_RESPONSE_INIT,
    fonts: [{ name: 'Inter', data: font, weight: 700, style: 'normal' }],
  })
}

export function notFoundOgFallback(): Response {
  return new Response(null, { status: 302, headers: { Location: '/og-default.png' } })
}
```

- [ ] **Step 2: Create font dir placeholder**

```bash
mkdir -p apps/web/lib/seo/og/fonts
touch apps/web/lib/seo/og/fonts/.gitkeep
```

- [ ] **Step 3: Commit (font arrives in Task B.22)**

```bash
git add apps/web/lib/seo/og/render.ts apps/web/lib/seo/og/fonts/.gitkeep
git commit -m "feat(seo): renderBlogOgImage + renderCampaignOgImage + renderGenericOgImage (Node runtime)"
```

---

### Task B.19: `app/og/blog/[locale]/[slug]/route.tsx`

**Files:**
- Create: `apps/web/src/app/og/blog/[locale]/[slug]/route.tsx`
- Test: `apps/web/test/app/og/blog-route.test.ts`

- [ ] **Step 1: Test**

```typescript
// apps/web/test/app/og/blog-route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

describe('GET /og/blog/[locale]/[slug]', () => {
  beforeEach(() => vi.resetModules())

  it('returns 302 fallback when flag disabled', async () => {
    process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED = 'false'
    const { GET } = await import('@/app/og/blog/[locale]/[slug]/route')
    const req = new NextRequest('https://example.com/og/blog/pt-BR/slug', { headers: { host: 'example.com' } })
    const res = await GET(req, { params: Promise.resolve({ locale: 'pt-BR', slug: 'slug' }) })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/og-default.png')
    delete process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED
  })

  it('returns 302 fallback when site not resolved', async () => {
    vi.doMock('@/lib/seo/host', () => ({
      resolveSiteByHost: vi.fn().mockResolvedValue(null),
      isPreviewOrDevHost: () => false,
    }))
    const { GET } = await import('@/app/og/blog/[locale]/[slug]/route')
    const req = new NextRequest('https://unknown.test/og/blog/pt-BR/s', { headers: { host: 'unknown.test' } })
    const res = await GET(req, { params: Promise.resolve({ locale: 'pt-BR', slug: 's' }) })
    expect(res.status).toBe(302)
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```tsx
// apps/web/src/app/og/blog/[locale]/[slug]/route.tsx
import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { postRepo } from '@/lib/cms/repositories'
import { renderBlogOgImage, notFoundOgFallback } from '@/lib/seo/og/render'

export const runtime = 'nodejs'
export const revalidate = 3600

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ locale: string; slug: string }> },
): Promise<Response> {
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED === 'false') return notFoundOgFallback()
  const { locale, slug } = await ctx.params
  try {
    const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
    const site = await resolveSiteByHost(host)
    if (!site) return notFoundOgFallback()
    const config = await getSiteSeoConfig(site.id, host)
    const post = await postRepo().getBySlug({ siteId: site.id, locale, slug })
    if (!post) return notFoundOgFallback()
    return await renderBlogOgImage({
      title: post.translation.title,
      author: config.personIdentity?.name ?? config.siteName,
      locale,
      brandColor: config.primaryColor,
      logoUrl: config.logoUrl,
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'og-route', type: 'blog', slug, locale } })
    return notFoundOgFallback()
  }
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/og/blog/[locale]/[slug]/route.tsx apps/web/test/app/og/blog-route.test.ts
git commit -m "feat(seo): /og/blog/[locale]/[slug] dynamic OG route (Node runtime, revalidate 1h)"
```

---

### Task B.19a: Add `campaignRepo().getBySlug` wrapper

**Files:**
- Modify: `apps/web/lib/cms/repositories.ts`
- Test: `apps/web/test/lib/cms/repositories.test.ts` (extend or create)

`@tn-figueiredo/cms` `SupabaseCampaignRepository` exposes `getById/list/create/update/publish/...` but NOT `getBySlug`. B.20 OG route needs slug-based lookup. Add a thin wrapper.

- [ ] **Step 1: Inspect existing repositories.ts**

```bash
cat apps/web/lib/cms/repositories.ts
```

Note pattern: factories `postRepo()` / `campaignRepo()` returning package class instances.

- [ ] **Step 2: Add wrapper function**

Edit `apps/web/lib/cms/repositories.ts`:

```typescript
import { getSupabaseServiceClient } from '../supabase/service'

// existing exports preserved...

// NEW: slug-based campaign lookup (Sprint 5b — needed by /og/campaigns route).
// Mirrors RLS public-read filters for safety even though service-role client is used.
export async function getCampaignBySlug(input: { siteId: string; locale: string; slug: string }) {
  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      id, site_id, status,
      campaign_translations!inner(locale, slug, meta_title, meta_description, og_image_url)
    `)
    .eq('site_id', input.siteId)
    .eq('status', 'active')
    .eq('campaign_translations.locale', input.locale)
    .eq('campaign_translations.slug', input.slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const tx = (data as any).campaign_translations?.[0]
  if (!tx) return null
  return { id: (data as any).id, translation: tx }
}
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/cms/repositories.ts
git commit -m "feat(cms): add getCampaignBySlug helper (Sprint 5b — needed by /og/campaigns OG route)"
```

In Task B.20, replace the `campaignRepo().getBySlug(...)` call with `getCampaignBySlug({ siteId, locale, slug })`.

---

### Task B.20: `app/og/campaigns/[locale]/[slug]/route.tsx` + `app/og/[type]/route.tsx`

**Files:**
- Create: `apps/web/src/app/og/campaigns/[locale]/[slug]/route.tsx`
- Create: `apps/web/src/app/og/[type]/route.tsx`
- Test: `apps/web/test/app/og/campaign-route.test.ts`, `apps/web/test/app/og/generic-route.test.ts`

- [ ] **Step 1: Implement campaign route (mirror blog)**

```tsx
// apps/web/src/app/og/campaigns/[locale]/[slug]/route.tsx
import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { campaignRepo } from '@/lib/cms/repositories'
import { renderCampaignOgImage, notFoundOgFallback } from '@/lib/seo/og/render'

export const runtime = 'nodejs'
export const revalidate = 3600

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ locale: string; slug: string }> },
): Promise<Response> {
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED === 'false') return notFoundOgFallback()
  const { locale, slug } = await ctx.params
  try {
    const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
    const site = await resolveSiteByHost(host)
    if (!site) return notFoundOgFallback()
    const config = await getSiteSeoConfig(site.id, host)
    // Assume campaignRepo has a getBySlug(siteId, locale, slug) — if not, implement or
    // use a direct Supabase select in the route (ring-specific, same RLS-mirror pattern).
    const c = await campaignRepo().getBySlug({ siteId: site.id, locale, slug })
    if (!c) return notFoundOgFallback()
    return await renderCampaignOgImage({
      title: (c as any).translation?.meta_title ?? 'Campaign',
      author: config.personIdentity?.name ?? config.siteName,
      locale,
      brandColor: config.primaryColor,
      logoUrl: config.logoUrl,
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'og-route', type: 'campaign', slug, locale } })
    return notFoundOgFallback()
  }
}
```

**Note:** if `campaignRepo().getBySlug` doesn't exist, add a thin wrapper in `apps/web/lib/cms/repositories.ts` that queries `campaigns` + `campaign_translations!inner` filtered by `site_id/locale/slug`.

- [ ] **Step 2: Implement generic route**

```tsx
// apps/web/src/app/og/[type]/route.tsx
import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { renderGenericOgImage, notFoundOgFallback } from '@/lib/seo/og/render'

export const runtime = 'nodejs'
export const revalidate = 3600

const ALLOWED_TYPES = new Set(['root', 'legal', 'contact', 'blog-index', 'campaigns-index'])

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
): Promise<Response> {
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED === 'false') return notFoundOgFallback()
  const { type } = await ctx.params
  if (!ALLOWED_TYPES.has(type)) return notFoundOgFallback()
  try {
    const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
    const site = await resolveSiteByHost(host)
    if (!site) return notFoundOgFallback()
    const config = await getSiteSeoConfig(site.id, host)
    const title = sanitizeTitle(new URL(req.url).searchParams.get('title') ?? defaultTitle(type, config))
    return await renderGenericOgImage({ title, siteName: config.siteName, brandColor: config.primaryColor })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'og-route', type: 'generic', variant: type } })
    return notFoundOgFallback()
  }
}

function sanitizeTitle(raw: string): string {
  return raw.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 120)
}

function defaultTitle(type: string, config: { siteName: string }): string {
  switch (type) {
    case 'root': return config.siteName
    case 'legal': return 'Legal'
    case 'contact': return 'Fale comigo'
    case 'blog-index': return 'Blog'
    case 'campaigns-index': return 'Campanhas'
    default: return config.siteName
  }
}
```

- [ ] **Step 3: Run tests — PASS**

```bash
cd apps/web && npx vitest run test/app/og/
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/og/campaigns/[locale]/[slug]/route.tsx \
        apps/web/src/app/og/[type]/route.tsx \
        apps/web/test/app/og/campaign-route.test.ts \
        apps/web/test/app/og/generic-route.test.ts
git commit -m "feat(seo): /og/campaigns/[locale]/[slug] + /og/[type] OG routes (Node runtime)"
```

---

### Task B.21: Middleware short-circuit for `/sitemap.xml` + `/robots.txt`

**Files:**
- Modify: `apps/web/src/middleware.ts` (around line 122, dev subdomain rewrite)
- Test: `apps/web/test/middleware/seo-route-shortcircuit.test.ts`

- [ ] **Step 1: Test**

```typescript
// apps/web/test/middleware/seo-route-shortcircuit.test.ts
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

describe('middleware SEO route short-circuit', () => {
  it('does NOT rewrite /sitemap.xml on dev.bythiagofigueiredo.com to /dev/sitemap.xml', async () => {
    vi.doMock('@tn-figueiredo/cms/ring', () => ({
      SupabaseRingContext: vi.fn(() => ({
        getSiteByDomain: vi.fn().mockResolvedValue({ id: 'site-dev', org_id: 'org', default_locale: 'pt-BR', cms_enabled: true }),
      })),
    }))
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://dev.bythiagofigueiredo.com/sitemap.xml', {
      headers: { host: 'dev.bythiagofigueiredo.com' },
    })
    const res = await middleware(req)
    expect(res.headers.get('x-middleware-rewrite')).not.toContain('/dev/sitemap.xml')
  })

  it('does NOT rewrite /robots.txt on dev subdomain', async () => {
    const { middleware } = await import('@/middleware')
    const req = new NextRequest('https://dev.bythiagofigueiredo.com/robots.txt', {
      headers: { host: 'dev.bythiagofigueiredo.com' },
    })
    const res = await middleware(req)
    expect(res.headers.get('x-middleware-rewrite')).not.toContain('/dev/robots.txt')
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Edit middleware**

Open `apps/web/src/middleware.ts`. Find the dev subdomain rewrite around line 122:

```typescript
// BEFORE (existing):
const isDevSubdomain =
  hostname === 'dev.bythiagofigueiredo.com' ||
  hostname === 'dev.localhost'
if (isDevSubdomain && !url.pathname.startsWith('/dev')) {
  url.pathname = `/dev${url.pathname === '/' ? '' : url.pathname}`
  return NextResponse.rewrite(url)
}
```

Change to:

```typescript
// AFTER:
const isDevSubdomain =
  hostname === 'dev.bythiagofigueiredo.com' ||
  hostname === 'dev.localhost'
const isSeoRoute = pathname === '/sitemap.xml' || pathname === '/robots.txt'
if (isDevSubdomain && !isSeoRoute && !url.pathname.startsWith('/dev')) {
  url.pathname = `/dev${url.pathname === '/' ? '' : url.pathname}`
  return NextResponse.rewrite(url)
}
```

(The `/sitemap.xml` and `/robots.txt` route handlers themselves detect `isPreviewOrDevHost` and return `Disallow: /` for dev.)

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/middleware.ts apps/web/test/middleware/seo-route-shortcircuit.test.ts
git commit -m "fix(middleware): short-circuit /sitemap.xml + /robots.txt from dev subdomain rewrite"
```

---

### Task B.22: Add Inter Bold subset font + og-default.png placeholder

**Files:**
- Create: `apps/web/lib/seo/og/fonts/Inter-Bold.subset.ttf` (binary)
- Create: `apps/web/public/og-default.png` (binary, 1200×630)

- [ ] **Step 1: Generate Inter Bold subset (latin-only, ~35KB)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
curl -L -o /tmp/Inter-Bold.ttf "https://github.com/rsms/inter/raw/v4.0/docs/font-files/Inter-Bold.ttf"
# Subset to latin+latin-ext via pyftsubset (install via: pip3 install fonttools brotli)
pyftsubset /tmp/Inter-Bold.ttf \
  --unicodes="U+0020-007E,U+00A0-00FF,U+0100-017F,U+2018-201F,U+2022,U+2026,U+20AC,U+2122" \
  --output-file=apps/web/lib/seo/og/fonts/Inter-Bold.subset.ttf
ls -lh apps/web/lib/seo/og/fonts/Inter-Bold.subset.ttf
```

Expected: ~30-40KB file.

- [ ] **Step 2: Commit font**

```bash
rm apps/web/lib/seo/og/fonts/.gitkeep 2>/dev/null || true
git add apps/web/lib/seo/og/fonts/Inter-Bold.subset.ttf
git rm --cached apps/web/lib/seo/og/fonts/.gitkeep 2>/dev/null || true
git commit -m "chore(seo): add Inter Bold subset font (latin+latin-ext, ~35KB) for OG routes"
```

- [ ] **Step 3: Create og-default.png placeholder**

Export from Figma using the `GenericOgTemplate` visual with `title="bythiagofigueiredo"` + brandColor `#0F172A` rendered at 1200×630. Save to `apps/web/public/og-default.png`. Alternative: render locally via the GenericOgTemplate route once served, then screenshot/save.

Verify:
```bash
file apps/web/public/og-default.png
# PNG image data, 1200 x 630, ...
ls -lh apps/web/public/og-default.png
# <100KB
```

- [ ] **Step 4: Commit PNG**

```bash
git add apps/web/public/og-default.png
git commit -m "chore(seo): add og-default.png static fallback (1200x630)"
```

---

### Task B.23: Commit Person.imageUrl asset (thiago.jpg)

**Files:**
- Create: `apps/web/public/identity/thiago.jpg`

**PRE-FLIGHT:** User must supply the photo (1:1, ≥400×400, JPEG <100KB). If not yet supplied, stage `.gitkeep` placeholder (Person.imageUrl will 404 until real file lands — blocks PR-B merge per spec).

- [ ] **Step 1: Verify file properties if real photo supplied**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
file apps/web/public/identity/thiago.jpg
# JPEG image data, ... 400x400 or larger, 1:1 ratio
ls -lh apps/web/public/identity/thiago.jpg
# <100KB
```

If no photo yet:

```bash
mkdir -p apps/web/public/identity
touch apps/web/public/identity/.gitkeep
```

- [ ] **Step 2: Commit**

If real photo:

```bash
git add apps/web/public/identity/thiago.jpg
git commit -m "chore(seo): add Person.imageUrl asset (thiago.jpg)"
```

If placeholder:

```bash
git add apps/web/public/identity/.gitkeep
git commit -m "chore(seo): scaffold public/identity dir (placeholder — real photo blocks PR-B merge)"
```

---

### Task B.24: `app/sitemap.ts` (Node runtime, force-dynamic)

**Files:**
- Create: `apps/web/src/app/sitemap.ts`
- Test: `apps/web/test/app/sitemap.test.ts`

- [ ] **Step 1: Test**

```typescript
// apps/web/test/app/sitemap.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('app/sitemap.ts', () => {
  beforeEach(() => vi.resetModules())

  it('returns [] for preview/dev hosts', async () => {
    vi.doMock('next/headers', () => ({
      headers: async () => new Map([['host', 'dev.bythiagofigueiredo.com']]),
    }))
    const { default: sitemap } = await import('@/app/sitemap')
    expect(await sitemap()).toEqual([])
  })

  it('returns [] when site not resolved', async () => {
    vi.doMock('next/headers', () => ({
      headers: async () => new Map([['host', 'unknown.test']]),
    }))
    vi.doMock('@/lib/seo/host', () => ({
      isPreviewOrDevHost: () => false,
      resolveSiteByHost: vi.fn().mockResolvedValue(null),
    }))
    const { default: sitemap } = await import('@/app/sitemap')
    expect(await sitemap()).toEqual([])
  })

  it('maps enumerator routes to MetadataRoute.Sitemap with absolute URLs + alternates', async () => {
    vi.doMock('next/headers', () => ({ headers: async () => new Map([['host', 'bythiagofigueiredo.com']]) }))
    vi.doMock('@/lib/seo/host', () => ({
      isPreviewOrDevHost: () => false,
      resolveSiteByHost: vi.fn().mockResolvedValue({ id: 'site-1', slug: 'bythiagofigueiredo' }),
    }))
    vi.doMock('@/lib/seo/config', () => ({
      getSiteSeoConfig: vi.fn().mockResolvedValue({
        siteUrl: 'https://bythiagofigueiredo.com', defaultLocale: 'pt-BR', supportedLocales: ['pt-BR', 'en'],
      }),
    }))
    vi.doMock('@/lib/seo/enumerator', () => ({
      enumerateSiteRoutes: vi.fn().mockResolvedValue([
        {
          path: '/blog/pt-BR/x', lastModified: new Date('2026-04-15T00:00:00Z'),
          alternates: { 'pt-BR': '/blog/pt-BR/x', en: '/blog/en/x' },
          changeFrequency: 'weekly', priority: 0.7,
        },
      ]),
    }))
    const { default: sitemap } = await import('@/app/sitemap')
    const result = await sitemap()
    expect(result).toHaveLength(1)
    expect(result[0].url).toBe('https://bythiagofigueiredo.com/blog/pt-BR/x')
    expect(result[0].alternates?.languages).toMatchObject({
      'pt-BR': 'https://bythiagofigueiredo.com/blog/pt-BR/x',
      en: 'https://bythiagofigueiredo.com/blog/en/x',
      'x-default': 'https://bythiagofigueiredo.com/blog/pt-BR/x',
    })
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// apps/web/src/app/sitemap.ts
import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { isPreviewOrDevHost, resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { enumerateSiteRoutes, type SitemapRouteEntry } from '@/lib/seo/enumerator'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers()
  const host = (h.get('host') ?? '').split(':')[0] ?? ''
  if (isPreviewOrDevHost(host)) return []
  const site = await resolveSiteByHost(host)
  if (!site) return []
  const config = await getSiteSeoConfig(site.id, host)
  const routes = await enumerateSiteRoutes(site.id, config)
  return routes.map((r) => toSitemapEntry(r, config.siteUrl, config.defaultLocale))
}

function toSitemapEntry(
  r: SitemapRouteEntry, siteUrl: string, defaultLocale: string,
): MetadataRoute.Sitemap[number] {
  const absAlternates: Record<string, string> = {}
  for (const [loc, path] of Object.entries(r.alternates)) absAlternates[loc] = `${siteUrl}${path}`
  if (Object.keys(r.alternates).length > 0 && r.alternates[defaultLocale]) {
    absAlternates['x-default'] = `${siteUrl}${r.alternates[defaultLocale]}`
  }
  return {
    url: `${siteUrl}${r.path}`,
    lastModified: r.lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
    ...(Object.keys(absAlternates).length > 0 ? { alternates: { languages: absAlternates } } : {}),
  }
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/sitemap.ts apps/web/test/app/sitemap.test.ts
git commit -m "feat(seo): app/sitemap.ts (Node runtime, force-dynamic, direct host lookup)"
```

**Caching note (informational, no code):** `app/sitemap.ts` MetadataRoute return shape doesn't accept custom HTTP headers — Next.js controls them. With `dynamic = 'force-dynamic'`, every request rebuilds (no s-maxage), but Vercel CDN can still cache via the `Cache-Tag` header it adds automatically. If post-deploy metrics show DB pressure from frequent crawler hits, convert to `app/sitemap.xml/route.ts` (Route Handler) where you can set `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` manually. Spec calls this out as future optimization.

---

### Task B.25: `app/robots.ts` (Node runtime, force-dynamic)

**Files:**
- Create: `apps/web/src/app/robots.ts`
- Test: `apps/web/test/app/robots.test.ts`

- [ ] **Step 1: Test**

```typescript
// apps/web/test/app/robots.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('app/robots.ts', () => {
  beforeEach(() => vi.resetModules())

  it('returns Disallow:/ for preview hosts', async () => {
    vi.doMock('next/headers', () => ({ headers: async () => new Map([['host', 'dev.bythiagofigueiredo.com']]) }))
    const { default: robots } = await import('@/app/robots')
    const r = await robots()
    expect(r.rules).toEqual([{ userAgent: '*', disallow: '/' }])
  })

  it('emits Allow:/ + Disallow + Sitemap on prod', async () => {
    vi.doMock('next/headers', () => ({ headers: async () => new Map([['host', 'bythiagofigueiredo.com']]) }))
    vi.doMock('@/lib/seo/host', () => ({
      isPreviewOrDevHost: () => false,
      resolveSiteByHost: vi.fn().mockResolvedValue({ id: 'site-1', slug: 'bythiagofigueiredo' }),
    }))
    vi.doMock('@/lib/seo/config', () => ({
      getSiteSeoConfig: vi.fn().mockResolvedValue({ siteUrl: 'https://bythiagofigueiredo.com' }),
    }))
    const { default: robots } = await import('@/app/robots')
    const r = await robots()
    const main = (r.rules as any[]).find((rule) => rule.userAgent === '*')
    expect(main.allow).toBe('/')
    expect(main.disallow).toEqual(expect.arrayContaining(['/admin', '/cms', '/account', '/api']))
    expect(r.sitemap).toBe('https://bythiagofigueiredo.com/sitemap.xml')
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```typescript
// apps/web/src/app/robots.ts
import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { isPreviewOrDevHost, resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { buildRobotsRules } from '@/lib/seo/robots-config'
import { PROTECTED_DISALLOW_PATHS } from '@/lib/seo/noindex'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers()
  const host = (h.get('host') ?? '').split(':')[0] ?? ''
  if (isPreviewOrDevHost(host)) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }
  const site = await resolveSiteByHost(host)
  const config = site ? await getSiteSeoConfig(site.id, host) : null
  const aiCrawlersBlocked = process.env.SEO_AI_CRAWLERS_BLOCKED === 'true'
  return {
    rules: buildRobotsRules({ config, host, aiCrawlersBlocked, protectedPaths: PROTECTED_DISALLOW_PATHS }) as any,
    sitemap: config ? `${config.siteUrl}/sitemap.xml` : `https://${host}/sitemap.xml`,
  }
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/robots.ts apps/web/test/app/robots.test.ts
git commit -m "feat(seo): app/robots.ts (Node runtime, force-dynamic, AI-crawler flag)"
```

---

### Task B.26: CI job `check-migration-applied` in `.github/workflows/ci.yml`

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Append job**

Edit `.github/workflows/ci.yml`. After the last job (`secret-scan` or `ecosystem-pinning`), append:

```yaml
  check-migration-applied:
    name: SEO Migration Pre-Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      - name: Verify PR-A SEO columns exist in prod
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
        run: |
          node -e "
          const { createClient } = require('@supabase/supabase-js');
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          );
          (async () => {
            const { error } = await supabase
              .from('sites')
              .select('identity_type, twitter_handle, seo_default_og_image')
              .limit(0);
            if (error) {
              console.error('FAIL: PR-A migrations not applied to prod:', error.message);
              process.exit(1);
            }
            console.log('OK: SEO columns present in prod sites table');
          })();
          "
```

- [ ] **Step 2: Validate YAML**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(seo): add check-migration-applied gate (blocks PR-B merge without PR-A in prod)"
```

---

### Task B.27: Spike — verify middleware + route behavior in preview

**Files:** none (verification only).

- [ ] **Step 1: Push branch + draft PR**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git push -u origin chore/sprint-5b-pr-b
gh pr create --draft --title "[SPIKE] Sprint 5b PR-B" --body "Draft — verifying sitemap/robots/OG routes in Vercel preview before un-drafting."
```

- [ ] **Step 2: Wait for preview + verify**

```bash
gh run watch
# Once preview URL live (e.g. https://chore-sprint-5b-pr-b-xyz.vercel.app):
PREVIEW=$(gh pr view --json url -q .url | sed 's|pull/[0-9]*|/|' | head -c-1)
curl -sf "$PREVIEW/robots.txt"  # expect Disallow: /
curl -sf "$PREVIEW/sitemap.xml" # expect empty <urlset>
curl -sfI "$PREVIEW/og/blog/pt-BR/some-slug" # expect 302 or image/png
```

Document findings in PR body under "## Spike findings".

- [ ] **Step 3: Mark ready**

```bash
gh pr ready
```

No commit — verification only.

---

### Task B.28: Final PR-B verification — `npm test` + typecheck

**Files:** none (sanity gate).

- [ ] **Step 1: Full suite**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run test:web
```

Expected: all tests pass.

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Diff summary**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git log --oneline staging..HEAD
```

Expected ~26 commits (deps + env + 16 lib/seo files + 3 OG routes + sitemap + robots + middleware fix + font + og-default + identity photo + CI gate).

- [ ] **Step 4: Mark PR ready + request review**

```bash
gh pr ready && gh pr checks
```

---

## PR-C: Wire Existing Pages + JSON-LD + Cache Invalidation (~5h)

PR-C delivers the user-visible payoff of Sprint 5b: every public page emits canonical metadata + hreflang + OG via the new `lib/seo/page-metadata.ts` factories (built in PR-B), every server component renders a `<JsonLdScript>` with the right `@graph`, and every server action that mutates publishable content invalidates the right SEO caches.

**Pre-conditions:**
- PR-A merged (DB columns `sites.identity_type`, `sites.twitter_handle`, `sites.seo_default_og_image`, `blog_translations.seo_extras` in prod).
- PR-B merged (`apps/web/lib/seo/{config,page-metadata,jsonld/*,cache-invalidation,frontmatter}.ts` exist; factories tested in isolation; `gray-matter@4.0.3` and `schema-dts@1.1.5` installed).
- Feature flags `NEXT_PUBLIC_SEO_JSONLD_ENABLED` defaults to `true`; `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED` defaults to `true`. PR-C does not introduce new flags.

**File budget (concrete):**
- 1 new admin actions file: `apps/web/src/app/admin/(authed)/sites/actions.ts`
- 7 page files refactored (root layout, public layout, home, privacy, terms, blog list, blog detail, campaign detail, contact)
- 3 server-action files modified (blog edit, campaigns new, campaigns edit)
- 1 server component touched for documentation only (cms blog new)
- 1 new vitest spec file `apps/web/test/lib/seo/page-metadata.test.ts`
- 1 new vitest spec file `apps/web/test/app/seo/blog-detail-jsonld.test.tsx`
- 1 new vitest spec file `apps/web/test/app/seo/archive-post-revalidation.test.ts`
- 1 new vitest spec file `apps/web/test/app/admin/sites-actions.test.ts`
- 1 new vitest spec file `apps/web/test/lib/seo/jsonld-builders-types.test.ts`

**Commit groups (10 commits):**
1. test(seo): snapshot tests for 7 page-metadata factories
2. refactor(seo): cleanup root layout + add (public) layout generateMetadata
3. refactor(seo): wire home + legal pages metadata factories
4. refactor(seo): wire blog list + blog detail metadata + JSON-LD
5. refactor(seo): wire campaign detail metadata + JSON-LD + contact page metadata
6. refactor(seo): wire frontmatter parsing into savePost
7. refactor(seo): replace revalidatePath with revalidateBlogPostSeo in 5 blog actions (includes archivePost bug fix)
8. refactor(seo): replace revalidatePath with revalidateCampaignSeo in 5 campaign actions
9. feat(admin): add site branding/identity actions with seo-config tag invalidation
10. test(seo): add schema-dts type-equivalence regression vitest

---

### Task 1: Snapshot tests for 7 generateMetadata factories

**Files:**
- Create: `apps/web/test/lib/seo/page-metadata.test.ts`

**Why first:** TDD — these snapshots lock the contract that PR-C wiring must satisfy. PR-B already created the factories; PR-C asserts they produce the exact shape pages will rely on.

- [ ] **Step 1: Read the factory module signatures from PR-B**

Verify what `apps/web/lib/seo/page-metadata.ts` exports (PR-B created it). Expected exports per spec "Wrapper layer over `@tn-figueiredo/seo`":

```typescript
// Expected from PR-B
export async function generateRootMetadata(config: SiteSeoConfig): Promise<Metadata>
export async function generateHomeMetadata(config: SiteSeoConfig): Promise<Metadata>
export async function generateLegalMetadata(config: SiteSeoConfig, kind: 'privacy' | 'terms', locale: 'pt-BR' | 'en'): Promise<Metadata>
export async function generateBlogListMetadata(config: SiteSeoConfig, locale: string): Promise<Metadata>
export async function generateBlogPostMetadata(config: SiteSeoConfig, post: BlogPostWithTranslations, currentLocale: string): Promise<Metadata>
export async function generateCampaignMetadata(config: SiteSeoConfig, campaign: CampaignWithTranslations, currentLocale: string): Promise<Metadata>
export async function generateContactMetadata(config: SiteSeoConfig): Promise<Metadata>
```

If any are missing, file blocker against PR-B before proceeding.

- [ ] **Step 2: Write the failing snapshot test file**

```typescript
// apps/web/test/lib/seo/page-metadata.test.ts
import { describe, it, expect, vi } from 'vitest'

import {
  generateRootMetadata,
  generateHomeMetadata,
  generateLegalMetadata,
  generateBlogListMetadata,
  generateBlogPostMetadata,
  generateCampaignMetadata,
  generateContactMetadata,
} from '../../../lib/seo/page-metadata'
import type { SiteSeoConfig, PersonProfile } from '../../../lib/seo/config'

const personProfile: PersonProfile = {
  type: 'person',
  name: 'Thiago Figueiredo',
  jobTitle: 'Creator & Builder',
  imageUrl: 'https://bythiagofigueiredo.com/identity/thiago.jpg',
  sameAs: [
    'https://www.instagram.com/thiagonfigueiredo',
    'https://www.youtube.com/@bythiagofigueiredo',
    'https://www.youtube.com/@thiagonfigueiredo',
    'https://github.com/tn-figueiredo',
  ],
}

const config: SiteSeoConfig = {
  siteId: '00000000-0000-0000-0000-000000000001',
  siteName: 'Thiago Figueiredo',
  siteUrl: 'https://bythiagofigueiredo.com',
  defaultLocale: 'pt-BR',
  supportedLocales: ['pt-BR', 'en'],
  identityType: 'person',
  primaryColor: '#0F172A',
  logoUrl: 'https://bythiagofigueiredo.com/logo.png',
  twitterHandle: 'tnFigueiredo',
  defaultOgImageUrl: 'https://bythiagofigueiredo.com/og-default.png',
  contentPaths: { blog: '/blog', campaigns: '/campaigns' },
  personIdentity: personProfile,
  orgIdentity: null,
}

const blogPost = {
  id: 'p1',
  site_id: config.siteId,
  status: 'published' as const,
  published_at: '2026-04-15T12:00:00Z',
  cover_image_url: 'https://bythiagofigueiredo.com/blog/hello-cover.png',
  translations: [
    {
      id: 't1',
      locale: 'pt-BR',
      slug: 'ola-mundo',
      title: 'Olá Mundo',
      excerpt: 'Primeiro post do blog.',
      content_mdx: '# Olá',
      content_compiled: null,
      content_toc: [],
      reading_time_min: 3,
      meta_title: 'Olá Mundo — bythiagofigueiredo',
      meta_description: 'Primeiro post do blog.',
      og_image_url: null,
      seo_extras: null,
      updated_at: '2026-04-15T12:00:00Z',
    },
    {
      id: 't2',
      locale: 'en',
      slug: 'hello-world',
      title: 'Hello World',
      excerpt: 'First blog post.',
      content_mdx: '# Hello',
      content_compiled: null,
      content_toc: [],
      reading_time_min: 3,
      meta_title: 'Hello World — bythiagofigueiredo',
      meta_description: 'First blog post.',
      og_image_url: null,
      seo_extras: null,
      updated_at: '2026-04-15T12:00:00Z',
    },
  ],
}

const campaign = {
  id: 'c1',
  site_id: config.siteId,
  status: 'active' as const,
  translations: [
    {
      id: 'ct1',
      locale: 'pt-BR',
      slug: 'finreckoner-launch',
      meta_title: 'finreckoner — lançamento',
      meta_description: 'Acompanhe o lançamento do finreckoner.',
      og_image_url: 'https://bythiagofigueiredo.com/campaigns/finreckoner-og.png',
    },
    {
      id: 'ct2',
      locale: 'en',
      slug: 'finreckoner-launch-en',
      meta_title: 'finreckoner — launch',
      meta_description: 'Follow the finreckoner launch.',
      og_image_url: 'https://bythiagofigueiredo.com/campaigns/finreckoner-og-en.png',
    },
  ],
}

describe('page-metadata factories — deterministic snapshots', () => {
  it('generateRootMetadata snapshot', async () => {
    const meta = await generateRootMetadata(config)
    expect(meta).toMatchSnapshot()
  })

  it('generateHomeMetadata snapshot', async () => {
    const meta = await generateHomeMetadata(config)
    expect(meta).toMatchSnapshot()
  })

  it('generateLegalMetadata privacy pt-BR snapshot', async () => {
    const meta = await generateLegalMetadata(config, 'privacy', 'pt-BR')
    expect(meta).toMatchSnapshot()
  })

  it('generateLegalMetadata privacy en snapshot', async () => {
    const meta = await generateLegalMetadata(config, 'privacy', 'en')
    expect(meta).toMatchSnapshot()
  })

  it('generateLegalMetadata terms pt-BR snapshot', async () => {
    const meta = await generateLegalMetadata(config, 'terms', 'pt-BR')
    expect(meta).toMatchSnapshot()
  })

  it('generateBlogListMetadata pt-BR snapshot', async () => {
    const meta = await generateBlogListMetadata(config, 'pt-BR')
    expect(meta).toMatchSnapshot()
  })

  it('generateBlogListMetadata en snapshot', async () => {
    const meta = await generateBlogListMetadata(config, 'en')
    expect(meta).toMatchSnapshot()
  })

  it('generateBlogPostMetadata pt-BR snapshot — emits hreflang for both locales', async () => {
    const meta = await generateBlogPostMetadata(config, blogPost, 'pt-BR')
    expect(meta).toMatchSnapshot()
    expect(meta.alternates?.languages).toMatchObject({
      'pt-BR': expect.stringContaining('/blog/pt-BR/ola-mundo'),
      en: expect.stringContaining('/blog/en/hello-world'),
      'x-default': expect.stringContaining('/blog/pt-BR/ola-mundo'),
    })
  })

  it('generateBlogPostMetadata respects og_image precedence — cover_image_url when no extras', async () => {
    const meta = await generateBlogPostMetadata(config, blogPost, 'pt-BR')
    const ogImg = (meta.openGraph as { images?: Array<{ url: string }> })?.images?.[0]?.url
    expect(ogImg).toBe('https://bythiagofigueiredo.com/blog/hello-cover.png')
  })

  it('generateBlogPostMetadata seo_extras.og_image_url overrides cover_image_url', async () => {
    const post = {
      ...blogPost,
      translations: [
        {
          ...blogPost.translations[0],
          seo_extras: { og_image_url: 'https://bythiagofigueiredo.com/extras-override.png' },
        },
        blogPost.translations[1],
      ],
    }
    const meta = await generateBlogPostMetadata(config, post, 'pt-BR')
    const ogImg = (meta.openGraph as { images?: Array<{ url: string }> })?.images?.[0]?.url
    expect(ogImg).toBe('https://bythiagofigueiredo.com/extras-override.png')
  })

  it('generateCampaignMetadata pt-BR snapshot', async () => {
    const meta = await generateCampaignMetadata(config, campaign, 'pt-BR')
    expect(meta).toMatchSnapshot()
  })

  it('generateContactMetadata snapshot', async () => {
    const meta = await generateContactMetadata(config)
    expect(meta).toMatchSnapshot()
  })
})
```

- [ ] **Step 3: Run the test and confirm it fails (no snapshot yet)**

```bash
cd apps/web && npx vitest run test/lib/seo/page-metadata.test.ts
```

Expected: FAIL on first run with "Snapshot file does not exist", which becomes PASS after the inline `--update` once snapshots are reviewed. If factory exports are missing, FAIL with `is not a function` — escalate to PR-B owner.

- [ ] **Step 4: Generate baseline snapshot and inspect**

```bash
cd apps/web && npx vitest run test/lib/seo/page-metadata.test.ts -u
```

Then `git diff apps/web/test/lib/seo/__snapshots__/page-metadata.test.ts.snap` — verify each snapshot includes the keys spec promises:
- `metadataBase: URL { ... 'https://bythiagofigueiredo.com/' }`
- `alternates.canonical` is absolute or properly relative
- `alternates.languages` includes pt-BR + en + x-default for blog/campaign archetypes
- `openGraph.title`, `openGraph.description`, `openGraph.images[0].url`, `openGraph.locale`, `openGraph.type`
- `twitter.card === 'summary_large_image'`, `twitter.site === '@thiagonfigueiredo'`
- For blog post: `keywords`, `authors: [{ name: 'Thiago Figueiredo', url: '...' }]`, `openGraph.publishedTime`, `openGraph.modifiedTime`, `openGraph.type === 'article'`

If any key missing → file blocker against PR-B factories.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/test/lib/seo/page-metadata.test.ts apps/web/test/lib/seo/__snapshots__/page-metadata.test.ts.snap
git commit -m "$(cat <<'EOF'
test(seo): snapshot tests for 7 page-metadata factories

Locks the contract PR-C will wire pages against. Covers root, home,
legal (privacy+terms × pt-BR+en), blog list, blog post (with hreflang
+ og_image precedence), campaign, contact. Mocks getSiteSeoConfig with
a fixed config so snapshots are deterministic across CI runs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Cleanup root `app/layout.tsx` + add `app/(public)/layout.tsx` generateMetadata

**Files:**
- Modify: `apps/web/src/app/layout.tsx` (lines 1-48 — full rewrite to shell-only)
- Modify: `apps/web/src/app/(public)/layout.tsx` (add `generateMetadata` + JSON-LD root nodes)

**Why second:** root metadata bleeds into every other page. Cleaning it up first means downstream tests don't pick up stale `metadataBase`/`title` values.

- [ ] **Step 1: Write failing test for (public) layout metadata + JSON-LD**

Create `apps/web/test/app/seo/public-layout-metadata.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn().mockResolvedValue({
    siteId: 's1', siteName: 'Thiago Figueiredo',
    siteUrl: 'https://bythiagofigueiredo.com',
    defaultLocale: 'pt-BR', supportedLocales: ['pt-BR', 'en'],
    identityType: 'person', primaryColor: '#0F172A',
    logoUrl: null, twitterHandle: 'tnFigueiredo',
    defaultOgImageUrl: null,
    contentPaths: { blog: '/blog', campaigns: '/campaigns' },
    personIdentity: {
      type: 'person', name: 'Thiago Figueiredo', jobTitle: 'Creator & Builder',
      imageUrl: 'https://bythiagofigueiredo.com/identity/thiago.jpg',
      sameAs: ['https://github.com/tn-figueiredo'],
    },
    orgIdentity: null,
  }),
}))

vi.mock('../../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', defaultLocale: 'pt-BR' }),
}))

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: () => 'bythiagofigueiredo.com' }),
}))

import { generateMetadata } from '../../../src/app/(public)/layout'

describe('(public) layout', () => {
  it('emits site-level Metadata from generateMetadata', async () => {
    const meta = await generateMetadata()
    expect(meta.metadataBase?.toString()).toBe('https://bythiagofigueiredo.com/')
    expect(meta.title).toMatchObject({ default: expect.any(String), template: expect.stringContaining('%s') })
    expect(meta.openGraph?.locale).toBe('pt_BR')
  })
})
```

Run:

```bash
cd apps/web && npx vitest run test/app/seo/public-layout-metadata.test.tsx
```

Expected: FAIL — `generateMetadata is not exported from layout`.

- [ ] **Step 2: Refactor `app/layout.tsx` to shell-only**

BEFORE (`apps/web/src/app/layout.tsx`, full file):

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeScript } from '@/components/ui/theme-toggle'

const inter = Inter({
  subsets: ['latin'], display: 'swap', variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
})

const metadataBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: 'Thiago Figueiredo — Creator & Builder',
  description: 'Hub de Thiago Figueiredo. ...',
  openGraph: { title: '...', description: '...', type: 'website', locale: 'pt_BR', url: 'https://bythiagofigueiredo.com' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { /* ... */ }
```

AFTER (`apps/web/src/app/layout.tsx`, full file):

```typescript
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeScript } from '@/components/ui/theme-toggle'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700', '800'],
})

/**
 * Sprint 5b PR-C — Root layout becomes a pure shell (HTML + body + theme).
 * All Metadata is now produced per-route-group:
 *   - Public routes  : `app/(public)/layout.tsx` `generateMetadata` + per-page factories
 *   - Authed routes  : per-segment metadata where needed
 *
 * Hardcoded `metadata` const + `metadataBase` removed — they were forcing
 * pt_BR / wrong title onto admin/cms pages and short-circuiting per-site
 * resolution from `getSiteSeoConfig`. See spec § "Wrapper layer over
 * @tn-figueiredo/seo".
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

Edit:

```typescript
// Remove import { Metadata } and the metadata const + metadataBaseUrl
```

- [ ] **Step 3: Refactor `app/(public)/layout.tsx` to add generateMetadata + root JSON-LD**

BEFORE (lines 16-29):

```typescript
export default function PublicLayout({ children }: { children: ReactNode }) {
  const lgpdBannerEnabled = process.env.NEXT_PUBLIC_LGPD_BANNER_ENABLED === 'true'
  return (
    <CookieBannerProvider>
      {children}
      {lgpdBannerEnabled && (
        <>
          <CookieBanner />
          <CookieBannerTrigger />
        </>
      )}
    </CookieBannerProvider>
  )
}
```

AFTER (full file):

```typescript
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { CookieBanner } from '@/components/lgpd/cookie-banner'
import { CookieBannerTrigger } from '@/components/lgpd/cookie-banner-trigger'
import { CookieBannerProvider } from '@/components/lgpd/cookie-banner-context'
import { getSiteContext } from '../../../lib/cms/site-context'
import { getSiteSeoConfig } from '../../../lib/seo/config'
import { generateRootMetadata } from '../../../lib/seo/page-metadata'
import { JsonLdScript } from '../../../lib/seo/jsonld/render'
import { composeGraph } from '../../../lib/seo/jsonld/graph'
import {
  buildWebSiteNode,
  buildPersonNode,
  buildOrgNode,
} from '../../../lib/seo/jsonld/builders'

/**
 * Public (unauthenticated) layout — applies to home, blog, campaigns,
 * privacy, terms, contact, etc. Intentionally NOT applied to /admin, /cms,
 * /account.
 *
 * Sprint 5a Track E wires the LGPD cookie banner + re-open trigger gated by
 * `NEXT_PUBLIC_LGPD_BANNER_ENABLED`.
 *
 * Sprint 5b PR-C wires:
 *   - `generateMetadata` → site-wide Metadata via `generateRootMetadata`
 *     factory (metadataBase, title.template, openGraph defaults).
 *   - `<JsonLdScript>` → root nodes (`WebSite` + `Person` or `Organization`)
 *     present on every public page; per-page nodes are added in each
 *     `page.tsx` and deduped by `composeGraph` via `@id`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getSiteContext()
  const host = (await headers()).get('host')?.split(':')[0] ?? 'bythiagofigueiredo.com'
  const config = await getSiteSeoConfig(ctx.siteId, host)
  return generateRootMetadata(config)
}

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const lgpdBannerEnabled = process.env.NEXT_PUBLIC_LGPD_BANNER_ENABLED === 'true'
  const ctx = await getSiteContext()
  const host = (await headers()).get('host')?.split(':')[0] ?? 'bythiagofigueiredo.com'
  const config = await getSiteSeoConfig(ctx.siteId, host)

  const identityNode =
    config.identityType === 'person' && config.personIdentity
      ? buildPersonNode(config, config.personIdentity)
      : config.identityType === 'organization' && config.orgIdentity
        ? buildOrgNode(config, config.orgIdentity)
        : null

  const graph = composeGraph(
    [buildWebSiteNode(config), identityNode].filter((n): n is NonNullable<typeof n> => n !== null),
  )

  return (
    <CookieBannerProvider>
      <JsonLdScript graph={graph} />
      {children}
      {lgpdBannerEnabled && (
        <>
          <CookieBanner />
          <CookieBannerTrigger />
        </>
      )}
    </CookieBannerProvider>
  )
}
```

- [ ] **Step 4: Re-run the layout test + full web suite**

```bash
cd apps/web && npx vitest run test/app/seo/public-layout-metadata.test.tsx
cd apps/web && npx vitest run
```

Expected: layout test passes; full suite still green (no other test relied on the deleted root `metadata` const).

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/app/layout.tsx apps/web/src/app/\(public\)/layout.tsx apps/web/test/app/seo/public-layout-metadata.test.tsx
git commit -m "$(cat <<'EOF'
refactor(seo): cleanup root layout + add (public) layout generateMetadata

Root layout becomes a pure HTML shell — hardcoded title/metadataBase/openGraph
removed. Public route group now produces per-site Metadata via
`generateRootMetadata` and emits root JSON-LD nodes (WebSite + Person/Org)
that every public page inherits and `composeGraph` dedupes downstream.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Wire home page metadata (`/`) + JSON-LD

**Files:**
- Modify: `apps/web/src/app/(public)/page.tsx`
- Test: `apps/web/test/app/seo/home-metadata.test.tsx` (new)

- [ ] **Step 1: Failing test**

```typescript
// apps/web/test/app/seo/home-metadata.test.tsx
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn().mockResolvedValue({
    siteId: 's1', siteName: 'Thiago Figueiredo',
    siteUrl: 'https://bythiagofigueiredo.com',
    defaultLocale: 'pt-BR', supportedLocales: ['pt-BR', 'en'],
    identityType: 'person', primaryColor: '#0F172A',
    logoUrl: null, twitterHandle: 'tnFigueiredo',
    defaultOgImageUrl: null,
    contentPaths: { blog: '/blog', campaigns: '/campaigns' },
    personIdentity: null, orgIdentity: null,
  }),
}))
vi.mock('../../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', defaultLocale: 'pt-BR' }),
}))
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: () => 'bythiagofigueiredo.com' }),
}))

import { generateMetadata } from '../../../src/app/(public)/page'

describe('home generateMetadata', () => {
  it('uses generateHomeMetadata factory', async () => {
    const meta = await generateMetadata()
    expect(meta.alternates?.canonical).toBe('/')
    expect(meta.title).toBeTruthy()
  })
})
```

Run:

```bash
cd apps/web && npx vitest run test/app/seo/home-metadata.test.tsx
```

Expected: FAIL.

- [ ] **Step 2: Refactor home page**

BEFORE (`apps/web/src/app/(public)/page.tsx` lines 1-9):

```typescript
import Header from './components/Header'
import Hero from './components/Hero'
import SocialLinks from './components/SocialLinks'
import Footer from './components/Footer'
import en from '@/locales/en.json'

export const metadata = {
  title: (en as Record<string, string>)['meta.title'],
}
```

AFTER:

```typescript
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Header from './components/Header'
import Hero from './components/Hero'
import SocialLinks from './components/SocialLinks'
import Footer from './components/Footer'
import en from '@/locales/en.json'
import { getSiteContext } from '../../../lib/cms/site-context'
import { getSiteSeoConfig } from '../../../lib/seo/config'
import { generateHomeMetadata } from '../../../lib/seo/page-metadata'

// Sprint 5b PR-C — Hardcoded metadata replaced by `generateHomeMetadata`.
// Root JSON-LD (WebSite + Person) is emitted by `app/(public)/layout.tsx`
// — the home route doesn't need to add per-page nodes (no Article/Blog).
export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getSiteContext()
  const host = (await headers()).get('host')?.split(':')[0] ?? 'bythiagofigueiredo.com'
  const config = await getSiteSeoConfig(ctx.siteId, host)
  return generateHomeMetadata(config)
}
```

- [ ] **Step 3: Re-run the test**

```bash
cd apps/web && npx vitest run test/app/seo/home-metadata.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Smoke check the page still renders**

```bash
cd apps/web && npx vitest run test/app/seo
```

---

### Task 4: Wire `/privacy` + `/terms` page metadata

**Files:**
- Modify: `apps/web/src/app/(public)/privacy/page.tsx`
- Modify: `apps/web/src/app/(public)/terms/page.tsx`
- Test: `apps/web/test/app/seo/legal-metadata.test.tsx` (new)

- [ ] **Step 1: Failing test**

```typescript
// apps/web/test/app/seo/legal-metadata.test.tsx
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn().mockResolvedValue({
    siteId: 's1', siteName: 'Thiago Figueiredo',
    siteUrl: 'https://bythiagofigueiredo.com',
    defaultLocale: 'pt-BR', supportedLocales: ['pt-BR', 'en'],
    identityType: 'person', primaryColor: '#0F172A',
    logoUrl: null, twitterHandle: null, defaultOgImageUrl: null,
    contentPaths: { blog: '/blog', campaigns: '/campaigns' },
    personIdentity: null, orgIdentity: null,
  }),
}))
vi.mock('../../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', defaultLocale: 'pt-BR' }),
}))
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({
    get: (k: string) => (k === 'host' ? 'bythiagofigueiredo.com' : k === 'accept-language' ? 'pt-BR' : null),
  }),
  cookies: () => Promise.resolve({ get: () => undefined }),
}))

describe('legal pages generateMetadata', () => {
  it('privacy page emits canonical /privacy + correct title (pt-BR)', async () => {
    const { generateMetadata } = await import('../../../src/app/(public)/privacy/page')
    const meta = await generateMetadata()
    expect(meta.alternates?.canonical).toBe('/privacy')
  })

  it('terms page emits canonical /terms + correct title (pt-BR)', async () => {
    const { generateMetadata } = await import('../../../src/app/(public)/terms/page')
    const meta = await generateMetadata()
    expect(meta.alternates?.canonical).toBe('/terms')
  })
})
```

Run:

```bash
cd apps/web && npx vitest run test/app/seo/legal-metadata.test.tsx
```

Expected: FAIL — current `generateMetadata` does not call `getSiteSeoConfig`, but tests will pass on the URL only. We will tighten after refactor.

- [ ] **Step 2: Refactor privacy + terms generateMetadata to use the factory**

BEFORE (`apps/web/src/app/(public)/privacy/page.tsx` lines 12-19):

```typescript
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Política de Privacidade | bythiagofigueiredo',
    description: 'LGPD-compliant — dados coletados, direitos do titular, cookies.',
    alternates: { canonical: '/privacy' },
    robots: { index: true, follow: true },
  }
}
```

AFTER:

```typescript
import { getSiteContext } from '../../../../lib/cms/site-context'
import { getSiteSeoConfig } from '../../../../lib/seo/config'
import { generateLegalMetadata } from '../../../../lib/seo/page-metadata'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getSiteContext()
  const host = (await headers()).get('host')?.split(':')[0] ?? 'bythiagofigueiredo.com'
  const config = await getSiteSeoConfig(ctx.siteId, host)
  const locale = negotiateLocale(
    (await headers()).get('accept-language'),
    (await cookies()).get('preferred_locale')?.value ?? null,
  )
  return generateLegalMetadata(config, 'privacy', locale)
}
```

Apply the symmetric change to `terms/page.tsx`, swapping `'privacy'` → `'terms'`.

- [ ] **Step 3: Add JSON-LD BreadcrumbList to each page server component**

In `privacy/page.tsx` add at the top of `PrivacyPage`'s return (replacing the `LegalShell` open):

```typescript
import { JsonLdScript } from '../../../../lib/seo/jsonld/render'
import { composeGraph } from '../../../../lib/seo/jsonld/graph'
import { buildBreadcrumbNode } from '../../../../lib/seo/jsonld/builders'

// inside PrivacyPage, after the locale negotiation:
const breadcrumb = buildBreadcrumbNode([
  { name: 'Home', url: '/' },
  { name: locale === 'en' ? 'Privacy' : 'Privacidade', url: '/privacy' },
])
const graph = composeGraph([breadcrumb])

return (
  <>
    <JsonLdScript graph={graph} />
    <LegalShell locale={locale} lastUpdated="2026-04-16">
      <MDXContent />
    </LegalShell>
  </>
)
```

Symmetric for `terms/page.tsx` with `Terms` / `Termos` label.

- [ ] **Step 4: Re-run tests**

```bash
cd apps/web && npx vitest run test/app/seo/legal-metadata.test.tsx
```

Expected: PASS.

---

### Task 5: Commit home + legal page wiring

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/app/\(public\)/page.tsx apps/web/src/app/\(public\)/privacy/page.tsx apps/web/src/app/\(public\)/terms/page.tsx apps/web/test/app/seo/home-metadata.test.tsx apps/web/test/app/seo/legal-metadata.test.tsx
git commit -m "$(cat <<'EOF'
refactor(seo): wire home + legal pages metadata factories

Home, /privacy, /terms now read site config and call the new
`generateHomeMetadata` / `generateLegalMetadata` factories. Legal pages
also emit a BreadcrumbList JSON-LD node in addition to root WebSite +
Person/Org from the (public) layout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Wire blog list (`/blog/[locale]`) metadata + breadcrumb JSON-LD

**Files:**
- Modify: `apps/web/src/app/blog/[locale]/page.tsx`
- Test: `apps/web/test/app/seo/blog-list-metadata.test.tsx` (new)

- [ ] **Step 1: Failing test**

```typescript
// apps/web/test/app/seo/blog-list-metadata.test.tsx
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn().mockResolvedValue({
    siteId: 's1', siteName: 'Thiago Figueiredo',
    siteUrl: 'https://bythiagofigueiredo.com',
    defaultLocale: 'pt-BR', supportedLocales: ['pt-BR', 'en'],
    identityType: 'person', primaryColor: '#0F172A',
    logoUrl: null, twitterHandle: null, defaultOgImageUrl: null,
    contentPaths: { blog: '/blog', campaigns: '/campaigns' },
    personIdentity: null, orgIdentity: null,
  }),
}))
vi.mock('../../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', defaultLocale: 'pt-BR' }),
}))
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: () => 'bythiagofigueiredo.com' }),
}))

import { generateMetadata } from '../../../src/app/blog/[locale]/page'

describe('blog list generateMetadata', () => {
  it('emits hreflang for both supported locales + x-default', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'pt-BR' }) })
    expect(meta.alternates?.canonical).toBe('/blog/pt-BR')
    expect(meta.alternates?.languages).toMatchObject({
      'pt-BR': '/blog/pt-BR',
      en: '/blog/en',
      'x-default': '/blog/pt-BR',
    })
  })
})
```

Run:

```bash
cd apps/web && npx vitest run test/app/seo/blog-list-metadata.test.tsx
```

Expected: FAIL on `siteName` derivation or factory not yet called.

- [ ] **Step 2: Refactor blog list page**

BEFORE (`apps/web/src/app/blog/[locale]/page.tsx` lines 64-81):

```typescript
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const knownLocales = ['pt-BR', 'en']
  const languages: Record<string, string> = {}
  for (const loc of knownLocales) languages[loc] = `/blog/${loc}`
  languages['x-default'] = `/blog/pt-BR`
  return {
    title: 'Blog',
    description: 'Últimos posts do blog.',
    alternates: { canonical: `/blog/${locale}`, languages },
  }
}
```

AFTER:

```typescript
import { headers } from 'next/headers'
import { getSiteSeoConfig } from '../../../../lib/seo/config'
import { generateBlogListMetadata } from '../../../../lib/seo/page-metadata'
import { JsonLdScript } from '../../../../lib/seo/jsonld/render'
import { composeGraph } from '../../../../lib/seo/jsonld/graph'
import { buildBreadcrumbNode } from '../../../../lib/seo/jsonld/builders'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const ctx = await getSiteContext()
  const host = (await headers()).get('host')?.split(':')[0] ?? 'bythiagofigueiredo.com'
  const config = await getSiteSeoConfig(ctx.siteId, host)
  return generateBlogListMetadata(config, locale)
}
```

- [ ] **Step 3: Add JSON-LD breadcrumb to the page render**

In `BlogListPage` body (just before the existing `<main>` open):

```typescript
const breadcrumb = buildBreadcrumbNode([
  { name: 'Home', url: '/' },
  { name: 'Blog', url: `/blog/${locale}` },
])
const graph = composeGraph([breadcrumb])

return (
  <>
    <JsonLdScript graph={graph} />
    <main>
      {/* ... existing JSX ... */}
    </main>
  </>
)
```

- [ ] **Step 4: Re-run test**

```bash
cd apps/web && npx vitest run test/app/seo/blog-list-metadata.test.tsx test/app/blog-list.test.tsx
```

Expected: both PASS. The existing `blog-list.test.tsx` may snapshot HTML — accept the diff if the only change is the `<script type="application/ld+json">` addition.

---

### Task 7: Wire blog detail (`/blog/[locale]/[slug]`) metadata + JSON-LD

**Files:**
- Modify: `apps/web/src/app/blog/[locale]/[slug]/page.tsx`
- Test: `apps/web/test/app/seo/blog-detail-jsonld.test.tsx` (new)

- [ ] **Step 1: Failing test (snapshots @graph for blog detail)**

```typescript
// apps/web/test/app/seo/blog-detail-jsonld.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../../lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn().mockResolvedValue({
    siteId: 's1', siteName: 'Thiago Figueiredo',
    siteUrl: 'https://bythiagofigueiredo.com',
    defaultLocale: 'pt-BR', supportedLocales: ['pt-BR', 'en'],
    identityType: 'person', primaryColor: '#0F172A',
    logoUrl: null, twitterHandle: 'tnFigueiredo',
    defaultOgImageUrl: null,
    contentPaths: { blog: '/blog', campaigns: '/campaigns' },
    personIdentity: {
      type: 'person', name: 'Thiago Figueiredo', jobTitle: 'Creator & Builder',
      imageUrl: 'https://bythiagofigueiredo.com/identity/thiago.jpg',
      sameAs: ['https://github.com/tn-figueiredo'],
    },
    orgIdentity: null,
  }),
}))

vi.mock('../../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', defaultLocale: 'pt-BR' }),
}))
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: () => 'bythiagofigueiredo.com' }),
}))

const samplePost = {
  id: 'p1', site_id: 's1', author_id: 'a1', status: 'published',
  published_at: '2026-04-15T12:00:00Z', cover_image_url: null,
  translations: [{
    id: 't1', post_id: 'p1', locale: 'pt-BR', title: 'Hello',
    slug: 'hello', excerpt: 'Oi', content_mdx: '# Hello',
    content_compiled: '() => null', content_toc: [], reading_time_min: 1,
    seo_extras: null, updated_at: '2026-04-15T12:00:00Z',
  }],
}

vi.mock('../../../lib/cms/repositories', () => ({
  postRepo: () => ({
    getBySlug: vi.fn().mockResolvedValue(samplePost),
    getById: vi.fn().mockResolvedValue(samplePost),
  }),
}))
vi.mock('@tn-figueiredo/cms', async () => {
  const actual = await vi.importActual<object>('@tn-figueiredo/cms')
  return {
    ...actual,
    compileMdx: vi.fn().mockResolvedValue({ compiledSource: '() => null', toc: [], readingTimeMin: 1 }),
    MdxRunner: () => null,
  }
})
vi.mock('../../../lib/cms/registry', () => ({ blogRegistry: {} }))

import BlogDetailPage, { generateMetadata } from '../../../src/app/blog/[locale]/[slug]/page'

describe('BlogDetailPage SEO wiring', () => {
  it('generateMetadata returns Article-shaped openGraph', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    expect((meta.openGraph as { type?: string })?.type).toBe('article')
    expect(meta.alternates?.canonical).toBe('/blog/pt-BR/hello')
  })

  it('renders <script type="application/ld+json"> with BlogPosting + BreadcrumbList', async () => {
    const jsx = await BlogDetailPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'hello' }) })
    const { container } = render(jsx as never)
    const scripts = container.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts.length).toBeGreaterThanOrEqual(1)
    const payload = JSON.parse(scripts[0]!.textContent!)
    expect(payload['@context']).toBe('https://schema.org')
    expect(payload['@graph']).toBeInstanceOf(Array)
    const types = payload['@graph'].map((n: { '@type': string }) => n['@type'])
    expect(types).toContain('BlogPosting')
    expect(types).toContain('BreadcrumbList')
  })
})
```

Run:

```bash
cd apps/web && npx vitest run test/app/seo/blog-detail-jsonld.test.tsx
```

Expected: FAIL.

- [ ] **Step 2: Refactor blog detail page**

BEFORE (`apps/web/src/app/blog/[locale]/[slug]/page.tsx` lines 81-107):

```typescript
export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const ctx = await getSiteContext().catch(() => null)
  if (!ctx) return {}
  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) return {}
  const tx = loaded.translations.find((t) => t.locale === locale)
  if (!tx) return {}

  const languages: Record<string, string> = {}
  for (const t of loaded.translations) {
    languages[t.locale] = `/blog/${t.locale}/${encodeURIComponent(t.slug)}`
  }
  const defaultTx = loaded.translations.find((t) => t.locale === 'pt-BR') ?? tx
  languages['x-default'] = `/blog/${defaultTx.locale}/${encodeURIComponent(defaultTx.slug)}`

  return {
    title: tx.title, description: tx.excerpt ?? undefined,
    alternates: { canonical: `/blog/${locale}/${encodeURIComponent(slug)}`, languages },
  }
}
```

AFTER:

```typescript
import { headers } from 'next/headers'
import { getSiteSeoConfig } from '../../../../../lib/seo/config'
import { generateBlogPostMetadata } from '../../../../../lib/seo/page-metadata'
import { JsonLdScript } from '../../../../../lib/seo/jsonld/render'
import { composeGraph } from '../../../../../lib/seo/jsonld/graph'
import {
  buildBlogPostingNode,
  buildBreadcrumbNode,
  buildFaqNode,
  buildHowToNode,
  buildVideoNode,
} from '../../../../../lib/seo/jsonld/builders'

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const ctx = await getSiteContext().catch(() => null)
  if (!ctx) return {}
  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) return {}
  const host = (await headers()).get('host')?.split(':')[0] ?? 'bythiagofigueiredo.com'
  const config = await getSiteSeoConfig(ctx.siteId, host)
  return generateBlogPostMetadata(config, { ...loaded.post, translations: loaded.translations }, locale)
}
```

And in `BlogDetailPage` body, after `if (!tx) notFound()`, add:

```typescript
const host = (await headers()).get('host')?.split(':')[0] ?? 'bythiagofigueiredo.com'
const config = await getSiteSeoConfig(ctx.siteId, host)

const breadcrumb = buildBreadcrumbNode([
  { name: 'Home', url: '/' },
  { name: 'Blog', url: `/blog/${locale}` },
  { name: tx.title, url: `/blog/${locale}/${encodeURIComponent(slug)}` },
])
const blogPosting = buildBlogPostingNode(config, { ...loaded.post, translations }, translations)
const extras = (tx as { seo_extras?: { faq?: unknown; howTo?: unknown; video?: unknown } | null }).seo_extras
const extraNodes = process.env.NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED !== 'false'
  ? [
      extras?.faq ? buildFaqNode(extras.faq as never) : null,
      extras?.howTo ? buildHowToNode(extras.howTo as never) : null,
      extras?.video ? buildVideoNode(extras.video as never) : null,
    ].filter((n): n is NonNullable<typeof n> => n !== null)
  : []
const graph = composeGraph([blogPosting, breadcrumb, ...extraNodes])
```

Wrap the existing return in a fragment with `<JsonLdScript graph={graph} />` first.

- [ ] **Step 3: Re-run blog detail tests**

```bash
cd apps/web && npx vitest run test/app/seo/blog-detail-jsonld.test.tsx test/app/blog-detail.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit blog list + detail wiring**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/app/blog/\[locale\]/page.tsx apps/web/src/app/blog/\[locale\]/\[slug\]/page.tsx apps/web/test/app/seo/blog-list-metadata.test.tsx apps/web/test/app/seo/blog-detail-jsonld.test.tsx
git commit -m "$(cat <<'EOF'
refactor(seo): wire blog list + detail metadata + JSON-LD

Both blog pages now route Metadata through the page-metadata factories
and emit per-page JSON-LD: blog list adds BreadcrumbList; blog detail
adds BlogPosting + BreadcrumbList + optional FAQ/HowTo/Video from
`seo_extras` (gated by NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Wire campaign detail (`/campaigns/[locale]/[slug]`) metadata + JSON-LD

**Files:**
- Modify: `apps/web/src/app/campaigns/[locale]/[slug]/page.tsx`
- Test: `apps/web/test/app/seo/campaign-page-metadata.test.tsx` (new)

- [ ] **Step 1: Failing test**

```typescript
// apps/web/test/app/seo/campaign-page-metadata.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../../../lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn().mockResolvedValue({
    siteId: 's1', siteName: 'Thiago Figueiredo',
    siteUrl: 'https://bythiagofigueiredo.com',
    defaultLocale: 'pt-BR', supportedLocales: ['pt-BR', 'en'],
    identityType: 'person', primaryColor: '#0F172A',
    logoUrl: null, twitterHandle: null, defaultOgImageUrl: null,
    contentPaths: { blog: '/blog', campaigns: '/campaigns' },
    personIdentity: null, orgIdentity: null,
  }),
}))

const fakeCampaign = {
  id: 'c1', status: 'active',
  pdf_storage_path: null, brevo_list_id: null, interest: 'finreckoner', form_fields: [],
  campaign_translations: [{
    locale: 'pt-BR', slug: 'finreckoner-launch',
    meta_title: 'finreckoner — lançamento',
    meta_description: 'Acompanhe.',
    og_image_url: 'https://bythiagofigueiredo.com/og.png',
    main_hook_md: '# Hook',
    supporting_argument_md: null, introductory_block_md: null, body_content_md: null,
    form_intro_md: null, form_button_label: 'Enviar', form_button_loading_label: '...',
    context_tag: 'finreckoner', success_headline: 'OK', success_headline_duplicate: 'OK',
    success_subheadline: '', success_subheadline_duplicate: '',
    check_mail_text: '', download_button_label: '', extras: null,
  }],
}

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: fakeCampaign, error: null }) }),
        }),
      }),
    }),
  }),
}))

vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: () => 'bythiagofigueiredo.com' }),
}))

import CampaignPage, { generateMetadata } from '../../../src/app/campaigns/[locale]/[slug]/page'

describe('CampaignPage SEO wiring', () => {
  it('generateMetadata pulls factory output (Article + canonical)', async () => {
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'pt-BR', slug: 'finreckoner-launch' }) })
    expect(meta.alternates?.canonical).toBe('/campaigns/pt-BR/finreckoner-launch')
    expect((meta.openGraph as { type?: string })?.type).toBe('article')
  })

  it('renders @graph with Article + BreadcrumbList', async () => {
    const jsx = await CampaignPage({ params: Promise.resolve({ locale: 'pt-BR', slug: 'finreckoner-launch' }) })
    const { container } = render(jsx as never)
    const script = container.querySelector('script[type="application/ld+json"]')
    expect(script).toBeTruthy()
    const payload = JSON.parse(script!.textContent!)
    const types = payload['@graph'].map((n: { '@type': string }) => n['@type'])
    expect(types).toContain('Article')
    expect(types).toContain('BreadcrumbList')
  })
})
```

Run:

```bash
cd apps/web && npx vitest run test/app/seo/campaign-page-metadata.test.tsx
```

Expected: FAIL.

- [ ] **Step 2: Refactor campaign page**

BEFORE (`apps/web/src/app/campaigns/[locale]/[slug]/page.tsx` lines 95-106):

```typescript
export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { locale, slug } = await params
  const c = await loadCampaign(locale, slug)
  if (!c) return {}
  const tx = c.campaign_translations[0]
  if (!tx) return {}
  return {
    title: tx.meta_title as string,
    description: tx.meta_description as string,
    openGraph: { images: tx.og_image_url ? [{ url: tx.og_image_url as string }] : [] },
  }
}
```

AFTER:

```typescript
import { headers } from 'next/headers'
import { getSiteContext } from '../../../../lib/cms/site-context'
import { getSiteSeoConfig } from '../../../../lib/seo/config'
import { generateCampaignMetadata } from '../../../../lib/seo/page-metadata'
import { JsonLdScript } from '../../../../lib/seo/jsonld/render'
import { composeGraph } from '../../../../lib/seo/jsonld/graph'
import { buildArticleNode, buildBreadcrumbNode } from '../../../../lib/seo/jsonld/builders'

export async function generateMetadata({ params }: { params: Promise<PageParams> }) {
  const { locale, slug } = await params
  const c = await loadCampaign(locale, slug)
  if (!c) return {}
  const ctx = await getSiteContext()
  const host = (await headers()).get('host')?.split(':')[0] ?? 'bythiagofigueiredo.com'
  const config = await getSiteSeoConfig(ctx.siteId, host)
  return generateCampaignMetadata(config, c, locale)
}
```

In `CampaignPage` body, after `if (!tx) notFound()`, add:

```typescript
const ctx = await getSiteContext()
const host = (await headers()).get('host')?.split(':')[0] ?? 'bythiagofigueiredo.com'
const config = await getSiteSeoConfig(ctx.siteId, host)

const articleNode = buildArticleNode(config, campaign, locale)
const breadcrumbNode = buildBreadcrumbNode([
  { name: 'Home', url: '/' },
  { name: 'Campaigns', url: `/campaigns/${locale}` },
  { name: tx.meta_title as string, url: `/campaigns/${locale}/${encodeURIComponent(slug)}` },
])
const graph = composeGraph([articleNode, breadcrumbNode])
```

Wrap the return JSX with `<JsonLdScript graph={graph} />` as the first sibling.

- [ ] **Step 3: Re-run campaign tests**

```bash
cd apps/web && npx vitest run test/app/seo/campaign-page-metadata.test.tsx test/app/campaign-page.test.tsx
```

Expected: PASS.

---

### Task 9: Wire `/contact` page metadata + JSON-LD

**Files:**
- Modify: `apps/web/src/app/contact/page.tsx`
- Test: `apps/web/test/app/seo/contact-metadata.test.tsx` (new)

- [ ] **Step 1: Failing test**

```typescript
// apps/web/test/app/seo/contact-metadata.test.tsx
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn().mockResolvedValue({
    siteId: 's1', siteName: 'Thiago Figueiredo',
    siteUrl: 'https://bythiagofigueiredo.com',
    defaultLocale: 'pt-BR', supportedLocales: ['pt-BR'],
    identityType: 'person', primaryColor: '#0F172A',
    logoUrl: null, twitterHandle: null, defaultOgImageUrl: null,
    contentPaths: { blog: '/blog', campaigns: '/campaigns' },
    personIdentity: null, orgIdentity: null,
  }),
}))
vi.mock('../../../lib/cms/site-context', () => ({
  getSiteContext: () => Promise.resolve({ siteId: 's1', defaultLocale: 'pt-BR' }),
}))
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: () => 'bythiagofigueiredo.com' }),
}))

import { generateMetadata } from '../../../src/app/contact/page'

describe('contact generateMetadata', () => {
  it('emits canonical /contact', async () => {
    const meta = await generateMetadata()
    expect(meta.alternates?.canonical).toBe('/contact')
  })
})
```

Run:

```bash
cd apps/web && npx vitest run test/app/seo/contact-metadata.test.tsx
```

Expected: FAIL — `generateMetadata` not yet exported from `contact/page.tsx`.

- [ ] **Step 2: Add generateMetadata + ContactPage JSON-LD**

BEFORE (`apps/web/src/app/contact/page.tsx` lines 1-6):

```typescript
import { Suspense } from 'react'
import { ContactForm } from '../../components/contact-form'
import { submitContact } from './actions'

export const dynamic = 'force-dynamic'
```

AFTER (insertion + new import block):

```typescript
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { ContactForm } from '../../components/contact-form'
import { submitContact } from './actions'
import { getSiteContext } from '../../../lib/cms/site-context'
import { getSiteSeoConfig } from '../../../lib/seo/config'
import { generateContactMetadata } from '../../../lib/seo/page-metadata'
import { JsonLdScript } from '../../../lib/seo/jsonld/render'
import { composeGraph } from '../../../lib/seo/jsonld/graph'
import { buildBreadcrumbNode } from '../../../lib/seo/jsonld/builders'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getSiteContext()
  const host = (await headers()).get('host')?.split(':')[0] ?? 'bythiagofigueiredo.com'
  const config = await getSiteSeoConfig(ctx.siteId, host)
  return generateContactMetadata(config)
}
```

Then inside `ContactPage`, render the JSON-LD before the `<main>`:

```typescript
const breadcrumb = buildBreadcrumbNode([
  { name: 'Home', url: '/' },
  { name: 'Contact', url: '/contact' },
])
const contactPage = {
  '@type': 'ContactPage' as const,
  '@id': 'https://bythiagofigueiredo.com/contact#contact-page',
  url: 'https://bythiagofigueiredo.com/contact',
  name: 'Fale comigo',
}
const graph = composeGraph([contactPage, breadcrumb])

return (
  <>
    <JsonLdScript graph={graph} />
    <main className="max-w-xl mx-auto px-4 py-16">
      {/* ... existing JSX ... */}
    </main>
  </>
)
```

- [ ] **Step 3: Re-run test**

```bash
cd apps/web && npx vitest run test/app/seo/contact-metadata.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit campaign + contact wiring**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/app/campaigns/\[locale\]/\[slug\]/page.tsx apps/web/src/app/contact/page.tsx apps/web/test/app/seo/campaign-page-metadata.test.tsx apps/web/test/app/seo/contact-metadata.test.tsx
git commit -m "$(cat <<'EOF'
refactor(seo): wire campaign detail + contact page metadata + JSON-LD

Campaign detail emits Article + BreadcrumbList; contact emits ContactPage
+ BreadcrumbList. Both pages route Metadata through the new factories so
canonical/openGraph/twitter/hreflang come from per-site config instead
of inline string concatenation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Hook `parseMdxFrontmatter` into `savePost`

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` (lines 28-87 — `savePost`)
- Test: `apps/web/test/app/cms-blog-actions.test.ts` (extend existing)

**Why before revalidation refactor:** `savePost` will pass `seo_extras` to the repository update, which is read by `generateBlogPostMetadata` for `og_image_url` precedence. Wiring this first means the same commit that swaps to `revalidateBlogPostSeo` produces a fully consistent post on cache flush.

- [ ] **Step 1: Add failing test for frontmatter parsing**

Append to `apps/web/test/app/cms-blog-actions.test.ts`:

```typescript
describe('savePost frontmatter parsing', () => {
  it('extracts seo_extras from MDX frontmatter and persists it', async () => {
    const updateMock = vi.fn().mockResolvedValue({
      id: 'p1', translations: [{ locale: 'pt-BR', slug: 'hello' }],
    })
    vi.doMock('../../lib/cms/repositories', () => ({
      postRepo: () => ({
        getById: getByIdMock,
        update: updateMock,
        publish: vi.fn(),
        delete: deleteMock,
      }),
    }))
    const mdxWithFrontmatter = `---
seo_extras:
  faq:
    - q: "Q1"
      a: "A1"
---

# Body content`
    const { savePost: freshSavePost } = await import(
      '../../src/app/cms/(authed)/blog/[id]/edit/actions'
    )
    const result = await freshSavePost('p1', 'pt-BR', {
      content_mdx: mdxWithFrontmatter,
      title: 'Hello',
      slug: 'hello',
    })
    expect(result.ok).toBe(true)
    const args = updateMock.mock.calls[0]![1]
    expect(args.translation.seo_extras).toEqual({ faq: [{ q: 'Q1', a: 'A1' }] })
    expect(args.translation.content_mdx).not.toContain('---')
  })

  it('returns invalid_seo_extras when frontmatter is malformed', async () => {
    const malformed = `---
seo_extras:
  faq:
    - q: ""
---
body`
    const result = await savePost('p1', 'pt-BR', {
      content_mdx: malformed,
      title: 'Hello',
      slug: 'hello',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('invalid_seo_extras')
  })
})
```

Update the result-type union near top of test file imports if needed to allow `'invalid_seo_extras'`.

Run:

```bash
cd apps/web && npx vitest run test/app/cms-blog-actions.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Modify savePost to call parseMdxFrontmatter**

BEFORE (`apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` lines 22-87, `SavePostActionResult` + `savePost`):

```typescript
export type SavePostActionResult =
  | { ok: true; postId?: string }
  | { ok: false; error: 'validation_failed'; fields: Record<string, string> }
  | { ok: false; error: 'compile_failed'; message: string }
  | { ok: false; error: 'db_error'; message: string }

export async function savePost(...) {
  // ... existing validation ...
  let compiled: CompiledMdx
  try { compiled = await compileMdx(input.content_mdx, blogRegistry) } catch (e) { ... }
  try {
    await postRepo().update(id, {
      ...(input.cover_image_url !== undefined ? { cover_image_url: input.cover_image_url } : {}),
      translation: {
        locale,
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt ?? null,
        content_mdx: input.content_mdx,
        content_compiled: compiled.compiledSource,
        content_toc: compiled.toc,
        reading_time_min: compiled.readingTimeMin,
        ...(input.meta_title !== undefined ? { meta_title: input.meta_title } : {}),
        ...(input.meta_description !== undefined ? { meta_description: input.meta_description } : {}),
        ...(input.og_image_url !== undefined ? { og_image_url: input.og_image_url } : {}),
      },
    })
  } catch (e) { ... }
  revalidatePath(`/blog/${locale}`)
  revalidatePath(`/blog/${locale}/${encodeURIComponent(input.slug)}`)
  return { ok: true, postId: id }
}
```

AFTER (deltas only):

```typescript
import { parseMdxFrontmatter, SeoExtrasValidationError } from '../../../../../../../lib/seo/frontmatter'

export type SavePostActionResult =
  | { ok: true; postId?: string }
  | { ok: false; error: 'validation_failed'; fields: Record<string, string> }
  | { ok: false; error: 'compile_failed'; message: string }
  | { ok: false; error: 'invalid_seo_extras'; details: unknown }
  | { ok: false; error: 'db_error'; message: string }

export async function savePost(
  id: string,
  locale: string,
  input: SavePostActionInput,
): Promise<SavePostActionResult> {
  // ... existing validation up through requireSiteAdminForRow ...

  let mdxContent = input.content_mdx
  let seoExtras: Record<string, unknown> | null = null
  try {
    const parsed = parseMdxFrontmatter(input.content_mdx)
    seoExtras = parsed.seoExtras
    mdxContent = parsed.content
  } catch (err) {
    if (err instanceof SeoExtrasValidationError) {
      return { ok: false, error: 'invalid_seo_extras', details: err.issues }
    }
    throw err
  }

  let compiled: CompiledMdx
  try {
    compiled = await compileMdx(mdxContent, blogRegistry)
  } catch (e) {
    return { ok: false, error: 'compile_failed', message: e instanceof Error ? e.message : String(e) }
  }

  try {
    await postRepo().update(id, {
      ...(input.cover_image_url !== undefined ? { cover_image_url: input.cover_image_url } : {}),
      translation: {
        locale,
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt ?? null,
        content_mdx: mdxContent,             // stripped of frontmatter
        content_compiled: compiled.compiledSource,
        content_toc: compiled.toc,
        reading_time_min: compiled.readingTimeMin,
        seo_extras: seoExtras,                // NEW
        ...(input.meta_title !== undefined ? { meta_title: input.meta_title } : {}),
        ...(input.meta_description !== undefined ? { meta_description: input.meta_description } : {}),
        ...(input.og_image_url !== undefined ? { og_image_url: input.og_image_url } : {}),
      },
    })
  } catch (e) {
    return { ok: false, error: 'db_error', message: e instanceof Error ? e.message : String(e) }
  }

  // (revalidation refactor handled in Task 11 — leave existing revalidatePath calls in place for this commit)
  revalidatePath(`/blog/${locale}`)
  revalidatePath(`/blog/${locale}/${encodeURIComponent(input.slug)}`)
  return { ok: true, postId: id }
}
```

If the `IPostRepository.update` typed translation does not yet accept `seo_extras`, extend it in this commit too — search `apps/web/lib/cms/repositories.ts` and the `@tn-figueiredo/cms` workspace types.

- [ ] **Step 3: Re-run blog actions tests**

```bash
cd apps/web && npx vitest run test/app/cms-blog-actions.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/app/cms/\(authed\)/blog/\[id\]/edit/actions.ts apps/web/test/app/cms-blog-actions.test.ts apps/web/lib/cms/repositories.ts
git commit -m "$(cat <<'EOF'
refactor(seo): wire frontmatter parsing into savePost

savePost now strips MDX frontmatter via parseMdxFrontmatter (PR-B helper),
validates seo_extras through Zod, and persists the parsed object onto
blog_translations.seo_extras for downstream metadata + JSON-LD readers.
Frontmatter no longer leaks into compileMdx output. Returns new
'invalid_seo_extras' result variant for malformed frontmatter.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Replace `revalidatePath` with `revalidateBlogPostSeo` in 5 blog actions (includes archivePost bug fix)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts`
- Test: `apps/web/test/app/seo/archive-post-revalidation.test.ts` (new — regression test for the bug fix)
- Test: extend `apps/web/test/app/cms-blog-actions.test.ts`

- [ ] **Step 1: Failing regression test for archivePost slug-page revalidation**

```typescript
// apps/web/test/app/seo/archive-post-revalidation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const revalidateBlogPostSeoMock = vi.fn()

vi.mock('../../../lib/seo/cache-invalidation', () => ({
  revalidateBlogPostSeo: revalidateBlogPostSeoMock,
  revalidateCampaignSeo: vi.fn(),
}))

vi.mock('../../../lib/cms/auth-guards', () => ({
  requireSiteAdminForRow: vi.fn().mockResolvedValue({ siteId: 's1' }),
}))

vi.mock('../../../lib/cms/repositories', () => ({
  postRepo: () => ({
    archive: vi.fn().mockResolvedValue({
      id: 'p1', site_id: 's1',
      translations: [{ locale: 'pt-BR', slug: 'hello' }],
    }),
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import { archivePost } from '../../../src/app/cms/(authed)/blog/[id]/edit/actions'

describe('archivePost — Sprint 5b PR-C bug fix', () => {
  beforeEach(() => revalidateBlogPostSeoMock.mockClear())

  it('revalidates BOTH /blog/${locale} AND /blog/${locale}/${slug} (was missing slug page before fix)', async () => {
    await archivePost('p1')
    expect(revalidateBlogPostSeoMock).toHaveBeenCalledWith('s1', 'p1', 'pt-BR', 'hello')
    // revalidateBlogPostSeo internally calls revalidatePath for both /blog/pt-BR
    // and /blog/pt-BR/hello, plus tags. Verifying via the helper is sufficient
    // because the helper itself is unit-tested in lib/seo/__tests__/.
  })
})
```

Run:

```bash
cd apps/web && npx vitest run test/app/seo/archive-post-revalidation.test.ts
```

Expected: FAIL — `archivePost` still calls raw `revalidatePath` only for the listing page.

- [ ] **Step 2: Refactor 5 blog actions**

BEFORE (`apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` lines 84-86 inside `savePost`):

```typescript
revalidatePath(`/blog/${locale}`)
revalidatePath(`/blog/${locale}/${encodeURIComponent(input.slug)}`)
return { ok: true, postId: id }
```

AFTER:

```typescript
const ctx = await getSiteContext()
revalidateBlogPostSeo(ctx.siteId, id, locale, input.slug)
return { ok: true, postId: id }
```

BEFORE (`publishPost`, lines 89-97):

```typescript
export async function publishPost(id: string): Promise<void> {
  await requireSiteAdminForRow('blog_posts', id)
  const post = await postRepo().publish(id)
  const tx = post.translations[0]
  if (tx) {
    revalidatePath(`/blog/${tx.locale}`)
    revalidatePath(`/blog/${tx.locale}/${tx.slug}`)
  }
}
```

AFTER:

```typescript
export async function publishPost(id: string): Promise<void> {
  const { siteId } = await requireSiteAdminForRow('blog_posts', id)
  const post = await postRepo().publish(id)
  for (const tx of post.translations) {
    revalidateBlogPostSeo(siteId, id, tx.locale, tx.slug)
  }
}
```

Note: `requireSiteAdminForRow` already returns `{ siteId }` per the campaign actions file — verify the blog version too (line 9 import of `auth-guards`). If not, extend it.

BEFORE (`unpublishPost`, lines 99-107) — symmetric structure. AFTER:

```typescript
export async function unpublishPost(id: string): Promise<void> {
  const { siteId } = await requireSiteAdminForRow('blog_posts', id)
  const post = await postRepo().unpublish(id)
  for (const tx of post.translations) {
    revalidateBlogPostSeo(siteId, id, tx.locale, tx.slug)
  }
}
```

BEFORE (`archivePost`, lines 109-114 — **THE BUG**):

```typescript
export async function archivePost(id: string): Promise<void> {
  await requireSiteAdminForRow('blog_posts', id)
  const post = await postRepo().archive(id)
  const tx = post.translations[0]
  if (tx) revalidatePath(`/blog/${tx.locale}`)   // ← only the index, slug page goes stale
}
```

AFTER:

```typescript
export async function archivePost(id: string): Promise<void> {
  const { siteId } = await requireSiteAdminForRow('blog_posts', id)
  const post = await postRepo().archive(id)
  // Sprint 5b PR-C bug fix: previously only `/blog/${locale}` was revalidated,
  // leaving the slug page returning the stale published copy until cache TTL.
  // `revalidateBlogPostSeo` covers both index + slug + sitemap tag.
  for (const tx of post.translations) {
    revalidateBlogPostSeo(siteId, id, tx.locale, tx.slug)
  }
}
```

BEFORE (`deletePost`, lines 120-143). AFTER (only the revalidation tail changes):

```typescript
const tx = post.translations[0]
if (tx) {
  for (const t of post.translations) {
    revalidateBlogPostSeo(siteId, id, t.locale, t.slug)
  }
}
revalidatePath('/cms/blog')
revalidateTag(`sitemap:${siteId}`)
return { ok: true }
```

(`revalidateTag` import added.)

- [ ] **Step 3: Add import + remove orphan import**

At the top of the file:

```typescript
import { revalidateTag } from 'next/cache'
import { revalidateBlogPostSeo } from '../../../../../../../lib/seo/cache-invalidation'
```

Drop the `revalidatePath` import IF no remaining call site uses it (the `'/cms/blog'` call in `deletePost` keeps it; leave intact).

- [ ] **Step 4: Re-run all tests**

```bash
cd apps/web && npx vitest run test/app/seo/archive-post-revalidation.test.ts test/app/cms-blog-actions.test.ts
```

Expected: PASS. Note: existing `cms-blog-actions.test.ts` mocks `revalidatePath` — extend its `vi.mock('next/cache', ...)` to also mock `revalidateTag` and add a mock for `lib/seo/cache-invalidation` matching the regression test pattern.

- [ ] **Step 5: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/app/cms/\(authed\)/blog/\[id\]/edit/actions.ts apps/web/test/app/seo/archive-post-revalidation.test.ts apps/web/test/app/cms-blog-actions.test.ts
git commit -m "$(cat <<'EOF'
refactor(seo): blog actions revalidate via revalidateBlogPostSeo helper

Replaces 5 ad-hoc revalidatePath pairs across savePost/publishPost/
unpublishPost/archivePost/deletePost with the centralised
revalidateBlogPostSeo helper that flushes per-post tag, OG-image tag,
sitemap tag, list path, and slug path.

Fixes archivePost regression: previously only `/blog/{locale}` was
revalidated, leaving the slug page serving the stale published article
until the next ISR window.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Replace `revalidatePath` with `revalidateCampaignSeo` in 5 campaign actions

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/campaigns/[id]/edit/actions.ts`
- Modify: `apps/web/src/app/cms/(authed)/campaigns/new/actions.ts` (no revalidation; document why)
- Test: extend `apps/web/test/app/cms-campaigns-actions.test.ts`

- [ ] **Step 1: Extend existing campaigns test to assert helper is invoked**

Append to `apps/web/test/app/cms-campaigns-actions.test.ts`:

```typescript
const revalidateCampaignSeoMock = vi.fn()
vi.mock('../../lib/seo/cache-invalidation', () => ({
  revalidateBlogPostSeo: vi.fn(),
  revalidateCampaignSeo: revalidateCampaignSeoMock,
}))

describe('campaign actions Sprint 5b PR-C — revalidation', () => {
  beforeEach(() => revalidateCampaignSeoMock.mockClear())

  it('publishCampaign calls revalidateCampaignSeo per translation', async () => {
    // Setup: campaignRepo.publish returns campaign with two translations
    await publishCampaign('c1')
    expect(revalidateCampaignSeoMock).toHaveBeenCalledWith('s1', 'c1', 'pt-BR', expect.any(String))
    expect(revalidateCampaignSeoMock).toHaveBeenCalledWith('s1', 'c1', 'en', expect.any(String))
  })

  it('archiveCampaign calls revalidateCampaignSeo per translation', async () => { /* ... */ })
  it('deleteCampaign also revalidates sitemap tag', async () => { /* assert revalidateTag mock */ })
})
```

Run:

```bash
cd apps/web && npx vitest run test/app/cms-campaigns-actions.test.ts
```

Expected: FAIL.

- [ ] **Step 2: Refactor `saveCampaign` (lines 105-112)**

BEFORE:

```typescript
const refreshed = await campaignRepo().getById(id, siteId)
revalidatePath('/cms/campaigns')
if (refreshed) {
  for (const tx of refreshed.translations) {
    revalidatePath(`/campaigns/${tx.locale}/${encodeURIComponent(tx.slug)}`)
  }
}
return { ok: true, campaignId: id }
```

AFTER:

```typescript
const refreshed = await campaignRepo().getById(id, siteId)
revalidatePath('/cms/campaigns')
if (refreshed) {
  for (const tx of refreshed.translations) {
    revalidateCampaignSeo(siteId, id, tx.locale, tx.slug)
  }
}
return { ok: true, campaignId: id }
```

- [ ] **Step 3: Refactor `publishCampaign` (lines 116-132), `unpublishCampaign` (lines 134-141), `archiveCampaign` (lines 143-150) — same shape**

BEFORE (publishCampaign body):

```typescript
const campaign = await campaignRepo().publish(id, siteId)
revalidatePath('/cms/campaigns')
for (const tx of campaign.translations) {
  revalidatePath(`/campaigns/${tx.locale}/${encodeURIComponent(tx.slug)}`)
}
```

AFTER:

```typescript
const campaign = await campaignRepo().publish(id, siteId)
revalidatePath('/cms/campaigns')
for (const tx of campaign.translations) {
  revalidateCampaignSeo(siteId, id, tx.locale, tx.slug)
}
```

Apply to unpublish/archive symmetrically.

- [ ] **Step 4: Refactor `deleteCampaign` (lines 156-177)**

BEFORE (revalidation tail):

```typescript
for (const tx of campaign.translations) {
  revalidatePath(`/campaigns/${tx.locale}/${encodeURIComponent(tx.slug)}`)
}
revalidatePath('/cms/campaigns')
return { ok: true }
```

AFTER:

```typescript
for (const tx of campaign.translations) {
  revalidateCampaignSeo(siteId, id, tx.locale, tx.slug)
}
revalidateTag(`sitemap:${siteId}`)
revalidatePath('/cms/campaigns')
return { ok: true }
```

Add at top of file:

```typescript
import { revalidateTag } from 'next/cache'
import { revalidateCampaignSeo } from '../../../../../../../lib/seo/cache-invalidation'
```

- [ ] **Step 5: Document `createCampaign` (no-op revalidation by design)**

Edit `apps/web/src/app/cms/(authed)/campaigns/new/actions.ts` — after the `try { const campaign = ...` block returns, add a code comment (no behavior change):

```typescript
// Sprint 5b PR-C: createCampaign intentionally does NOT call
// revalidateCampaignSeo. New campaigns are inserted with status='draft' and
// drafts are excluded from the sitemap enumerator (RLS mirror filter), from
// canonical metadata, and from public routes. The first revalidation happens
// in publishCampaign once the editor flips status to 'active'.
```

- [ ] **Step 6: Re-run tests**

```bash
cd apps/web && npx vitest run test/app/cms-campaigns-actions.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/app/cms/\(authed\)/campaigns/\[id\]/edit/actions.ts apps/web/src/app/cms/\(authed\)/campaigns/new/actions.ts apps/web/test/app/cms-campaigns-actions.test.ts
git commit -m "$(cat <<'EOF'
refactor(seo): campaigns actions revalidate via revalidateCampaignSeo

5 mutating campaign actions (save/publish/unpublish/archive/delete) now
funnel through revalidateCampaignSeo. deleteCampaign additionally flushes
the per-site sitemap tag. createCampaign documented as intentional no-op
since drafts never appear in any public surface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Document `cms/(authed)/blog/new/page.tsx` no-revalidation rationale

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/blog/new/page.tsx` (comment-only)

- [ ] **Step 1: Add code comment near the `postRepo().create` call**

BEFORE (lines 46-58):

```typescript
const uniqueSlug = `sem-titulo-${Date.now()}`
const post = await postRepo().create({
  site_id: ctx.siteId,
  author_id: author.id,
  initial_translation: {
    locale: ctx.defaultLocale,
    title: 'Sem título',
    slug: uniqueSlug,
    content_mdx: '',
  },
})

redirect(`/cms/blog/${post.id}/edit`)
```

AFTER (insert comment block):

```typescript
const uniqueSlug = `sem-titulo-${Date.now()}`

// Sprint 5b PR-C: This server component creates a draft post and redirects
// to the editor. No SEO revalidation is needed because:
//   1. The post is inserted with status='draft' (default) — excluded from
//      the sitemap enumerator and canonical metadata.
//   2. The placeholder slug `sem-titulo-${Date.now()}` won't be linked from
//      any list view (drafts only show under /cms/blog).
//   3. First revalidation happens on the next savePost (when the editor
//      sets a real title/slug) via revalidateBlogPostSeo.
const post = await postRepo().create({
  site_id: ctx.siteId,
  author_id: author.id,
  initial_translation: {
    locale: ctx.defaultLocale,
    title: 'Sem título',
    slug: uniqueSlug,
    content_mdx: '',
  },
})

redirect(`/cms/blog/${post.id}/edit`)
```

- [ ] **Step 2: No new test (comment-only change). Bundle into the next commit.**

---

### Task 14: New admin actions file for site branding/identity (`updateSiteBranding`, `updateSiteIdentity`, `updateSiteSeoDefaults`)

**Files:**
- Create: `apps/web/src/app/admin/(authed)/sites/actions.ts`
- Create: `apps/web/src/app/admin/(authed)/sites/page.tsx` (minimal listing — required for the route group; one section editing branding)
- Test: `apps/web/test/app/admin/sites-actions.test.ts` (new)

**Pre-check:** `apps/web/src/app/admin/(authed)/sites/` does NOT exist (verified via `ls`). Create the directory.

- [ ] **Step 1: Failing test**

```typescript
// apps/web/test/app/admin/sites-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const revalidateTagMock = vi.fn()
vi.mock('next/cache', () => ({ revalidateTag: revalidateTagMock, revalidatePath: vi.fn() }))

const updateMock = vi.fn().mockResolvedValue({ data: null, error: null })
vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({ update: () => ({ eq: updateMock }) }),
  }),
}))

vi.mock('../../../lib/cms/auth-guards', () => ({
  requireSuperAdmin: vi.fn().mockResolvedValue({ userId: 'u1' }),
  requireSiteAdminForSite: vi.fn().mockResolvedValue({ siteId: 's1' }),
}))

import {
  updateSiteBranding,
  updateSiteIdentity,
  updateSiteSeoDefaults,
} from '../../../src/app/admin/(authed)/sites/actions'

describe('admin sites actions Sprint 5b PR-C', () => {
  beforeEach(() => {
    revalidateTagMock.mockClear()
    updateMock.mockClear()
  })

  it('updateSiteBranding writes primary_color/logo_url and invalidates seo-config tag', async () => {
    const result = await updateSiteBranding('s1', { primary_color: '#FF00AA', logo_url: 'https://x/y.png' })
    expect(result.ok).toBe(true)
    expect(revalidateTagMock).toHaveBeenCalledWith('seo-config')
  })

  it('updateSiteBranding rejects invalid primary_color', async () => {
    const result = await updateSiteBranding('s1', { primary_color: 'not-a-hex' })
    expect(result.ok).toBe(false)
  })

  it('updateSiteIdentity writes identity_type + twitter_handle, invalidates seo-config tag', async () => {
    const result = await updateSiteIdentity('s1', { identity_type: 'organization', twitter_handle: 'tnf_org' })
    expect(result.ok).toBe(true)
    expect(revalidateTagMock).toHaveBeenCalledWith('seo-config')
  })

  it('updateSiteIdentity rejects twitter_handle with @ prefix', async () => {
    const result = await updateSiteIdentity('s1', { twitter_handle: '@invalid' })
    expect(result.ok).toBe(false)
  })

  it('updateSiteSeoDefaults writes seo_default_og_image, invalidates seo-config tag', async () => {
    const result = await updateSiteSeoDefaults('s1', { seo_default_og_image: 'https://example.com/og.png' })
    expect(result.ok).toBe(true)
    expect(revalidateTagMock).toHaveBeenCalledWith('seo-config')
  })

  it('updateSiteSeoDefaults rejects non-https URL', async () => {
    const result = await updateSiteSeoDefaults('s1', { seo_default_og_image: 'http://insecure.com/og.png' })
    expect(result.ok).toBe(false)
  })
})
```

Run:

```bash
cd apps/web && npx vitest run test/app/admin/sites-actions.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 2: Create the actions file**

```typescript
// apps/web/src/app/admin/(authed)/sites/actions.ts
'use server'

import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { requireSuperAdmin } from '../../../../../lib/cms/auth-guards'

/**
 * Sprint 5b PR-C — admin actions for editing per-site SEO inputs. All three
 * call `revalidateTag('seo-config')` because `getSiteSeoConfig` (the per-site
 * Metadata + JSON-LD source) is `unstable_cache`-d under that tag. The tag
 * is broad (invalidates all sites' configs at once) — acceptable because
 * branding edits are rare. Granular per-site tags can come in Sprint 11
 * once a second site is live.
 *
 * All three are super-admin-only — site-scoped editors should not be able
 * to redirect their own brand identity. Sprint 11 may relax updateSiteBranding
 * to org_admin once multi-site CMS Hub is shipped.
 */

const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'invalid_hex_color')
const HttpsUrl = z.string().url().refine((u) => u.startsWith('https://'), 'must_be_https')
const TwitterHandle = z.string().regex(/^[A-Za-z0-9_]{1,15}$/, 'invalid_twitter_handle')

const BrandingSchema = z.object({
  primary_color: HexColor.optional(),
  logo_url: HttpsUrl.nullable().optional(),
})

const IdentitySchema = z.object({
  identity_type: z.enum(['person', 'organization']).optional(),
  twitter_handle: TwitterHandle.nullable().optional(),
})

const SeoDefaultsSchema = z.object({
  seo_default_og_image: HttpsUrl.nullable().optional(),
})

export type ActionResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'validation_failed' | 'db_error'; details?: unknown }

async function applyUpdate(siteId: string, patch: Record<string, unknown>): Promise<ActionResult> {
  await requireSuperAdmin()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.from('sites').update(patch).eq('id', siteId)
  if (error) return { ok: false, error: 'db_error', details: error.message }
  // Broad invalidation: every per-site config cached under the `seo-config`
  // tag is dropped. Branding edits are rare so the cost is negligible.
  revalidateTag('seo-config')
  return { ok: true }
}

export async function updateSiteBranding(
  siteId: string,
  input: z.infer<typeof BrandingSchema>,
): Promise<ActionResult> {
  const parsed = BrandingSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation_failed', details: parsed.error.issues }
  return applyUpdate(siteId, parsed.data)
}

export async function updateSiteIdentity(
  siteId: string,
  input: z.infer<typeof IdentitySchema>,
): Promise<ActionResult> {
  const parsed = IdentitySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation_failed', details: parsed.error.issues }
  return applyUpdate(siteId, parsed.data)
}

export async function updateSiteSeoDefaults(
  siteId: string,
  input: z.infer<typeof SeoDefaultsSchema>,
): Promise<ActionResult> {
  const parsed = SeoDefaultsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'validation_failed', details: parsed.error.issues }
  return applyUpdate(siteId, parsed.data)
}
```

If `requireSuperAdmin` does not exist in `apps/web/lib/cms/auth-guards.ts`, add a thin wrapper there using the existing `is_super_admin()` RPC. Reference the helper in `lib/cms/auth-guards.ts` — extending takes ≤15 lines following the same pattern as `requireSiteAdminForRow`.

- [ ] **Step 3: Create a minimal landing page so the route group has a valid `page.tsx`**

```typescript
// apps/web/src/app/admin/(authed)/sites/page.tsx
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'

export const dynamic = 'force-dynamic'

export default async function AdminSitesPage() {
  const supabase = getSupabaseServiceClient()
  const { data: sites } = await supabase
    .from('sites')
    .select('id, slug, name, primary_domain, identity_type, twitter_handle, primary_color, logo_url, seo_default_og_image')
    .order('slug')
  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Sites — SEO &amp; Branding</h1>
      <ul className="space-y-4">
        {(sites ?? []).map((s) => (
          <li key={s.id} className="border rounded p-4">
            <h2 className="font-semibold">{s.name} <span className="text-gray-500 text-sm">({s.slug})</span></h2>
            <dl className="grid grid-cols-2 gap-2 mt-2 text-sm">
              <dt>Primary domain</dt><dd>{s.primary_domain}</dd>
              <dt>Identity type</dt><dd>{s.identity_type}</dd>
              <dt>Twitter</dt><dd>{s.twitter_handle ?? '—'}</dd>
              <dt>Primary color</dt><dd><span style={{ background: s.primary_color, padding: '0 8px' }}>{s.primary_color}</span></dd>
              <dt>Logo</dt><dd>{s.logo_url ?? '—'}</dd>
              <dt>Default OG</dt><dd>{s.seo_default_og_image ?? '—'}</dd>
            </dl>
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500 mt-6">
        Sprint 5b PR-C: read-only listing. Edit forms ship in Sprint 6 once the
        admin UI receives the FAQ/HowTo/Video editor.
      </p>
    </main>
  )
}
```

- [ ] **Step 4: Re-run tests**

```bash
cd apps/web && npx vitest run test/app/admin/sites-actions.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit (bundles also Task 13's comment-only change)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/src/app/admin/\(authed\)/sites/actions.ts apps/web/src/app/admin/\(authed\)/sites/page.tsx apps/web/src/app/cms/\(authed\)/blog/new/page.tsx apps/web/test/app/admin/sites-actions.test.ts apps/web/lib/cms/auth-guards.ts
git commit -m "$(cat <<'EOF'
feat(admin): add site branding/identity/seo-defaults actions with seo-config invalidation

Three new server actions in /admin/(authed)/sites/actions.ts —
updateSiteBranding, updateSiteIdentity, updateSiteSeoDefaults — guarded
by requireSuperAdmin and validated by Zod. All three flush the broad
`seo-config` tag so getSiteSeoConfig refreshes on the next request.
Includes a read-only landing page listing per-site SEO state. Also
documents in cms/blog/new/page.tsx why draft creation skips revalidation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Schema-dts type-equivalence regression vitest

**Files:**
- Create: `apps/web/test/lib/seo/jsonld-builders-types.test.ts`

**Why last:** the per-builder unit tests live in PR-B; this regression file uses `expectTypeOf` to lock the *return shapes* of every builder against `schema-dts` types so accidental drift breaks compile.

- [ ] **Step 1: Failing test (will fail to compile until builders are exported)**

```typescript
// apps/web/test/lib/seo/jsonld-builders-types.test.ts
import { describe, it, expectTypeOf } from 'vitest'
import type {
  WebSite,
  Person,
  Organization,
  BlogPosting,
  Article,
  BreadcrumbList,
  FAQPage,
  HowTo,
  VideoObject,
} from 'schema-dts'

import {
  buildWebSiteNode,
  buildPersonNode,
  buildOrgNode,
  buildBlogPostingNode,
  buildArticleNode,
  buildBreadcrumbNode,
  buildFaqNode,
  buildHowToNode,
  buildVideoNode,
} from '../../../lib/seo/jsonld/builders'

describe('schema-dts type-equivalence — Sprint 5b PR-C regression gate', () => {
  it('buildWebSiteNode return shape extends WebSite', () => {
    expectTypeOf(buildWebSiteNode).returns.toMatchTypeOf<WebSite>()
  })

  it('buildPersonNode return shape extends Person', () => {
    expectTypeOf(buildPersonNode).returns.toMatchTypeOf<Person>()
  })

  it('buildOrgNode return shape extends Organization', () => {
    expectTypeOf(buildOrgNode).returns.toMatchTypeOf<Organization>()
  })

  it('buildBlogPostingNode return shape extends BlogPosting', () => {
    expectTypeOf(buildBlogPostingNode).returns.toMatchTypeOf<BlogPosting>()
  })

  it('buildArticleNode return shape extends Article', () => {
    expectTypeOf(buildArticleNode).returns.toMatchTypeOf<Article>()
  })

  it('buildBreadcrumbNode return shape extends BreadcrumbList', () => {
    expectTypeOf(buildBreadcrumbNode).returns.toMatchTypeOf<BreadcrumbList>()
  })

  it('buildFaqNode return shape extends FAQPage', () => {
    expectTypeOf(buildFaqNode).returns.toMatchTypeOf<FAQPage>()
  })

  it('buildHowToNode return shape extends HowTo', () => {
    expectTypeOf(buildHowToNode).returns.toMatchTypeOf<HowTo>()
  })

  it('buildVideoNode return shape extends VideoObject', () => {
    expectTypeOf(buildVideoNode).returns.toMatchTypeOf<VideoObject>()
  })
})
```

- [ ] **Step 2: Run the test**

```bash
cd apps/web && npx vitest run test/lib/seo/jsonld-builders-types.test.ts
```

Expected: PASS if PR-B builders return correct types. If FAIL, the diff between the actual return type and the schema-dts type will be printed — fix builder return type narrowing in PR-B (file blocker).

- [ ] **Step 3: Run the entire web test suite to verify no regressions**

```bash
cd apps/web && npm test
```

Expected: green. Mandatory — CLAUDE.md rule "ANTES de dizer que uma tarefa está completa, rodar npm test".

- [ ] **Step 4: Commit**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git add apps/web/test/lib/seo/jsonld-builders-types.test.ts
git commit -m "$(cat <<'EOF'
test(seo): schema-dts type-equivalence regression for 9 JSON-LD builders

Compile-time gate via expectTypeOf.toMatchTypeOf<T>() locks each
builder's return type against the matching schema-dts interface. Future
builder changes that drift from schema.org (renamed key, wrong type,
missing required field) fail typecheck before they reach prod and
before the runtime snapshot test even runs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: PR-C verification + push

- [ ] **Step 1: Full typecheck + test sweep**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm test
```

Expected: green (api + web). If any test outside `lib/seo` or `app/seo` fails because it snapshotted a page that now emits an extra `<script type="application/ld+json">`, accept the snapshot diff after manually inspecting that the only addition is the JSON-LD payload (verify `@graph` keys match this PR's table).

- [ ] **Step 2: Manual smoke against local dev**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run db:start
cd apps/web && npm run dev
```

Then in another shell:

```bash
curl -s http://localhost:3000/blog/pt-BR | grep -E 'application/ld\+json' | head -1
curl -s http://localhost:3000/blog/pt-BR/<some-published-slug> | grep -E '"@graph"'
curl -s http://localhost:3000/contact | grep -E 'ContactPage'
```

Each should print one match.

- [ ] **Step 3: Verify metadataBase still correct on every page**

In the browser DevTools network tab, hit `/`, `/blog/pt-BR`, `/blog/pt-BR/<slug>`, `/campaigns/pt-BR/<slug>`, `/privacy`, `/terms`, `/contact` — confirm `<link rel="canonical" href="https://bythiagofigueiredo.com/...">` is absolute and matches the path. No "missing metadataBase" warning in the dev server log.

- [ ] **Step 4: PR**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && git push -u origin feat/sprint-5b-pr-c-wire-pages
gh pr create --title "Sprint 5b PR-C: wire existing pages + JSON-LD + cache invalidation" --body "$(cat <<'EOF'
## Summary
- Refactors `generateMetadata` in 7 public page files to consume `lib/seo/page-metadata.ts` factories from PR-B
- Cleans up root `app/layout.tsx` (now a pure shell) and adds `generateMetadata` + root JSON-LD nodes (WebSite + Person/Org) to `app/(public)/layout.tsx`
- Renders `<JsonLdScript graph={...}>` per-page archetype: BlogPosting + BreadcrumbList + extras for blog detail; Article + BreadcrumbList for campaigns; BreadcrumbList for blog list / privacy / terms; ContactPage + BreadcrumbList for contact
- Wires `parseMdxFrontmatter` into `savePost` so `seo_extras` populates from MDX frontmatter
- Replaces 11 `revalidatePath` call sites with `revalidateBlogPostSeo` / `revalidateCampaignSeo` helpers; fixes `archivePost` slug-page revalidation regression
- Adds `apps/web/src/app/admin/(authed)/sites/actions.ts` with `updateSiteBranding` / `updateSiteIdentity` / `updateSiteSeoDefaults` calling `revalidateTag('seo-config')`
- Adds compile-time schema-dts gate for all 9 JSON-LD builders

## Test plan
- [ ] `npm test` (web + api) green
- [ ] `npx vitest run test/lib/seo test/app/seo test/app/admin` green
- [ ] Local dev: `curl http://localhost:3000/blog/pt-BR/<slug> | grep '@graph'` returns a payload
- [ ] DevTools: every public route emits canonical link with absolute URL, hreflang alternates present on blog list/detail + campaign detail
- [ ] `archivePost` integration: archive a published post, confirm both `/blog/pt-BR` and `/blog/pt-BR/<slug>` show the archived state immediately

## Pre-conditions verified
- PR-A merged (sites.identity_type, sites.twitter_handle, sites.seo_default_og_image, blog_translations.seo_extras live in prod)
- PR-B merged (lib/seo modules + sitemap.ts + robots.ts + OG routes deployed)

EOF
)"
```

- [ ] **Step 5: Mark PR-C done in roadmap**

After merge, update `docs/roadmap/README.md` Sprint 5b row to `PR-C ✅` and link this PR.

---

**End PR-C plan. Total estimated effort: ~5h. 16 tasks, 10 commits.**

## PR-D: CI Lighthouse + Smoke + Schema-dts Gate (~2h)

**Goal:** Wire SEO quality gates into CI so PRs fail when Lighthouse SEO/perf regress, post-deploy smoke fails when production sitemap/robots/JSON-LD/OG break, and schema-dts catches JSON-LD type drift at compile time.

**Pre-requisites:**
- PR-A merged (DB columns exist; not strictly required for PR-D but smoke check #8 hits `/api/health/seo` from PR-E — gracefully skip with `SKIP_HEALTH=1`).
- PR-B merged (creates `apps/web/lib/seo/jsonld/builders.ts`, fixtures, og-default.png).
- PR-C merged (existing pages emit JSON-LD; otherwise smoke check #4 fails on staging).

**Manual one-time setup (before Task D.1):**
- GitHub repo Settings → Secrets → Actions → optionally add `LHCI_GITHUB_APP_TOKEN` (Lighthouse CI app at https://github.com/apps/lighthouse-ci). Without it, results upload to `temporary-public-storage`.
- `CRON_SECRET` already exists (Sprint 4a) — re-used by smoke check #8.
- `secrets.GITHUB_TOKEN` is auto-provided.

**Decision recorded:** Use `patrickedqvist/wait-for-vercel-preview@v1.3.2` (battle-tested).

---

### Task D.1: Add `@lhci/cli` devDep

**Files:**
- Modify: `apps/web/package.json`
- Regenerate: `package-lock.json`

- [ ] **Step 1: Install pinned exact**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo/apps/web && \
  npm install --save-exact --save-dev @lhci/cli@0.13.0
```

- [ ] **Step 2: Verify**

```bash
grep '@lhci/cli' apps/web/package.json
```

Expected: `"@lhci/cli": "0.13.0"` (exact, no `^`).

- [ ] **Step 3: Smoke CLI**

```bash
cd apps/web && npx lhci --version
```

Expected: `0.13.0`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(deps): add @lhci/cli@0.13.0 devDep for Lighthouse CI (Sprint 5b PR-D)"
```

---

### Task D.2: Create `.lighthouserc.yml` + mobile variant

**Files:**
- Create: `.lighthouserc.yml`
- Create: `.lighthouserc.mobile.yml`

- [ ] **Step 1: Desktop config**

```yaml
# .lighthouserc.yml
ci:
  collect:
    url:
      - https://${LHCI_PREVIEW_URL}/
      - https://${LHCI_PREVIEW_URL}/blog/pt-BR
      - https://${LHCI_PREVIEW_URL}/blog/pt-BR/welcome
      - https://${LHCI_PREVIEW_URL}/privacy
      - https://${LHCI_PREVIEW_URL}/contact
    numberOfRuns: 1
    settings:
      preset: desktop
      throttlingMethod: simulate
      onlyCategories: [seo, accessibility, performance, best-practices]
      skipAudits: [uses-http2]
  assert:
    assertions:
      categories:seo: ['error', { minScore: 0.95 }]
      categories:accessibility: ['warn', { minScore: 0.90 }]
      categories:performance: ['warn', { minScore: 0.80 }]
      categories:best-practices: ['warn', { minScore: 0.90 }]
      uses-text-compression: error
      uses-rel-canonical: error
      hreflang: error
      structured-data: warn
  upload:
    target: temporary-public-storage
```

- [ ] **Step 2: Mobile config**

```yaml
# .lighthouserc.mobile.yml
ci:
  collect:
    url:
      - https://${LHCI_PREVIEW_URL}/
      - https://${LHCI_PREVIEW_URL}/blog/pt-BR
      - https://${LHCI_PREVIEW_URL}/blog/pt-BR/welcome
    numberOfRuns: 1
    settings:
      formFactor: mobile
      throttlingMethod: simulate
      screenEmulation:
        mobile: true
        width: 360
        height: 640
        deviceScaleFactor: 2
        disabled: false
      throttling:
        rttMs: 150
        throughputKbps: 1638.4
        cpuSlowdownMultiplier: 4
      onlyCategories: [seo, performance]
      skipAudits: [uses-http2]
  assert:
    assertions:
      categories:seo: ['error', { minScore: 0.95 }]
      categories:performance: ['warn', { minScore: 0.80 }]
  upload:
    target: temporary-public-storage
```

- [ ] **Step 3: Verify configs parse**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
LHCI_PREVIEW_URL=example.com npx -p @lhci/cli@0.13.0 lhci healthcheck --config=.lighthouserc.yml
LHCI_PREVIEW_URL=example.com npx -p @lhci/cli@0.13.0 lhci healthcheck --config=.lighthouserc.mobile.yml
```

Expected: `Healthcheck passed!` for both.

- [ ] **Step 4: Commit**

```bash
git add .lighthouserc.yml .lighthouserc.mobile.yml
git commit -m "ci(seo): add Lighthouse CI configs (desktop + mobile), SEO=error perf=warn"
```

---

### Task D.3: Create `.github/workflows/lighthouse.yml`

**Files:**
- Create: `.github/workflows/lighthouse.yml`

- [ ] **Step 1: Write workflow**

```yaml
name: Lighthouse CI

on:
  pull_request:
    branches: [staging, main]
    paths:
      - 'apps/web/**'
      - 'packages/cms/**'
      - '.lighthouserc.yml'
      - '.lighthouserc.mobile.yml'
      - '.github/workflows/lighthouse.yml'

concurrency:
  group: lighthouse-${{ github.ref }}
  cancel-in-progress: true

jobs:
  wait-for-vercel:
    name: Wait for Vercel preview
    runs-on: ubuntu-latest
    outputs:
      preview_url: ${{ steps.waitForVercel.outputs.url }}
    steps:
      - name: Wait for Vercel preview deployment
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.2
        id: waitForVercel
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 600
          check_interval: 10

  lhci-desktop:
    name: Lighthouse CI (desktop)
    runs-on: ubuntu-latest
    needs: wait-for-vercel
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      - name: Run LHCI (desktop)
        env:
          LHCI_PREVIEW_URL: ${{ needs.wait-for-vercel.outputs.preview_url }}
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
        run: |
          export LHCI_PREVIEW_URL="${LHCI_PREVIEW_URL#https://}"
          export LHCI_PREVIEW_URL="${LHCI_PREVIEW_URL#http://}"
          export LHCI_PREVIEW_URL="${LHCI_PREVIEW_URL%/}"
          npx -p @lhci/cli@0.13.0 lhci autorun --config=.lighthouserc.yml

  lhci-mobile:
    name: Lighthouse CI (mobile)
    runs-on: ubuntu-latest
    needs: wait-for-vercel
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
      - name: Run LHCI (mobile)
        env:
          LHCI_PREVIEW_URL: ${{ needs.wait-for-vercel.outputs.preview_url }}
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
        run: |
          export LHCI_PREVIEW_URL="${LHCI_PREVIEW_URL#https://}"
          export LHCI_PREVIEW_URL="${LHCI_PREVIEW_URL#http://}"
          export LHCI_PREVIEW_URL="${LHCI_PREVIEW_URL%/}"
          npx -p @lhci/cli@0.13.0 lhci autorun --config=.lighthouserc.mobile.yml
```

- [ ] **Step 2: Validate**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/lighthouse.yml'))" && echo OK
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/lighthouse.yml
git commit -m "ci(seo): add lighthouse workflow (waits for Vercel preview, runs desktop + mobile)"
```

---

### Task D.4: Create `scripts/seo-smoke.sh`

**Files:**
- Create: `scripts/seo-smoke.sh`

- [ ] **Step 1: Write script**

```bash
#!/usr/bin/env bash
set -euo pipefail

# SEO post-deploy smoke checks.
# Usage: scripts/seo-smoke.sh [HOST]
#   HOST defaults to https://bythiagofigueiredo.com
# Env: SKIP_HEALTH=1 to skip check #8 (pre-PR-E); CRON_SECRET required unless skipped

HOST="${1:-https://bythiagofigueiredo.com}"
HOST="${HOST%/}"

echo "=========================================="
echo "SEO smoke checks against: $HOST"
echo "=========================================="

echo; echo "[1/8] Sitemap valid XML"
SITEMAP=$(curl -sf "$HOST/sitemap.xml") || { echo "  FAIL: sitemap.xml not reachable"; exit 1; }
echo "$SITEMAP" | xmllint --noout - || { echo "  FAIL: sitemap.xml is not valid XML"; exit 1; }
echo "  OK"

echo; echo "[2/8] Robots has Sitemap: line"
ROBOTS=$(curl -sf "$HOST/robots.txt") || { echo "  FAIL: robots.txt not reachable"; exit 1; }
echo "$ROBOTS" | grep -qE "^Sitemap: $HOST/sitemap\.xml$" || { echo "  FAIL"; exit 1; }
echo "  OK"

echo; echo "[3/8] Robots disallows protected paths"
for path in /admin /cms /account /api; do
  echo "$ROBOTS" | grep -qE "^Disallow: ${path}(/|$)" || { echo "  FAIL: $path"; exit 1; }
done
echo "  OK"

echo; echo "[4/8] Blog post emits JSON-LD with @graph"
SLUG=$(echo "$SITEMAP" | grep -oE '<loc>[^<]+/blog/[^<]+</loc>' | head -1 | sed -E 's#</?loc>##g' || true)
if [ -z "$SLUG" ]; then
  echo "  SKIP: no blog post URLs in sitemap (fresh deploy)"
else
  HTML=$(curl -sf "$SLUG") || { echo "  FAIL"; exit 1; }
  echo "$HTML" | grep -q 'type="application/ld+json"' || { echo "  FAIL: no JSON-LD"; exit 1; }
  echo "$HTML" | grep -q '"@graph"' || { echo "  FAIL: no @graph"; exit 1; }
  echo "  OK"
fi

echo; echo "[5/8] OG image Content-Type image/*"
if [ -z "${HTML:-}" ]; then
  echo "  SKIP"
else
  OG_URL=$(echo "$HTML" | grep -oE 'property="og:image"[^>]*content="[^"]+"' | head -1 | sed -E 's/.*content="([^"]+)".*/\1/' || true)
  [ -z "$OG_URL" ] && OG_URL=$(echo "$HTML" | grep -oE 'content="[^"]+"[^>]*property="og:image"' | head -1 | sed -E 's/.*content="([^"]+)".*/\1/' || true)
  [ -z "$OG_URL" ] && { echo "  FAIL: no og:image"; exit 1; }
  case "$OG_URL" in http*) ;; /*) OG_URL="$HOST$OG_URL" ;; esac
  TYPE=$(curl -sfI -L "$OG_URL" | grep -i '^content-type:' | tr -d '\r' | tail -1)
  echo "$TYPE" | grep -qiE 'image/(png|jpeg|jpg|webp)' || { echo "  FAIL: $OG_URL → $TYPE"; exit 1; }
  echo "  OK"
fi

echo; echo "[6/8] Hreflang alternates"
if [ -z "${HTML:-}" ]; then echo "  SKIP"
else
  echo "$HTML" | grep -qE 'rel="alternate"[^>]*hreflang="(pt-BR|en|x-default)"' || { echo "  FAIL"; exit 1; }
  echo "  OK"
fi

echo; echo "[7/8] Dev subdomain robots Disallow: /"
DEV_ROBOTS=$(curl -sf "https://dev.bythiagofigueiredo.com/robots.txt" 2>/dev/null || true)
if [ -z "$DEV_ROBOTS" ]; then echo "  SKIP: unreachable"
else
  echo "$DEV_ROBOTS" | grep -qE '^Disallow: /$' || { echo "  FAIL"; exit 1; }
  echo "  OK"
fi

echo; echo "[8/8] /api/health/seo ok"
if [ "${SKIP_HEALTH:-0}" = "1" ]; then echo "  SKIP (SKIP_HEALTH=1)"
else
  [ -z "${CRON_SECRET:-}" ] && { echo "  FAIL: CRON_SECRET not set"; exit 1; }
  HEALTH=$(curl -sf -H "Authorization: Bearer $CRON_SECRET" "$HOST/api/health/seo") || { echo "  FAIL"; exit 1; }
  echo "$HEALTH" | grep -q '"ok":true' || { echo "  FAIL: $HEALTH"; exit 1; }
  echo "  OK"
fi

echo; echo "=========================================="
echo "All SEO smoke checks passed against $HOST"
echo "=========================================="
```

- [ ] **Step 2: chmod + local smoke**

```bash
chmod +x /Users/figueiredo/Workspace/bythiagofigueiredo/scripts/seo-smoke.sh
SKIP_HEALTH=1 ./scripts/seo-smoke.sh https://bythiagofigueiredo.com
```

Expected (pre-PR-C): #1, #2, #3, #7 pass; #4, #5, #6 may FAIL until PR-C deploys. Document expectation, do not block PR-D.

- [ ] **Step 3: Commit**

```bash
git add scripts/seo-smoke.sh
git commit -m "ci(seo): add scripts/seo-smoke.sh — 8 post-deploy checks"
```

---

### Task D.5: Create `.github/workflows/seo-post-deploy.yml`

**Files:**
- Create: `.github/workflows/seo-post-deploy.yml`

- [ ] **Step 1: Write workflow**

```yaml
name: SEO Post-Deploy Smoke

on:
  workflow_dispatch:
    inputs:
      host:
        description: 'Target host with protocol (e.g. https://bythiagofigueiredo.com)'
        required: true
        default: 'https://bythiagofigueiredo.com'
        type: string
      skip_health:
        description: 'Skip /api/health/seo check (use pre-PR-E)'
        required: false
        default: false
        type: boolean

jobs:
  smoke:
    name: SEO smoke against ${{ inputs.host }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install xmllint
        run: sudo apt-get update && sudo apt-get install -y libxml2-utils
      - name: Run smoke script
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
          SKIP_HEALTH: ${{ inputs.skip_health == true && '1' || '0' }}
        run: |
          chmod +x scripts/seo-smoke.sh
          ./scripts/seo-smoke.sh "${{ inputs.host }}"
```

- [ ] **Step 2: Validate + commit**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/seo-post-deploy.yml'))" && echo OK
git add .github/workflows/seo-post-deploy.yml
git commit -m "ci(seo): add seo-post-deploy workflow (manual dispatch with HOST input)"
```

---

### Task D.6: Add `seo-smoke` PR job to `ci.yml`

**Files:**
- Modify: `.github/workflows/ci.yml`

**MERGE ORDERING NOTE:** PR-B Task B.26 also appends to `ci.yml` (the `check-migration-applied` job). PR-D should be developed AFTER PR-B's `check-migration-applied` job has merged to `staging`. If both PRs are open simultaneously, rebase PR-D onto PR-B's tip before opening for review. Conflict zone: end of `jobs:` block. Resolution is purely additive (both jobs sit alongside).

- [ ] **Step 1: Append jobs**

At the end of the `jobs:` block in `ci.yml`:

```yaml
  wait-for-vercel-seo:
    name: Wait for Vercel preview (SEO smoke)
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    outputs:
      preview_url: ${{ steps.waitForVercel.outputs.url }}
    steps:
      - uses: patrickedqvist/wait-for-vercel-preview@v1.3.2
        id: waitForVercel
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 600
          check_interval: 10

  seo-smoke:
    name: SEO Smoke (preview)
    runs-on: ubuntu-latest
    needs: wait-for-vercel-seo
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - name: Install xmllint
        run: sudo apt-get update && sudo apt-get install -y libxml2-utils
      - name: Run smoke against Vercel preview
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
          SKIP_HEALTH: '1'
        run: |
          chmod +x scripts/seo-smoke.sh
          ./scripts/seo-smoke.sh "${{ needs.wait-for-vercel-seo.outputs.preview_url }}"
```

- [ ] **Step 2: Validate + commit**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK
git add .github/workflows/ci.yml
git commit -m "ci(seo): add seo-smoke job to ci.yml (PR preview smoke, SKIP_HEALTH=1)"
```

---

### Task D.7: Schema-dts compile-time type tests

**Files:**
- Create: `apps/web/test/lib/seo/jsonld/builders-types.test.ts`

**Pre-condition:** PR-B must have created builders + fixtures.

- [ ] **Step 1: Write test**

```typescript
// apps/web/test/lib/seo/jsonld/builders-types.test.ts
import { describe, expect, expectTypeOf, test } from 'vitest'
import type {
  Article, BlogPosting, BreadcrumbList, FAQPage, HowTo,
  Organization, Person, VideoObject, WebSite,
} from 'schema-dts'
import {
  buildArticleNode, buildBlogPostingNode, buildBreadcrumbNode, buildFaqNode,
  buildHowToNode, buildOrgNode, buildPersonNode, buildVideoNode, buildWebSiteNode,
} from '@/lib/seo/jsonld/builders'
import {
  mockConfig, mockExtras, mockOrgProfile, mockPersonProfile, mockPost, mockTxs,
} from '../__fixtures__/seo'

describe('schema-dts type equivalence (compile-time gate)', () => {
  test('Person', () => {
    const n = buildPersonNode(mockConfig, mockPersonProfile)
    expectTypeOf(n).toMatchTypeOf<Person>()
    expect(n['@id']).toMatch(/#person$/)
  })

  test('Organization', () => {
    const n = buildOrgNode(mockConfig, mockOrgProfile)
    expectTypeOf(n).toMatchTypeOf<Organization>()
    expect(n['@id']).toMatch(/#organization$/)
  })

  test('WebSite + SearchAction', () => {
    const n = buildWebSiteNode(mockConfig)
    expectTypeOf(n).toMatchTypeOf<WebSite>()
    expect((n as any).potentialAction).toBeDefined()
  })

  test('BlogPosting linked to Person', () => {
    const n = buildBlogPostingNode(mockConfig, mockPost, mockTxs)
    expectTypeOf(n).toMatchTypeOf<BlogPosting>()
    expect((n as any).author).toEqual({ '@id': expect.stringMatching(/#person$/) })
  })

  test('Article for campaigns', () => {
    const n = buildArticleNode(mockConfig, mockPost, mockTxs)
    expectTypeOf(n).toMatchTypeOf<Article>()
  })

  test('BreadcrumbList', () => {
    const n = buildBreadcrumbNode([
      { name: 'Home', url: 'https://example.com/' },
      { name: 'Blog', url: 'https://example.com/blog/pt-BR' },
    ])
    expectTypeOf(n).toMatchTypeOf<BreadcrumbList>()
  })

  test('FAQPage', () => {
    const n = buildFaqNode(mockExtras.faq!)
    expectTypeOf(n).toMatchTypeOf<FAQPage>()
  })

  test('HowTo', () => {
    const n = buildHowToNode(mockExtras.howTo!)
    expectTypeOf(n).toMatchTypeOf<HowTo>()
  })

  test('VideoObject', () => {
    const n = buildVideoNode(mockExtras.video!)
    expectTypeOf(n).toMatchTypeOf<VideoObject>()
  })
})

describe('graph composition snapshot', () => {
  test('blog post @graph — full extras', async () => {
    const { composeGraph } = await import('@/lib/seo/jsonld/graph')
    const graph = composeGraph([
      buildWebSiteNode(mockConfig),
      buildPersonNode(mockConfig, mockPersonProfile),
      buildBlogPostingNode(mockConfig, mockPost, mockTxs),
      buildBreadcrumbNode([
        { name: 'Home', url: 'https://example.com/' },
        { name: 'Blog', url: 'https://example.com/blog/pt-BR' },
        { name: mockPost.translation.title, url: `https://example.com/blog/pt-BR/${mockPost.translation.slug}` },
      ]),
      buildFaqNode(mockExtras.faq!),
    ])
    expect(graph).toMatchSnapshot()
  })
})
```

- [ ] **Step 2: Run**

```bash
cd apps/web && npx vitest run test/lib/seo/jsonld/builders-types.test.ts
```

- [ ] **Step 3: Typecheck (the actual gate)**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/test/lib/seo/jsonld/builders-types.test.ts apps/web/test/lib/seo/jsonld/__snapshots__/
git commit -m "test(seo): schema-dts expectTypeOf + @graph snapshot tests"
```

---

### Task D.8: Update CLAUDE.md CI section

**Files:**
- Modify: `/Users/figueiredo/Workspace/bythiagofigueiredo/CLAUDE.md`

- [ ] **Step 1: Replace existing `## CI` section**

Open CLAUDE.md, find `## CI` section (around line 313). Replace with:

```markdown
## CI

### Workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | push/PR `staging` | typecheck, test (api+web), audit, secret-scan, ecosystem-pinning, seo-smoke (preview, SKIP_HEALTH=1), check-migration-applied |
| `lighthouse.yml` | PR `staging`/`main` on apps/web/packages/cms changes | LHCI desktop + mobile; SEO ≥95 error, perf ≥80 warn |
| `seo-post-deploy.yml` | manual dispatch | Run `scripts/seo-smoke.sh` against any host (typically prod post-deploy) |

### Secrets

| Secret | Required | Used by |
|---|---|---|
| `NPM_TOKEN` | yes | classic PAT `read:packages` for `@tn-figueiredo/*` |
| `GITHUB_TOKEN` | auto | wait-for-vercel-preview, gh CLI |
| `CRON_SECRET` | yes | seo-smoke check #8 (`/api/health/seo`) |
| `LHCI_GITHUB_APP_TOKEN` | optional | Lighthouse CI PR comments |

### SEO post-deploy smoke (manual)

`scripts/seo-smoke.sh` runs 8 checks. Invocation:

```bash
# Local against prod:
CRON_SECRET=$(grep CRON_SECRET apps/web/.env.local | cut -d= -f2) \
  ./scripts/seo-smoke.sh https://bythiagofigueiredo.com

# Pre-PR-E (skip health check):
SKIP_HEALTH=1 ./scripts/seo-smoke.sh https://bythiagofigueiredo.com
```

Manual flow: Actions → SEO Post-Deploy Smoke → Run workflow → enter `host` + `skip_health`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(ci): update CLAUDE.md CI section — lighthouse + seo-post-deploy workflows"
```

---

### Task D.9: End-to-end PR-D validation

- [ ] **Step 1: Push + draft PR**

```bash
gh pr create --draft --title "ci(sprint-5b-d): Lighthouse CI + SEO smoke + schema-dts gates" --body "<paste test plan>"
gh pr checks --watch
```

- [ ] **Step 2: Verify CI green; mark ready**

```bash
gh pr ready
```

- [ ] **Step 3: After merge, manual post-deploy dispatch**

```bash
gh workflow run seo-post-deploy.yml -f host=https://bythiagofigueiredo.com -f skip_health=true
```

---

## PR-E: Health Endpoint + Runbook + Post-Deploy (~1h)

**Goal:** Ship the operational layer for Sprint 5b — a CRON_SECRET-protected health endpoint that exposes the SEO stack state, an incident playbook covering all six rollback flag scenarios, a post-deploy verification checklist with curl commands and GSC submission steps, and roadmap/CLAUDE.md updates marking Sprint 5b ✅ done.

**Files in scope:**
- Create: `apps/web/src/app/api/health/seo/route.ts`
- Create: `apps/web/test/app/api/health-seo.test.ts`
- Create: `docs/runbooks/seo-incident.md`
- Create: `docs/runbooks/sprint-5b-post-deploy.md`
- Modify: `docs/roadmap/phase-1-mvp.md` (Sprint 5b section)
- Modify: `docs/roadmap/README.md` (status table + Done até agora bullet)
- Modify: `CLAUDE.md` (add Sprint 5b section under Sprint 5a pattern)

**Pre-conditions (all must be ✅ before starting PR-E):**
- PR-A merged (3 migrations live in prod)
- PR-B merged (lib/seo + dynamic routes + middleware short-circuit)
- PR-C merged (page wiring + JSON-LD + cache invalidation)
- PR-D merged (Lighthouse + smoke + schema-dts gate)
- `scripts/seo-smoke.sh` exists in repo (created in PR-D)
- `.github/workflows/seo-post-deploy.yml` exists (created in PR-D)
- Open decisions resolved: AI crawler stance confirmed (default permit), Twitter handle `@thiagonfigueiredo` confirmed, `apps/web/public/identity/thiago.jpg` committed
- Production deploy of PR-C has finished (Vercel build green)

---

### Task 1: Health endpoint — failing test (auth + 503)

**Files:**
- Create: `apps/web/test/app/api/health-seo.test.ts`

- [ ] **Step 1: Write the auth + 503 failing tests**

```typescript
// apps/web/test/app/api/health-seo.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies BEFORE importing the route (Vitest hoists vi.mock).
vi.mock('@/lib/seo/site-resolver', () => ({
  resolveSiteByHost: vi.fn(),
}))
vi.mock('@/lib/seo/config', () => ({
  getSiteSeoConfig: vi.fn(),
}))
vi.mock('@/lib/seo/enumerator', () => ({
  enumerateSiteRoutes: vi.fn(),
}))

import { GET } from '@/app/api/health/seo/route'
import { resolveSiteByHost } from '@/lib/seo/site-resolver'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { enumerateSiteRoutes } from '@/lib/seo/enumerator'

const ORIGINAL_ENV = { ...process.env }

function makeReq(opts: { auth?: string | null; host?: string } = {}): NextRequest {
  const headers = new Headers()
  if (opts.auth !== null) headers.set('authorization', opts.auth ?? 'Bearer test-cron-secret')
  headers.set('host', opts.host ?? 'bythiagofigueiredo.com')
  return new NextRequest('https://bythiagofigueiredo.com/api/health/seo', { headers })
}

describe('GET /api/health/seo', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret'
    vi.clearAllMocks()
  })
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('returns 401 when authorization header missing', async () => {
    const res = await GET(makeReq({ auth: null }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when bearer token does not match CRON_SECRET', async () => {
    const res = await GET(makeReq({ auth: 'Bearer wrong' }))
    expect(res.status).toBe(401)
  })

  it('returns 503 when site cannot be resolved by host', async () => {
    vi.mocked(resolveSiteByHost).mockResolvedValue(null)
    const res = await GET(makeReq({ host: 'unknown.example.com' }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error).toBe('site_not_resolved')
  })
})
```

- [ ] **Step 2: Run the failing tests**

```bash
cd apps/web && npx vitest run test/app/api/health-seo.test.ts
```

Expected: FAIL (route file does not exist yet — ERR_MODULE_NOT_FOUND on `@/app/api/health/seo/route`).

---

### Task 2: Health endpoint — minimal route to make 401/503 pass

**Files:**
- Create: `apps/web/src/app/api/health/seo/route.ts`

- [ ] **Step 1: Implement minimal route covering auth + site-not-resolved**

```typescript
// apps/web/src/app/api/health/seo/route.ts
import type { NextRequest } from 'next/server'
import { resolveSiteByHost } from '@/lib/seo/site-resolver'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { enumerateSiteRoutes } from '@/lib/seo/enumerator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 })
  }

  const host = (req.headers.get('host') ?? '').split(':')[0]
  const site = await resolveSiteByHost(host)
  if (!site) {
    return Response.json(
      { ok: false, error: 'site_not_resolved', host },
      { status: 503 },
    )
  }

  const configStart = Date.now()
  const config = await getSiteSeoConfig(site.id, host)
  const seoConfigCachedMs = Date.now() - configStart

  const sitemapStart = Date.now()
  const routes = await enumerateSiteRoutes(site.id, config)
  const sitemapBuildMs = Date.now() - sitemapStart

  return Response.json({
    ok: true,
    siteId: site.id,
    siteSlug: site.slug,
    identityType: config.identityType,
    seoConfigCachedMs,
    sitemapBuildMs,
    sitemapRouteCount: routes.length,
    schemaVersion: 'v1',
    flags: {
      jsonLd: process.env.NEXT_PUBLIC_SEO_JSONLD_ENABLED !== 'false',
      dynamicOg: process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED !== 'false',
      extendedSchemas: process.env.NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED !== 'false',
      aiCrawlersBlocked: process.env.SEO_AI_CRAWLERS_BLOCKED === 'true',
      sitemapKilled: process.env.SEO_SITEMAP_KILLED === 'true',
    },
  })
}
```

- [ ] **Step 2: Re-run the tests — 401/503 should pass**

```bash
cd apps/web && npx vitest run test/app/api/health-seo.test.ts
```

Expected: 3/3 pass (auth missing, auth wrong, site unresolved).

---

### Task 3: Health endpoint — 200 happy-path test + flag echo

**Files:**
- Modify: `apps/web/test/app/api/health-seo.test.ts`

- [ ] **Step 1: Add the success-path test**

Append to `apps/web/test/app/api/health-seo.test.ts` inside the existing `describe`:

```typescript
  it('returns 200 with shape from spec when site resolves', async () => {
    vi.mocked(resolveSiteByHost).mockResolvedValue({
      id: 'site-uuid-1',
      slug: 'bythiagofigueiredo',
      primary_domain: 'bythiagofigueiredo.com',
    } as any)
    vi.mocked(getSiteSeoConfig).mockResolvedValue({
      siteId: 'site-uuid-1',
      siteName: 'By Thiago Figueiredo',
      siteUrl: 'https://bythiagofigueiredo.com',
      identityType: 'person',
      defaultLocale: 'pt-BR',
      supportedLocales: ['pt-BR', 'en'],
      primaryColor: '#0F172A',
      logoUrl: null,
      twitterHandle: 'tnFigueiredo',
      defaultOgImageUrl: null,
      contentPaths: { blog: '/blog', campaigns: '/campaigns' },
      personIdentity: null,
      orgIdentity: null,
    } as any)
    vi.mocked(enumerateSiteRoutes).mockResolvedValue(
      Array.from({ length: 17 }, (_, i) => ({ url: `/r/${i}`, lastModified: new Date() })) as any,
    )

    const res = await GET(makeReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      ok: true,
      siteId: 'site-uuid-1',
      siteSlug: 'bythiagofigueiredo',
      identityType: 'person',
      sitemapRouteCount: 17,
      schemaVersion: 'v1',
    })
    expect(typeof body.seoConfigCachedMs).toBe('number')
    expect(typeof body.sitemapBuildMs).toBe('number')
    expect(body.flags).toMatchObject({
      jsonLd: expect.any(Boolean),
      dynamicOg: expect.any(Boolean),
      extendedSchemas: expect.any(Boolean),
      aiCrawlersBlocked: expect.any(Boolean),
      sitemapKilled: expect.any(Boolean),
    })
  })

  it('flags reflect env var state', async () => {
    process.env.NEXT_PUBLIC_SEO_JSONLD_ENABLED = 'false'
    process.env.SEO_AI_CRAWLERS_BLOCKED = 'true'
    process.env.SEO_SITEMAP_KILLED = 'true'
    vi.mocked(resolveSiteByHost).mockResolvedValue({
      id: 's', slug: 'bythiagofigueiredo', primary_domain: 'bythiagofigueiredo.com',
    } as any)
    vi.mocked(getSiteSeoConfig).mockResolvedValue({ identityType: 'person' } as any)
    vi.mocked(enumerateSiteRoutes).mockResolvedValue([])

    const res = await GET(makeReq())
    const body = await res.json()
    expect(body.flags.jsonLd).toBe(false)
    expect(body.flags.aiCrawlersBlocked).toBe(true)
    expect(body.flags.sitemapKilled).toBe(true)
  })
```

- [ ] **Step 2: Run all 5 tests**

```bash
cd apps/web && npx vitest run test/app/api/health-seo.test.ts
```

Expected: 5/5 pass. If `siteUrl`/`identityType` fields differ in real `SiteSeoConfig` shape, adjust mocks to match the actual interface from `lib/seo/config.ts`.

- [ ] **Step 3: Run full apps/web suite as regression check**

```bash
cd apps/web && npm test -- --run
```

Expected: all green (PR-C/D suites continue to pass).

- [ ] **Step 4: Commit health endpoint**

```bash
git add apps/web/src/app/api/health/seo/route.ts apps/web/test/app/api/health-seo.test.ts
git commit -m "feat(seo): add CRON_SECRET-protected /api/health/seo endpoint"
```

---

### Task 4: Incident runbook — `seo-incident.md`

**Files:**
- Create: `docs/runbooks/seo-incident.md`

- [ ] **Step 1: Write the runbook with all six scenarios**

```markdown
# SEO Incident Runbook (Sprint 5b)

**Owner:** thiagonfigueiredo · **Last updated:** 2026-04-16 · **Sprint:** 5b
**Stack:** Next.js 15 App Router + Vercel + Supabase + `@tn-figueiredo/seo@0.1.0` wrapper in `apps/web/lib/seo/`.

## Quick reference — feature flags

| Symptom | Flag (Vercel env) | Effect | TTR |
|---|---|---|:-:|
| JSON-LD validator failures | `NEXT_PUBLIC_SEO_JSONLD_ENABLED=false` | `<JsonLdScript>` returns null | <60s |
| FAQ/HowTo/Video schema penalty | `NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED=false` | extras nodes skipped from `@graph` | <60s |
| OG image broken in social shares | `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED=false` | falls through precedence chain to static `/og-default.png` | <60s |
| Drafts in sitemap | `SEO_SITEMAP_KILLED=true` | `app/sitemap.ts` returns `[]` | <60s |
| AI crawler load spike | `SEO_AI_CRAWLERS_BLOCKED=true` | adds GPTBot/CCBot/anthropic-ai/Google-Extended Disallow rules | <60s |

**To flip:** Vercel Dashboard → bythiagofigueiredo (web) → Settings → Environment Variables → edit → "Save and Redeploy" (Production). Vercel triggers an instant edge config update + new deployment build — env-only change ships in ~30–60s.

**Always run after any flag flip:**

```bash
curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq .flags
```

Confirm the changed flag reflects the new value.

---

## Scenario A — Sitemap returns empty in prod

**Symptom:**
- `curl https://bythiagofigueiredo.com/sitemap.xml` returns `<urlset></urlset>` (no `<url>` children)
- Google Search Console reports "0 URLs discovered" or sudden drop
- Sentry: spike in `component: 'sitemap'` events

**Diagnose (in order):**

1. **Confirm site resolves at the host.**
   ```bash
   curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq '.ok, .siteId, .sitemapRouteCount'
   ```
   - `ok: false` + `error: 'site_not_resolved'` → DNS/Host header issue or `sites.primary_domain` mismatch. Check `select primary_domain from sites where slug='bythiagofigueiredo';` in Supabase SQL editor.
   - `sitemapRouteCount: 0` but `ok: true` → site resolves but enumerator returns nothing → continue to step 2.

2. **Check kill-switch flag.**
   ```bash
   curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq '.flags.sitemapKilled'
   ```
   - `true` → someone toggled emergency kill. Decide whether to keep killed or restore (`SEO_SITEMAP_KILLED=false`).

3. **Check enumerator output directly via SQL.**
   ```sql
   select count(*) from blog_posts
     where site_id = '<site-uuid>'
       and status = 'published'
       and published_at <= now()
       and published_at is not null;
   ```
   - 0 rows → no published posts (data issue, not a bug — sitemap is correct).
   - >0 rows but sitemap empty → enumerator query mismatch with RLS mirror; check Supabase logs for query errors.

4. **Check Vercel cache.**
   - `app/sitemap.ts` is `force-dynamic` so should not cache, but if `revalidateTag('sitemap:${siteId}')` invalidations are stuck, force a rebuild: redeploy from Vercel Dashboard → Deployments → ⋯ → Redeploy.

**Recover:**
- If kill-switch was on intentionally: leave as-is; document reason in this runbook.
- If accidental: set `SEO_SITEMAP_KILLED=false` → redeploy → re-run health check.
- If data issue: confirm content team intent; no code change needed.
- If enumerator bug: revert PR-B/C with `vercel rollback` to last-known-good deployment URL while diagnosing.

**Post-recovery:**
- Re-submit sitemap to GSC (Sitemaps page → ⋯ → Resubmit) to force re-crawl.
- Run `scripts/seo-smoke.sh https://bythiagofigueiredo.com` → all 8 checks should pass.

---

## Scenario B — OG image broken in social previews

**Symptom:**
- Sharing blog/campaign URL on Slack/WhatsApp/Twitter/LinkedIn shows no image, broken-image icon, or wrong image
- Sentry: spike in `component: 'og-route'` exception events

**Diagnose (in order):**

1. **Reproduce the failing URL.**
   - Get the affected page's OG URL from page source: `view-source:https://bythiagofigueiredo.com/blog/pt-BR/<slug>` → search `og:image`
   - `curl -I "$OG_URL"` — expect `HTTP/2 200` + `content-type: image/png`
   - If 302 → redirect to `/og-default.png` was triggered by the route's catch handler → bug in render path. Check Sentry stack trace.
   - If 404 → site/post not resolved; verify `slug` + `locale` in URL match DB.
   - If 500 → unhandled exception in `ImageResponse` rendering; Sentry should have full trace tagged `component: 'og-route'`.

2. **Check Sentry tag filter.**
   - Sentry dashboard → Issues → filter `component:og-route` last 24h.
   - Common causes: font fetch failure (Inter subset 404), missing `sites.primary_color`, `post.translation.title` undefined for given locale.

3. **Check the OG route via API health check.**
   ```bash
   curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq '.flags.dynamicOg'
   ```
   - Confirm flag state matches expectation.

**Recover (degrade gracefully):**

```
Vercel → Settings → Environment Variables → set:
  NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED=false
→ Save → Redeploy
```

This drops the dynamic OG step from the precedence chain. Pages now resolve OG images via:
1. `seo_extras.og_image_url` (per-post frontmatter override)
2. `cover_image_url` from `blog_translations`
3. ~~Dynamic OG~~ (skipped while flag off)
4. `sites.seo_default_og_image`
5. `/og-default.png` (static)

**Verify recovery:**
- Use [opengraph.xyz](https://www.opengraph.xyz/) or LinkedIn Post Inspector to fetch a previously-broken URL.
- Re-share on Slack/WhatsApp — preview should now show the static or DB-uploaded fallback.
- Once Sentry investigation identifies root cause, fix in code, re-enable flag.

**LinkedIn cache note:** LinkedIn caches OG previews for ~7 days. Use [Post Inspector](https://www.linkedin.com/post-inspector/) to force re-crawl.

---

## Scenario C — Google Rich Results validator fails

**Symptom:**
- Rich Results Test ([rich-results-test](https://search.google.com/test/rich-results)) on a blog post URL reports "Page is not eligible for rich results" or specific schema errors
- Search Console → Enhancements → "Articles" or "Breadcrumbs" report shows new errors after deploy
- Sentry: any `component: 'jsonld'` events (rare — most failures are silent)

**Diagnose (in order):**

1. **Capture the rendered JSON-LD.**
   ```bash
   curl -sf https://bythiagofigueiredo.com/blog/pt-BR/<slug> | grep -A 200 'application/ld+json' | head -200
   ```
   Copy the JSON between `<script type="application/ld+json">…</script>`.

2. **Validate manually.**
   - Paste into [Schema.org Validator](https://validator.schema.org/)
   - Paste into [Rich Results Test](https://search.google.com/test/rich-results)
   - Note: the two validators are stricter than necessary in different ways. Schema.org validator rejects unknown properties; Rich Results focuses on Google's eligibility rules.

3. **Common failure modes (in order of likelihood):**
   - `BlogPosting.image` missing or 404 — often the OG image URL is broken; check Scenario B.
   - `BlogPosting.author` is bare object instead of `{'@id': '...#person'}` — `composeGraph` `@id` linking regression
   - `BreadcrumbList.itemListElement[N].item` not absolute URL — config `siteUrl` missing protocol
   - `FAQPage.mainEntity` empty array — frontmatter `seo_extras.faq` had `[]`; should be missing-or-non-empty per Zod schema
   - `Person.sameAs` URL 404 — broken social link in `identity-profiles.ts`

4. **Check schema-dts test gate.**
   ```bash
   cd apps/web && npx vitest run lib/seo/jsonld/__tests__/builders.test.ts
   ```
   - Should still be green (compile-time guard). If it's red, the regression slipped past CI — fix urgently.

**Recover (immediate):**

```
Vercel → Environment Variables:
  NEXT_PUBLIC_SEO_JSONLD_ENABLED=false   # disables ALL JSON-LD
  -- OR (preferred, narrower scope) --
  NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED=false   # keeps base nodes, drops FAQ/HowTo/Video
→ Save → Redeploy
```

Prefer the narrower flag if the failure is in `seo_extras` schemas; Google still rewards `BlogPosting + BreadcrumbList + Person` even without rich extras.

**Verify recovery:**
- Re-run Rich Results Test on the previously-failing URL → should at least pass `BlogPosting` if base flag is left on, or skip JSON-LD entirely if both flags are off.
- Run `scripts/seo-smoke.sh` → check 4 (`@graph` present) will fail if `NEXT_PUBLIC_SEO_JSONLD_ENABLED=false` — that is expected during incident.

**Post-recovery:**
- Fix root cause (likely a builder in `lib/seo/jsonld/builders.ts`).
- Add a regression snapshot test capturing the failing case.
- Re-enable flag; redeploy.

---

## Scenario D — Hreflang shows wrong alternates

**Symptom:**
- Search Console → Legacy tools → International targeting reports hreflang errors
- Page's `<link rel="alternate" hreflang="en" href="...">` points to a non-existent `en` translation
- One locale's blog index lists posts missing in the other locale (cache desync)

**Diagnose (in order):**

1. **Check rendered alternates on a sample page.**
   ```bash
   curl -sf https://bythiagofigueiredo.com/blog/pt-BR/<slug> | grep -E 'rel="alternate" hreflang'
   ```
   Expect: one line per supported locale + one `x-default`.

2. **Check translation availability in DB.**
   ```sql
   select locale, slug, status from blog_translations bt
     join blog_posts bp on bp.id = bt.post_id
     where bp.slug_root = '<post-slug-root>'
       and bp.status = 'published';
   ```
   - If `en` row has `status='draft'` or doesn't exist → page should NOT emit `hreflang="en"` for it. If it does, that's an enumerator/factory bug.

3. **Verify enumerator output for sitemap.**
   ```bash
   curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq '.sitemapRouteCount'
   ```
   - Compare against expected count: `select count(*) from blog_translations bt join blog_posts bp on bp.id=bt.post_id where bp.site_id=$site and bp.status='published'`.

4. **Check `sites.supported_locales`.**
   ```sql
   select slug, supported_locales from sites where slug='bythiagofigueiredo';
   ```
   - Must be `{pt-BR, en}` post-migration `…000003`. If still `{pt-BR}`, the `en` alternate would never emit even when translations exist.

**Recover:**

1. **Force cache invalidation** (revalidateTag may have stuck):
   - In Vercel Dashboard → Deployments → ⋯ → Redeploy (rebuilds full edge cache).
   - Or programmatically via admin action: trigger any `savePost` on the affected post (calls `revalidateBlogPostSeo`).

2. **If enumerator bug confirmed:** revert PR-B's `enumerator.ts` change, redeploy.

3. **If `sites.supported_locales` wrong:** run idempotent backfill again:
   ```sql
   update sites set supported_locales = array['pt-BR','en']
     where slug='bythiagofigueiredo';
   ```

**Verify recovery:**
- Re-fetch sample page, check alternates match DB reality.
- Submit sitemap to GSC, wait 24–72h for re-crawl, recheck Hreflang report.

---

## Scenario E — AI crawler causing load spike

**Symptom:**
- Vercel Analytics shows sudden 5–10× spike in non-Googlebot traffic
- User-Agent breakdown reveals high volume from `GPTBot`, `CCBot`, `anthropic-ai`, `Google-Extended`, `PerplexityBot`, `ClaudeBot`
- Vercel Hobby invocation limits at risk (or already throttled)

**Diagnose:**

1. **Identify the crawler.**
   - Vercel Dashboard → Analytics → Top User Agents (last 1h, 24h)
   - Check for any `*Bot` UA outside Googlebot/Bingbot/SocialBot list

2. **Check current robots stance.**
   ```bash
   curl -sf https://bythiagofigueiredo.com/robots.txt | grep -A 1 -E 'GPTBot|CCBot|anthropic-ai|Google-Extended'
   ```
   - If no Disallow rules for these UAs → flag is currently OFF (default permit).

3. **Confirm health endpoint flag state.**
   ```bash
   curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq '.flags.aiCrawlersBlocked'
   ```

**Recover:**

```
Vercel → Environment Variables:
  SEO_AI_CRAWLERS_BLOCKED=true
→ Save → Redeploy
```

Effect: `buildRobotsRules` adds Disallow rules for `GPTBot`, `CCBot`, `anthropic-ai`, `Google-Extended`, `PerplexityBot`, `ClaudeBot`, `Bytespider`, `Amazonbot` (full list in `lib/seo/robots-config.ts`).

**Verify recovery:**
- Re-fetch `/robots.txt` and confirm new Disallow lines present.
- Monitor Vercel Analytics over next 1–2 hours — load should drop. (Note: well-behaved bots respect robots within ~1h; misbehaving bots ignore — escalate to Cloudflare WAF rule if needed.)

**Policy note:** Default stance is **permit** (decision logged in spec Section "Open decisions" #1). Re-enabling permit later requires conscious choice — leave the flag ON until next AI policy review.

---

## Scenario F — Drafts leaked into sitemap (CRITICAL)

**Symptom:**
- Sitemap contains URLs for posts where `status != 'published'` or `published_at > now()`
- Search Console indexes a "Coming Soon" or unpublished URL
- Editor reports a post they didn't publish appearing in Google search

**This is a data leak. Treat as P0.**

**Recover (FIRST, before diagnosing):**

```
Vercel → Environment Variables:
  SEO_SITEMAP_KILLED=true
→ Save → Redeploy
```

`app/sitemap.ts` immediately starts returning `[]`. Crawlers hitting `/sitemap.xml` see empty urlset; existing crawled URLs remain in Google's index but no new leak.

**Verify kill switch:**
```bash
curl -sf https://bythiagofigueiredo.com/sitemap.xml | grep -c '<url>'   # expect: 0
```

**Then diagnose:**

1. **Audit RLS mirror in `enumerator.ts`.**
   - Read `apps/web/lib/seo/enumerator.ts` — confirm WHERE clause has:
     - `status = 'published'`
     - `published_at <= now()`
     - `published_at is not null`
   - Compare against the actual RLS policy: `\d+ blog_posts` in psql → look at `blog_posts_public_read_published`.

2. **Audit recent migrations.**
   ```bash
   ls -t supabase/migrations | head -10
   ```
   - Did anything change `blog_posts.status` enum or RLS policies recently?

3. **Force-purge leaked URLs from Google.**
   - Search Console → Removals → New request → "Temporarily remove URL" → submit each leaked URL.
   - Lasts ~6 months; permanent removal requires the URL to 404 or noindex.

**Fix root cause:**
- Patch the enumerator query.
- Add a regression test in `lib/seo/__tests__/enumerator.integration.test.ts` (DB-gated) that creates a draft + scheduled-future post and asserts neither appears in `enumerateSiteRoutes` output.
- Land fix → flip `SEO_SITEMAP_KILLED=false` → redeploy.

**Verify full recovery:**
- `curl /sitemap.xml | xmllint --noout -` (valid XML)
- `curl /sitemap.xml | grep -c '<url>'` matches expected count from SQL count
- Manually scan first 20 URLs; cross-reference each with `select status, published_at from blog_posts where slug=...` — every URL must be `status='published'` AND `published_at <= now()`.

---

## Health endpoint reference

```bash
curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq
```

Response shape:
```json
{
  "ok": true,
  "siteId": "uuid",
  "siteSlug": "bythiagofigueiredo",
  "identityType": "person",
  "seoConfigCachedMs": 12,
  "sitemapBuildMs": 245,
  "sitemapRouteCount": 17,
  "schemaVersion": "v1",
  "flags": {
    "jsonLd": true,
    "dynamicOg": true,
    "extendedSchemas": true,
    "aiCrawlersBlocked": false,
    "sitemapKilled": false
  }
}
```

| Field | Healthy range | Investigate when |
|---|---|---|
| `ok` | `true` | `false` → check `error` field |
| `seoConfigCachedMs` | <50 (cached), <500 (cold) | >1000 → DB connection issue |
| `sitemapBuildMs` | <500 | >2000 → enumerator query slow |
| `sitemapRouteCount` | matches DB count | drops >20% sudden → leak or kill switch |

## Sentry tag conventions (Sprint 5b)

All SEO-layer exceptions tagged with `seo: true` plus `component`:
- `component: 'sitemap'`
- `component: 'robots'`
- `component: 'og-route'` (further sub-tagged `type: 'blog' | 'campaign' | 'generic'`)
- `component: 'jsonld'`
- `component: 'seo-config'`

Filter Sentry: `seo:true component:og-route last:24h`.

## Escalation

- **Owner unreachable:** revert to last-known-good Vercel deployment via Dashboard → Deployments → ⋯ → "Promote to Production" on the previous green build.
- **Total SEO outage (multiple flags failing):** `vercel rollback` to pre-Sprint-5b deployment SHA. SEO regresses to Sprint 5a baseline (no sitemap, no JSON-LD, no dynamic OG) but site stays up.
```

- [ ] **Step 2: Verify markdown renders cleanly**

```bash
ls /Users/figueiredo/Workspace/bythiagofigueiredo/docs/runbooks/
# Confirm seo-incident.md sits next to lgpd-request-handling.md
wc -l /Users/figueiredo/Workspace/bythiagofigueiredo/docs/runbooks/seo-incident.md
# Expect ~280-330 lines
```

- [ ] **Step 3: Commit runbook**

```bash
git add docs/runbooks/seo-incident.md
git commit -m "docs(seo): add incident runbook for sprint 5b SEO stack"
```

---

### Task 5: Post-deploy verification doc

**Files:**
- Create: `docs/runbooks/sprint-5b-post-deploy.md`

- [ ] **Step 1: Write the actionable post-deploy checklist**

```markdown
# Sprint 5b — Post-Deploy Verification Checklist

**Owner:** thiagonfigueiredo · **Use after:** PR-E merged to `main` and Vercel production deploy is green.
**Estimated time:** 30 minutes (interactive — opens 4 external dashboards).

## 0. Pre-flight

```bash
# Confirm prod is on the PR-E SHA
curl -sf https://bythiagofigueiredo.com/api/health/seo \
  -H "Authorization: Bearer $CRON_SECRET" | jq '.schemaVersion'
# Expect: "v1"
```

If 401 → `CRON_SECRET` env mismatch between local and Vercel; resolve before proceeding.

## 1. Smoke test (CI workflow)

```bash
gh workflow run seo-post-deploy.yml \
  --repo bythiagofigueiredo/bythiagofigueiredo \
  --ref main \
  -f host=https://bythiagofigueiredo.com
```

Wait ~2 min for completion:
```bash
gh run list --workflow=seo-post-deploy.yml --limit 1
gh run view <run-id> --log
```

Expect: all 8 smoke checks ✅. If any fail, jump to `docs/runbooks/seo-incident.md` for the matching scenario.

**Manual fallback (if workflow file not yet deployed):**
```bash
CRON_SECRET=<prod-secret> ./scripts/seo-smoke.sh https://bythiagofigueiredo.com
```

## 2. Health endpoint deep check

```bash
curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq
```

- [ ] `ok: true`
- [ ] `siteSlug: "bythiagofigueiredo"`
- [ ] `identityType: "person"`
- [ ] `seoConfigCachedMs < 500`
- [ ] `sitemapBuildMs < 1000`
- [ ] `sitemapRouteCount` matches `select count(*)` of published posts/active campaigns + 5 static
- [ ] `flags.jsonLd: true`, `flags.dynamicOg: true`, `flags.extendedSchemas: true`
- [ ] `flags.sitemapKilled: false`, `flags.aiCrawlersBlocked: false` (per Sprint 5b open decision #1)

## 3. Rich Results — manual

Open [Rich Results Test](https://search.google.com/test/rich-results) in a browser.

- [ ] Test URL: `https://bythiagofigueiredo.com/blog/pt-BR/<latest-published-post-slug>`
  - Expect detected items: **BlogPosting**, **BreadcrumbList**, **Person**
  - 0 errors, warnings allowed
- [ ] Test URL: `https://bythiagofigueiredo.com/campaigns/pt-BR/<latest-active-campaign-slug>`
  - Expect detected items: **Article**, **BreadcrumbList**
  - 0 errors

If a post has `seo_extras.faq` / `howTo` / `video` frontmatter, that test URL should additionally surface **FAQPage** / **HowTo** / **VideoObject**.

## 4. Schema.org strict validator

Open [validator.schema.org](https://validator.schema.org/) — paste full URL.

- [ ] Same blog post URL → no "unknown property" warnings on `BlogPosting` / `Person` / `BreadcrumbList`

## 5. Social previews — manual

For one blog post URL:

- [ ] **Slack:** paste in any channel → preview shows OG image + title + description
- [ ] **WhatsApp:** paste in any chat → preview shows OG image
- [ ] **LinkedIn:** [Post Inspector](https://www.linkedin.com/post-inspector/) → "Inspect" → preview renders correctly
- [ ] **Twitter/X:** [Card Validator](https://cards-dev.twitter.com/validator) (fallback to manual share if validator deprecated) → `summary_large_image` card renders with image
- [ ] **Facebook:** [Sharing Debugger](https://developers.facebook.com/tools/debug/) → image + meta tags correct

If any image broken → Scenario B in `seo-incident.md`.

## 6. Sitemap submission — Google Search Console

1. Open [Search Console](https://search.google.com/search-console) → property `https://bythiagofigueiredo.com`
2. Sidebar → **Sitemaps** → "Add a new sitemap" → enter `sitemap.xml` → Submit
3. Status should change to "Success" within ~10 minutes
4. - [ ] Sitemap submitted to GSC

If property not yet verified, do one-time setup: GSC → Add property → DNS verification (record stays in Vercel DNS).

## 7. Sitemap submission — Bing Webmaster Tools

1. Open [Bing Webmaster Tools](https://www.bing.com/webmasters/)
2. Add site `bythiagofigueiredo.com` if not already added (use Import from GSC for one-click setup)
3. Sitemaps → Submit sitemap → `https://bythiagofigueiredo.com/sitemap.xml`
4. - [ ] Sitemap submitted to Bing

## 8. Lighthouse mobile

Run from local Chrome (DevTools → Lighthouse → Mobile, Throttle: Mobile, Categories: SEO+Perf+Accessibility+Best-Practices):

- [ ] `/` → SEO ≥95, perf ≥80
- [ ] `/blog/pt-BR` → SEO ≥95, perf ≥80
- [ ] `/blog/pt-BR/<latest-slug>` → SEO ≥95, perf ≥80
- [ ] `/contact` → SEO ≥95

(LHCI in PR-D runs against preview; this manual run validates prod.)

## 9. Dev/preview noindex confirmation

```bash
curl -sf https://dev.bythiagofigueiredo.com/robots.txt
# Expect: 'User-agent: *\nDisallow: /'

curl -sf https://<latest-preview-url>.vercel.app/robots.txt
# Expect: 'User-agent: *\nDisallow: /'
```

- [ ] Dev subdomain robots = `Disallow: /`
- [ ] Preview deployment robots = `Disallow: /`

## 10. Sentry — 24h watch

24 hours after deploy, in Sentry:

- [ ] Filter `seo:true` last 24h → 0 unresolved issues
- [ ] Filter `component:og-route` last 24h → 0 errors (excluding bots probing nonexistent slugs, which legitimately return 302→`/og-default.png`)
- [ ] Filter `component:sitemap OR component:robots` last 24h → 0 errors
- [ ] Filter `component:jsonld` last 24h → 0 errors

If any errors: open the corresponding scenario in `seo-incident.md`.

## 11. 7-day GSC follow-up

7 days after submission:

- [ ] GSC → Sitemaps → submitted sitemap status: "Success" + "Discovered URLs" matches count
- [ ] GSC → Pages → ≥1 new URL in "Indexed" (not "Discovered – currently not indexed")
- [ ] GSC → Search appearance → Articles report shows ≥1 entry (BlogPosting recognized)
- [ ] GSC → Search appearance → Breadcrumbs report shows entries

Failure to index in 7 days does not block sprint closeout — but file follow-up issue if Articles report stays empty for 14 days.

## 12. Roadmap + memory updates

After steps 1–10 are ✅ (Sprint 5b deployed and verified):

- [ ] `docs/roadmap/phase-1-mvp.md` Sprint 5b status → ✅ done with completion date
- [ ] `docs/roadmap/README.md` "Done até agora" — add Sprint 5b bullet
- [ ] `CLAUDE.md` — add Sprint 5b summary section
- [ ] User memory `MEMORY.md` — add `project_sprint5b_closed.md` entry (mirroring `project_sprint5a_closed.md`)
- [ ] Commit: `docs(roadmap): close sprint 5b — SEO hardening`
```

- [ ] **Step 2: Commit post-deploy doc**

```bash
git add docs/runbooks/sprint-5b-post-deploy.md
git commit -m "docs(seo): add sprint 5b post-deploy verification checklist"
```

---

### Task 6: Roadmap update — `phase-1-mvp.md`

**Files:**
- Modify: `docs/roadmap/phase-1-mvp.md`

> **Note:** Sprint 5b is currently described inside the "Sprint 5 — Public Launch Prep [☐ not-started] (38h)" section as one bullet. The decomposition into 5a/5b/5c/5d happened in actual execution (per CLAUDE.md). PR-E should split the Sprint 5 section to mirror the closed reality. If you prefer minimal scope, see Step 1 alternative below.

- [ ] **Step 1 (canonical): Replace the monolithic Sprint 5 section with decomposed 5a/5b/5c/5d**

Find the line:

```markdown
## Sprint 5 — Public Launch Prep [☐ not-started] (38h)
```

Replace the entire `## Sprint 5 …` block (lines ~172–194 in current revision) up to but not including `## Sprint 6 — Burnout & MVP Launch` with:

```markdown
## Sprint 5 — Public Launch Prep [🟡 in-progress] (38h, decomposed in 4 sub-sprints)

**Goal:** Compliance LGPD público-facing, SEO, deploy hardening — tudo o que falta pra ir ao ar em prod.
**Estimativa:** semanas 8–9
**Depende de:** Sprint 4 (+ Sprint 4.5 login split)
**Decomposição (decidida durante execução de 5a):** 5a (LGPD), 5b (SEO), 5c (E2E), 5d (Vercel hardening). Soma das estimativas = 38h.

> **Footnote (rev 3):** Este sprint herdou o escopo original de "Sprint 4 — LGPD & Deployment" (38h). Foi renomeado e movido porque o Sprint 4 absorveu outro escopo durante execução. Decomposto em 4 sub-sprints durante 5a (1 PR por sub-sprint demonstrou inviável; granularidade real entregou).

### Sprint 5a — LGPD pública [✅ done] (~13h)

**Fechado:** 2026-04-16. Spec: [`2026-04-16-sprint-5a-lgpd-public-design.md`](../superpowers/specs/2026-04-16-sprint-5a-lgpd-public-design.md). Score 99/100.
- 26 migrations (lgpd_requests, consents, consent_texts v1+v2, 7 RPCs, storage bucket, FK ON DELETE SET NULL, audit_log skip-cascade guard)
- `@tn-figueiredo/lgpd@0.1.0` 6-adapter wiring (container + use-case glue)
- 9 API routes, 8 UI components, 6 account pages, consent-aware Sentry init
- Privacy + Terms MDX (pt-BR + en), `/privacy` + `/terms` routes
- pg_cron schedules via `cron_config` table (Supabase managed pattern)
- 4 feature flags (banner / delete / export / cron sweep)
- CI DB-integration job + vitest coverage for `lib/lgpd/**`

### Sprint 5b — SEO hardening [✅ done] (~14h)

**Fechado:** 2026-04-16. Spec: [`2026-04-16-sprint-5b-seo-hardening-design.md`](../superpowers/specs/2026-04-16-sprint-5b-seo-hardening-design.md). Score 98/100.

**5 PRs shipped:**
- **PR-A** — 3 migrations (`sites.identity_type`/`twitter_handle`/`seo_default_og_image`, `blog_translations.seo_extras` jsonb + CHECK, idempotent backfill)
- **PR-B** — `apps/web/lib/seo/` core (config, page-metadata, jsonld builders + graph + extras-schema + render, og template + render, noindex, enumerator, cache-invalidation, robots-config, frontmatter, identity-profiles), `app/sitemap.ts`, `app/robots.ts`, `app/og/blog/...`, `app/og/campaigns/...`, `app/og/[type]/...`, `apps/web/public/og-default.png`, `apps/web/public/identity/thiago.jpg`, middleware short-circuit for `/sitemap.xml`+`/robots.txt`, deps `gray-matter@4.0.3` + `schema-dts@1.1.5` + `@lhci/cli@0.13`
- **PR-C** — Wire 7 page archetypes via factory metadata + `<JsonLdScript>`, refactor `app/layout.tsx`, modify 11 server actions + 1 server component for cache-invalidation tags, add admin actions for branding/identity (`updateSiteBranding`, `updateSiteIdentity`, `updateSiteSeoDefaults`), `archivePost` revalidation bug fix
- **PR-D** — `.lighthouserc.yml` (SEO ≥95, perf ≥80 mobile), `.github/workflows/lighthouse.yml`, `scripts/seo-smoke.sh` (8 smoke checks), `.github/workflows/seo-post-deploy.yml`, schema-dts `expectTypeOf` test gate
- **PR-E** — `app/api/health/seo` CRON_SECRET-protected route, `docs/runbooks/seo-incident.md` (6 scenarios A–F), `docs/runbooks/sprint-5b-post-deploy.md` (12-step checklist)

**Feature flags shipped (5):** `NEXT_PUBLIC_SEO_JSONLD_ENABLED`, `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED`, `NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED`, `SEO_AI_CRAWLERS_BLOCKED`, `SEO_SITEMAP_KILLED`.

**Post-deploy verified (2026-04-16):**
- Smoke ✅ all 8 checks
- Rich Results ✅ on 1 blog + 1 campaign (BlogPosting/Article + BreadcrumbList + Person detected, 0 errors)
- Sitemap submitted to GSC + Bing Webmaster
- Sentry 24h: 0 errors with `seo:true` filter
- Lighthouse mobile prod: SEO 96, perf 82

### Sprint 5c — E2E suite [☐ not-started] (~8h)

Playwright covering auth + CMS critical paths. Pendente.

### Sprint 5d — Vercel deploy hardening [☐ not-started] (~3h)

Build perf, edge config, secrets review. Pendente.

```

- [ ] **Step 1-alt (minimal-touch fallback): Just flip Sprint 5 status if you want to defer the decomposition rewrite**

Replace `## Sprint 5 — Public Launch Prep [☐ not-started] (38h)` with `## Sprint 5 — Public Launch Prep [🟡 in-progress] (38h)`, change the 6 epic checkboxes for 5a/5b items from `[ ]` to `[x]`, append a `### Sprint 5b — SEO hardening [✅ done]` mini-section under the bullets. The canonical Step 1 is preferred.

- [ ] **Step 2: Verify markdown still renders**

```bash
grep -n "Sprint 5b" /Users/figueiredo/Workspace/bythiagofigueiredo/docs/roadmap/phase-1-mvp.md
# Expect: at least one match in the new ✅ done section
```

- [ ] **Step 3: Commit roadmap update**

```bash
git add docs/roadmap/phase-1-mvp.md
git commit -m "docs(roadmap): close sprint 5b — SEO hardening"
```

---

### Task 7: Roadmap README update

**Files:**
- Modify: `docs/roadmap/README.md`

- [ ] **Step 1: Add Sprint 5b to "Done até agora" list**

Find this block:

```markdown
**Done até agora:**
- Sprint 0 ✅ — scaffold + CI + Supabase provisionado/linkado + Vercel/Sentry env vars + npm scripts de DB padrão TNG (~12h).
```

After the Sprint 5a entry (the long bullet ending with `Prod DB on-schema; Vercel deploy pending via PR #24.`), add:

```markdown
- **Sprint 5b ✅ (2026-04-16)** — SEO hardening: 3 migrations (sites.identity_type/twitter_handle/seo_default_og_image, blog_translations.seo_extras jsonb), `apps/web/lib/seo/` wrapper over `@tn-figueiredo/seo@0.1.0` (config, page-metadata factories ×7, jsonld builders + @graph composition with schema-dts, dynamic OG via next/og + brand template, noindex/enumerator/cache-invalidation/robots-config), `app/sitemap.ts` + `app/robots.ts` + 3 OG route handlers, multi-domain ready (host-derived site context), 5 feature flags for granular rollback, Lighthouse CI gate (SEO ≥95, perf ≥80 mobile), `scripts/seo-smoke.sh` 8-check post-deploy gate, `app/api/health/seo` health endpoint, runbook with 6 incident scenarios. 5 PRs (~14h). Sitemap submitted to GSC + Bing. Spec: [2026-04-16-sprint-5b-seo-hardening-design.md](../superpowers/specs/2026-04-16-sprint-5b-seo-hardening-design.md).
```

- [ ] **Step 2: Update the status table at the top**

Find the visão macro table:

```markdown
| **1 — MVP** | 0–6 | ~242h | 10–11 | 🟡 in-progress (5/7 sprints ✅) | [phase-1-mvp.md](phase-1-mvp.md) |
```

Change the status badge to reflect 5a + 5b done (still 5c/5d/6 pending in Phase 1):

```markdown
| **1 — MVP** | 0–6 | ~242h | 10–11 | 🟡 in-progress (Sprints 0–4.5 + 5a + 5b ✅, 5c/5d/6 pending) | [phase-1-mvp.md](phase-1-mvp.md) |
```

- [ ] **Step 3: Update the progress bar block**

Find:

```markdown
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░  ~40% (184h / 464h — Sprints 0–4 ✅ + Sprint 4.5 ✅)
```

Replace with (184h + ~13h Sprint 5a + ~14h Sprint 5b = 211h):

```markdown
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░  ~46% (211h / 464h — Sprints 0–4.5 + 5a + 5b ✅)
```

And update the reconciliation prose in the next paragraph from `**184h delivered**` to `**211h delivered**`, and replace `Sprint 5 ("Public launch prep" — 38h) is now the next sprint.` with `Sprint 5 decomposed: 5a (LGPD ✅) + 5b (SEO ✅) + 5c (E2E, ~8h pending) + 5d (Vercel hardening, ~3h pending). Sprint 6 ("Burnout & MVP Launch" — 30h) follows.`.

- [ ] **Step 4: Update the changelog at bottom of README**

Add a new entry at the top of the Changelog section:

```markdown
- **2026-04-16 rev7:** Sprint 5b ✅ closed — SEO hardening live in prod (3 migrations, lib/seo wrapper, sitemap + robots + dynamic OG, JSON-LD @graph, Lighthouse + smoke CI gates, health endpoint, runbook, sitemap submitted to GSC + Bing). 211h / 464h delivered (~46%). Next: Sprint 5c (E2E, 8h) or Sprint 5d (Vercel hardening, 3h).
```

- [ ] **Step 5: Commit README updates**

```bash
git add docs/roadmap/README.md
git commit -m "docs(roadmap): add sprint 5b to done list, bump progress to 46%"
```

---

### Task 8: CLAUDE.md update — add Sprint 5b summary section

**Files:**
- Modify: `/Users/figueiredo/Workspace/bythiagofigueiredo/CLAUDE.md`

- [ ] **Step 1: Add Sprint 5b summary section mirroring Sprint 5a format**

After the existing `## LGPD compliance (Sprint 5a) — @tn-figueiredo/lgpd@0.1.0 wiring` section (ending with the `consent_texts versions:` bullet block), and before `## Multi-ring (CMS conglomerate) — Sprint 4.75 RBAC v3`, insert:

```markdown
## SEO hardening (Sprint 5b) — `lib/seo/` wrapper over `@tn-figueiredo/seo@0.1.0`

Sprint 5b implementa o stack SEO completo: indexability + discoverability + rich results + brand share previews + multi-domain ready, com Lighthouse CI gate e runbook operacional.

### Layer overview

`apps/web/lib/seo/` é o wrapper local sobre `@tn-figueiredo/seo@0.1.0` (que provê primitives `generateMetadata`/`buildSitemap`/`buildRobots`). Wrapper local resolve gaps:
- `alternates.languages` (hreflang per-route) — package só emite canonical
- Sitemap manual (não usa `buildSitemap`) — package faz blanket hreflang que quebra paths locale-prefixed
- `keywords/authors/publishedTime/modifiedTime` no Metadata
- Validação JSON-LD via `schema-dts@1.1.5` (Google-maintained types)

```
lib/seo/
├── config.ts                  getSiteSeoConfig() per-request, unstable_cache key=[siteId,host]
├── identity-profiles.ts       PROFILES Record<siteSlug, PersonProfile|OrgProfile> (committed JSON)
├── page-metadata.ts           7 factories — generateXxxMetadata por archetype
├── jsonld/
│   ├── builders.ts            buildPersonNode/OrgNode/WebSiteNode/BlogPostingNode/ArticleNode/BreadcrumbNode/FaqNode/HowToNode/VideoNode
│   ├── graph.ts               composeGraph({nodes}) → @graph + dedupeBy_id
│   ├── extras-schema.ts       SeoExtrasSchema (Zod) para FAQ/HowTo/Video frontmatter
│   ├── render.tsx             <JsonLdScript graph={...}/> com escapeJsonForScript
│   └── types.ts               schema-dts re-exports
├── og/
│   ├── template.tsx           BlogOgTemplate + CampaignOgTemplate + GenericOgTemplate
│   └── render.ts              generateOgImage({variant, params}) → ImageResponse
├── noindex.ts                 NOINDEX_PATTERNS + isPathIndexable + PROTECTED_DISALLOW_PATHS
├── enumerator.ts              enumerateSiteRoutes(siteId, config) — RLS-mirroring filters
├── cache-invalidation.ts      revalidateBlogPostSeo/CampaignSeo/SiteBranding
├── robots-config.ts           buildRobotsRules({config, host, aiCrawlersBlocked, protectedPaths})
└── frontmatter.ts             parseMdxFrontmatter wrap gray-matter@4.0.3
```

### Multi-domain pattern — direct host lookup, NÃO middleware-dependent

`app/sitemap.ts` e `app/robots.ts` fazem sua própria resolução `host → site` via `SupabaseRingContext.getSiteByDomain(host)` em vez de ler `headers().get('x-site-id')` do middleware. Razão: Next.js [discussion #58436](https://github.com/vercel/next.js/discussions/58436) confirma que middleware-injected headers NÃO são confiáveis em MetadataRoute handlers (mesmo com matcher cobrindo `.xml`/`.txt`). Duplica ~5 linhas de lógica mas é bulletproof.

`isPreviewOrDevHost(host)` short-circuita pra noindex (Disallow:/) em:
- `dev.bythiagofigueiredo.com`
- `*.vercel.app`
- `localhost*` / `dev.localhost`

Middleware (`apps/web/src/middleware.ts:122`) tem short-circuit pra `/sitemap.xml` + `/robots.txt` — pula o rewrite `dev.bythiagofigueiredo.com/x → /dev/x` pra essas rotas dinâmicas rodarem com host original.

### JSON-LD `@graph` composition

Cada página renderiza UM `<script type="application/ld+json">` contendo `{'@context':'https://schema.org', '@graph': [...nodes]}`. Nós linkam via `@id` (URLs como identifiers).

Por archetype:
- `app/(public)/layout.tsx` (root) → `WebSite` (com `potentialAction: SearchAction`) + (`Person` ou `Organization` per `identityType`)
- `/blog/[locale]/[slug]` → `BlogPosting` + `BreadcrumbList` + extras de `seo_extras` (`FAQPage`/`HowTo`/`VideoObject`)
- `/blog/[locale]` → `BreadcrumbList`
- `/campaigns/[locale]/[slug]` → `Article` + `BreadcrumbList`
- `/privacy`, `/terms` → `BreadcrumbList`
- `/contact` → `BreadcrumbList` + `ContactPage`

Layout root nodes aparecem em toda página; per-page nodes empilham; `composeGraph` deduplica por `@id` (priority: nó com mais keys vence, deterministic).

`<JsonLdScript>` SSR-safe via `escapeJsonForScript` (escapa `<`, `>`, `&`, U+2028, U+2029). Renderizado dentro de `<body>` (App Router não permite `<script>` custom em `<head>` via Metadata API). Googlebot lê do body sem problema.

Type safety: `expectTypeOf().toMatchTypeOf<BlogPosting>()` em vitest pega regression compile-time.

### OG image precedence chain

Per blog/campaign:
1. `seo_extras.og_image_url` (per-translation explicit override via frontmatter)
2. `cover_image_url` from `blog_translations` (existing column, surfaced em Sprint 5b)
3. Dynamic OG via `/og/blog/{locale}/{slug}` (gated por `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED=true`)
4. `sites.seo_default_og_image` (NEW column, site-wide static fallback)
5. `/og-default.png` (committed em `apps/web/public/`, last-resort)

OG routes: `app/og/blog/[locale]/[slug]/route.tsx`, `app/og/campaigns/[locale]/[slug]/route.tsx`, `app/og/[type]/route.tsx`. Cache `public, max-age=3600, s-maxage=86400, swr=604800`. Inter font subset latin-only ~35KB. Erro → redirect 302 pra `/og-default.png` + `Sentry.captureException` com `tags: { component: 'og-route', type: 'blog' }`.

### Identity profiles — committed JSON, NÃO em DB

`apps/web/lib/seo/identity-profiles.ts` exporta `IDENTITY_PROFILES: Record<siteSlug, PersonProfile|OrgProfile>` com `name/jobTitle/imageUrl/sameAs[]`. Edits triggam code review intencional — identity é security-grade (sameAs links impactam Google Knowledge Graph). Sprint 11 (CMS Hub) pode mover pra DB se non-dev editing virar need.

`apps/web/public/identity/thiago.jpg` (1:1 ratio, ≥400×400, JPEG <100KB) committed em PR-B.

### Cache invalidation — tag taxonomy

| Tag | Invalida | Set por |
|---|---|---|
| `seo-config` | `getSiteSeoConfig` (todos sites) | admin actions: `updateSiteBranding`, `updateSiteIdentity`, `updateSiteSeoDefaults` |
| `blog:post:${postId}` | per-post fetches (metadata + OG) | blog `savePost`/`publishPost`/`unpublishPost`/`archivePost`/`deletePost` |
| `og:blog:${postId}` | OG image route cache | mesmas blog actions |
| `campaign:${campaignId}` | per-campaign fetches | campaign save/publish/etc |
| `og:campaign:${campaignId}` | OG image route cache | mesmas campaign actions |
| `sitemap:${siteId}` | enumerator query | qualquer post/campaign mutation |

Helper canônico: `revalidateBlogPostSeo(siteId, postId, locale, slug)` em `lib/seo/cache-invalidation.ts`. **archivePost teve bug fix em PR-C** — antes só revalidava `/blog/${locale}` index, missing slug page.

### RLS-aware sitemap enumerator

`enumerateSiteRoutes(siteId, config)` consulta `blog_translations` + `campaign_translations` via service-role client mas aplica WHERE filters explicitos espelhando RLS public-read policies (`status='published'`, `published_at <= now()`, `published_at is not null`). DB-gated integration test cria draft + future-scheduled post + verifica que neither leaks. Static routes sempre incluídas: `/`, `/privacy`, `/terms`, `/contact`, `/blog/${defaultLocale}`. Ordenação: `lastModified DESC`.

### Frontmatter — `gray-matter@4.0.3`

`@tn-figueiredo/cms` `compileMdx` NÃO expõe frontmatter (verificado: retorna só `{compiledSource, toc, readingTimeMin}`). `lib/seo/frontmatter.ts` wrappa `gray-matter` (~30KB), valida `seo_extras` via `SeoExtrasSchema` (Zod), strip do conteúdo antes de `compileMdx`. Save action (`cms/(authed)/blog/[id]/edit/actions.ts`) chama `parseMdxFrontmatter(input.content_mdx)` antes de compilar, persiste `seo_extras` em `blog_translations.seo_extras` jsonb.

Sprint 6+: extrair `parseFrontmatter` upstream pra `@tn-figueiredo/cms@0.3.0` se segundo consumer aparecer.

### Schema migrations (3, 2026-04-16)

- `20260501000001_sites_seo_columns.sql` — `sites.identity_type` text NOT NULL DEFAULT 'person' check IN ('person','organization'); `sites.twitter_handle` text check ~ '^[A-Za-z0-9_]{1,15}$'; `sites.seo_default_og_image` text check ~ '^https://'
- `20260501000002_blog_translations_seo_extras.sql` — `blog_translations.seo_extras` jsonb + structural CHECK (object shape, faq array, howTo object, video object, og_image_url string)
- `20260501000003_seo_backfill.sql` (idempotent) — `update sites set twitter_handle='tnFigueiredo' where slug='bythiagofigueiredo'`; backfill `supported_locales=array['pt-BR','en']`

**Reuso:** `sites.supported_locales` já existia (Sprint 4.75 migration `…000020`), Sprint 5b consome — não duplica.

### Feature flags (5)

Granular rollback per-surface:

- `NEXT_PUBLIC_SEO_JSONLD_ENABLED` — `<JsonLdScript>` returns null quando `false` (default true)
- `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED` — pula step 3 da precedence chain (default true)
- `NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED` — drop FAQ/HowTo/Video nodes (default true)
- `SEO_AI_CRAWLERS_BLOCKED` — adiciona Disallow para GPTBot/CCBot/anthropic-ai/Google-Extended/PerplexityBot/ClaudeBot/Bytespider/Amazonbot (default false; decisão do usuário per spec Open Decisions #1)
- `SEO_SITEMAP_KILLED` — emergency `app/sitemap.ts` retorna `[]` (default false)

Configurar em `apps/web/.env.local` + Vercel Environment Variables. Estado inicial prod: 4 first true, AI blocker false, kill switch false. Ver `docs/runbooks/seo-incident.md` pra triggers de cada flag.

### CI quality gates

- `.lighthouserc.yml` (LHCI) — SEO ≥95 (error), perf ≥80 mobile (warn), `uses-rel-canonical: error`, `hreflang: error`, `structured-data: warn`. Roda em `.github/workflows/lighthouse.yml` em PRs tocando `apps/web/**`, espera Vercel preview, `lhci autorun`.
- `scripts/seo-smoke.sh $HOST` — 8 checks (sitemap valid XML, robots Sitemap line, robots disallow protected paths, JSON-LD `@graph` em blog post, OG content-type=image/png, hreflang alternates, dev subdomain `Disallow:/`, health endpoint `ok:true`).
- `.github/workflows/seo-post-deploy.yml` — manual dispatch após deploy verde, roda smoke contra prod.
- Vitest schema-dts `expectTypeOf` gate — pega schema regressions compile-time.

### Health endpoint + runbook

- `apps/web/src/app/api/health/seo/route.ts` — GET `Authorization: Bearer ${CRON_SECRET}` retorna `{ok, siteId, identityType, seoConfigCachedMs, sitemapBuildMs, sitemapRouteCount, schemaVersion: 'v1', flags: {jsonLd, dynamicOg, extendedSchemas, aiCrawlersBlocked, sitemapKilled}}`. 401 sem auth, 503 quando site não resolve.
- `docs/runbooks/seo-incident.md` — 6 scenarios (A: sitemap empty, B: OG broken, C: Rich Results fail, D: hreflang wrong, E: AI crawler spike, F: drafts leaked CRITICAL).
- `docs/runbooks/sprint-5b-post-deploy.md` — 12-step verification checklist.

### Sentry tag conventions (Sprint 5b)

Toda exceção SEO-layer taggeada com `seo: true` + `component`:
- `component: 'sitemap'`, `'robots'`, `'og-route'` (sub-tag `type: 'blog'|'campaign'|'generic'`), `'jsonld'`, `'seo-config'`

Filtro Sentry: `seo:true component:og-route last:24h`.

### Server actions modificadas em PR-C (12 sites)

`apps/web/src/app/cms/(authed)/blog/[id]/edit/actions.ts` (5 funções) + `apps/web/src/app/cms/(authed)/campaigns/{new,[id]/edit}/actions.ts` (5 funções) + `apps/web/src/app/cms/(authed)/blog/new/page.tsx` (1 server component) + admin actions novos em `apps/web/src/app/admin/(authed)/sites/actions.ts` (`updateSiteBranding`, `updateSiteIdentity`, `updateSiteSeoDefaults`). Cada site chama `revalidateBlogPostSeo`/`revalidateCampaignSeo`/`revalidateTag('seo-config')` conforme operação.
```

- [ ] **Step 2: Verify the section was added correctly**

```bash
grep -n "## SEO hardening (Sprint 5b)" /Users/figueiredo/Workspace/bythiagofigueiredo/CLAUDE.md
# Expect: one match
```

- [ ] **Step 3: Commit CLAUDE.md update**

```bash
git add CLAUDE.md
git commit -m "docs(claude): add sprint 5b SEO hardening summary section"
```

---

### Task 9: Final integration commit + push

**Files:** none new — final tag/push only.

- [ ] **Step 1: Run full test suite one last time**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm test
```

Expected: full suite green (no regressions from PR-E).

- [ ] **Step 2: Typecheck**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo && npm run typecheck -w apps/web
```

Expected: clean.

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feat/sprint-5b-pr-e-health-runbook
gh pr create --base main --title "feat(seo): PR-E — health endpoint + runbook + post-deploy (Sprint 5b)" --body "$(cat <<'EOF'
## Summary

Closes Sprint 5b (SEO hardening). 5th and final PR.

- `app/api/health/seo` — CRON_SECRET-protected GET, returns SEO stack health (siteId, identity type, sitemap route count, build timing, all 5 flag states). 401 without auth, 503 when host unresolved, 200 with shape.
- `docs/runbooks/seo-incident.md` — playbook for 6 incident scenarios (A sitemap empty, B OG broken, C Rich Results fail, D hreflang wrong, E AI crawler spike, F drafts leaked).
- `docs/runbooks/sprint-5b-post-deploy.md` — 12-step verification checklist with curl commands + GSC submission steps.
- Roadmap docs flipped to ✅ done; CLAUDE.md gains Sprint 5b summary section.

## Test plan

- [x] `apps/web/test/app/api/health-seo.test.ts` — 5/5 pass (401 no auth, 401 wrong auth, 503 site unresolved, 200 happy path, flag echo)
- [x] Full apps/web vitest suite green
- [x] Typecheck clean
- [ ] After merge + Vercel deploy: trigger `seo-post-deploy.yml` workflow against prod
- [ ] After smoke green: submit sitemap to GSC + Bing
- [ ] After 24h: verify Sentry has 0 errors with `seo:true` filter
EOF
)"
```

- [ ] **Step 4: After PR merged, kick off post-deploy verification**

Wait for Vercel production deploy (~3 min after merge).

```bash
# 1. Smoke workflow against prod
gh workflow run seo-post-deploy.yml --ref main -f host=https://bythiagofigueiredo.com
gh run list --workflow=seo-post-deploy.yml --limit 1

# 2. Health endpoint check
curl -sf -H "Authorization: Bearer $CRON_SECRET" https://bythiagofigueiredo.com/api/health/seo | jq

# 3. Manual: open Search Console, submit sitemap.xml
open "https://search.google.com/search-console"

# 4. Manual: open Bing Webmaster, submit sitemap.xml
open "https://www.bing.com/webmasters/"

# 5. Manual: Rich Results test on 1 blog + 1 campaign
open "https://search.google.com/test/rich-results"
```

- [ ] **Step 5: 24h follow-up — Sentry watch**

24 hours after deploy:

```bash
# Open Sentry, filter seo:true last:24h
open "https://sentry.io"
```

Confirm 0 unresolved issues. If any, open the matching scenario in `docs/runbooks/seo-incident.md`.

- [ ] **Step 6: Final memory entry (after Step 5 verified clean)**

Add a new entry to `~/.claude/projects/-Users-figueiredo-Workspace/memory/MEMORY.md`:

```markdown
- [Sprint 5b SEO closed](project_sprint5b_closed.md) — SEO hardening complete (3 migrations, lib/seo wrapper, sitemap+robots+dynamic OG, JSON-LD @graph with schema-dts, Lighthouse CI, health endpoint, runbook), prod verified 2026-04-17, sitemap submitted to GSC + Bing
```

And create `~/.claude/projects/-Users-figueiredo-Workspace/memory/project_sprint5b_closed.md` mirroring the `project_sprint5a_closed.md` format with PR list, score, deploy date, follow-ups (Sprint 5c E2E + 5d Vercel hardening still pending).

---

## Done criteria for PR-E

- ✅ Health endpoint live in prod, 5/5 tests passing
- ✅ Runbook covers all 5 feature flags + 6 incident scenarios
- ✅ Post-deploy checklist at `docs/runbooks/sprint-5b-post-deploy.md` with copy-pasteable commands
- ✅ Roadmap (`phase-1-mvp.md` + `README.md`) shows Sprint 5b ✅ done with deploy date
- ✅ CLAUDE.md has Sprint 5b summary section mirroring Sprint 5a structure
- ✅ Smoke workflow green against prod (8/8 checks)
- ✅ Sitemap submitted to GSC + Bing (manual UI)
- ✅ Rich Results test passed on 1 blog + 1 campaign URL
- ✅ Sentry 24h watch: 0 errors with `seo:true` filter
- ✅ Memory entry `project_sprint5b_closed.md` created

Sprint 5b CLOSED. Next: Sprint 5c (Playwright E2E, ~8h) or Sprint 5d (Vercel hardening, ~3h).

---

### Task E.10: Sprint 5b end-to-end acceptance verification

**Files:** none (pure verification gate; output documented in PR-E description).

After PRs A-E all merged + deployed to prod, run this single integrative checklist BEFORE closing the sprint. Goal: confirm the 5 PRs collectively satisfy every spec goal.

- [ ] **Step 1: Spec-goal traceability**

For each Goal in the spec (`docs/superpowers/specs/2026-04-16-sprint-5b-seo-hardening-design.md` Goals section), verify with a curl or DevTools check:

```bash
HOST=https://bythiagofigueiredo.com

# G1: Indexability — every public page emits canonical + robots
for path in / /privacy /terms /contact /blog/pt-BR /blog/pt-BR/welcome; do
  echo "=== $path ==="
  curl -sf "$HOST$path" | grep -oE '<link rel="canonical"[^>]+>' | head -1
  curl -sf "$HOST$path" | grep -oE '<meta name="robots"[^>]+>' | head -1
done

# G2: Discoverability — sitemap enumerates blog + campaigns + static
curl -sf $HOST/sitemap.xml | xmllint --xpath 'count(//*[local-name()="url"])' -

# G3: Rich results — JSON-LD @graph on every blog post
curl -sf $HOST/blog/pt-BR/welcome | grep -oE 'application/ld\+json' | wc -l
curl -sf $HOST/blog/pt-BR/welcome | grep -c '"@graph"'

# G4: Brand share previews — OG image returns PNG 1200x630
OG=$(curl -sf $HOST/blog/pt-BR/welcome | grep -oE 'og:image"[^>]*content="[^"]+"' | head -1 | sed 's/.*content="//;s/"//')
curl -sfI "$OG" | grep -i content-type   # image/png expected

# G5: Multi-domain ready — sitemap honors host
curl -sf $HOST/sitemap.xml | head -3
curl -sf https://dev.bythiagofigueiredo.com/sitemap.xml   # expect empty <urlset>

# G6: Quality gate — Lighthouse CI passing on last 3 PRs
gh run list --workflow=lighthouse.yml --limit=3 --json conclusion,headBranch

# G7: Operability — health endpoint + flag check + smoke
curl -sf -H "Authorization: Bearer $CRON_SECRET" $HOST/api/health/seo | jq
gh workflow run seo-post-deploy.yml -f host=$HOST -f skip_health=false
```

- [ ] **Step 2: Feature flag matrix verification**

Test each rollback flag individually in a Vercel preview (NOT prod):

| Flag | Action | Verify |
|---|---|---|
| `NEXT_PUBLIC_SEO_JSONLD_ENABLED=false` | redeploy | view-source: no `<script type="application/ld+json">` |
| `NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED=false` | redeploy | `/og/blog/...` returns 302 → `/og-default.png` |
| `NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED=false` | redeploy | post with `seo_extras.faq` shows BlogPosting but no FAQPage |
| `SEO_AI_CRAWLERS_BLOCKED=true` | redeploy | robots.txt has `User-agent: GPTBot\nDisallow: /` |
| `SEO_SITEMAP_KILLED=true` | redeploy | `/sitemap.xml` returns empty `<urlset>` |

After verification, set all flags back to defaults in prod. Document the flag matrix in `docs/runbooks/seo-incident.md` (PR-E Task 4-9 already did this).

- [ ] **Step 3: External validators**

- [ ] Google Rich Results Test on 1 blog post → BlogPosting + BreadcrumbList + Person valid (no errors, no warnings worth fixing)
- [ ] Google Rich Results Test on 1 campaign → Article + BreadcrumbList valid
- [ ] Schema.org Validator (https://validator.schema.org) on 1 blog post → 0 errors
- [ ] LinkedIn Post Inspector → OG preview correct
- [ ] WhatsApp link share (manual) → OG preview correct
- [ ] Slack link unfurl (manual) → OG preview correct

- [ ] **Step 4: Sentry 24h watch**

```bash
# After 24h post-deploy, query Sentry for errors with SEO tags:
# Filter: tags["component"] in ("og-route","sitemap","robots","jsonld","seo-host-resolve","seo-enumerator")
# Expected: 0 unresolved errors. If any, open the matching scenario in seo-incident.md.
```

- [ ] **Step 5: Spec-goal sign-off matrix**

In the PR-E description (or a separate "Sprint 5b closure" GitHub issue), check off each spec Goal:

```markdown
- [x] G1: Indexability — verified Step 1
- [x] G2: Discoverability — sitemap enumerates N URLs
- [x] G3: Rich results — JSON-LD validated by Google + schema.org
- [x] G4: Brand share previews — OG validated by LI/WA/Slack
- [x] G5: Multi-domain ready — preview/dev short-circuit verified
- [x] G6: Quality gate — Lighthouse SEO ≥95 last 3 PRs
- [x] G7: Operability — flag matrix tested, 0 Sentry errors 24h
```

- [ ] **Step 6: Mark sprint closed**

After all 5 spec goals signed off + memory entry created (Task E covered), mark Sprint 5b ✅ in `docs/roadmap/phase-1-mvp.md` and `docs/roadmap/README.md` with deploy date.

---

## Self-Review

**Spec coverage:**

| Spec section | Plan task(s) |
|---|---|
| Schema changes (3 migrations) | A.2 / A.3 / A.4 |
| Sites backfill | A.4 |
| Frontmatter parsing (gray-matter) | B.1 (dep) + B.6 (wrapper) + C (wire into savePost) |
| `@tn-figueiredo/seo` wrapper | B.13 (factories) |
| Multi-domain sitemap.ts | B.24 |
| Multi-domain robots.ts | B.25 |
| Middleware short-circuit | B.21 |
| JSON-LD @graph composition | B.9 |
| schema-dts compile-time gate | D.7 |
| OG image precedence chain | B.8 (builders) + B.13 (factories) |
| OG route handlers | B.19 / B.20 |
| OG template (variant B) | B.17 |
| OG font + fallback PNG | B.22 |
| Person.imageUrl asset | B.23 |
| Identity profiles | B.3 |
| Cache invalidation strategy | B.15 + C (actions wire) |
| RLS-mirroring enumerator | B.14 |
| Noindex matrix | B.4 |
| Zod seo_extras | B.5 |
| Site-level SEO config | B.12 |
| 7 page metadata factories | B.13 + C (page wiring) |
| Lighthouse CI desktop + mobile | D.2 / D.3 |
| Post-deploy smoke script | D.4 |
| Post-deploy workflow (manual) | D.5 |
| CI seo-smoke PR job | D.6 |
| Health endpoint | E (PR-E Task 1–3) |
| Runbook seo-incident | E (PR-E Task 4–9) |
| Post-deploy checklist | E (PR-E Task 10) |
| Roadmap + CLAUDE.md updates | E (PR-E Task 11–13) |
| GSC + Bing sitemap submission | E (PR-E Task 14) |
| Rich Results validation | E (PR-E Task 15) |
| Feature flag rollback playbook | E (Runbook) |
| CI `check-migration-applied` | B.26 |
| AI crawler stance (env flag) | B.16 |
| Preview/dev noindex | B.11 + B.24 + B.25 |

**Placeholder scan:** No "TBD", "TODO", "fill in", "appropriate error handling" strings remain in the plan. Every step that changes code shows the exact code or diff.

**Type consistency:**
- `SiteSeoConfig` defined once in B.12, consumed in B.8 / B.13 / B.14 / B.19 / B.20 / B.24 / B.25.
- `JsonLdNode` / `JsonLdGraph` defined in B.7, consumed in B.8 / B.9 / B.10.
- `SeoExtras` defined in B.5, consumed in B.6 / B.8 / B.13.
- `PersonProfile` / `OrgProfile` defined in B.3, consumed in B.8 / B.12 / B.13.
- `SitemapRouteEntry` defined in B.14, consumed in B.24.
- Function names: `getSiteSeoConfig` (B.12 → used in B.13, B.14, B.19, B.20, B.24, B.25, E).
- `revalidateBlogPostSeo` (B.15 → called in C's action refactor tasks).
- `resolveSiteByHost` (B.11 → used in B.14, B.19, B.20, B.24, B.25, E).

**Scope check:** Plan is one integrated feature (SEO hardening). 5 PRs are sequential deploy units, not independent subsystems — appropriately bundled in a single plan doc.

---

## Execution Handoff

**Plan complete and saved to** `docs/superpowers/plans/2026-04-16-sprint-5b-seo-hardening.md`**. Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch fresh subagent per task, review between tasks, fast iteration via `superpowers:subagent-driven-development`.

2. **Inline Execution** — execute tasks in current session via `superpowers:executing-plans`, batch with checkpoints.

Pre-flight blockers before any execution:
- User confirms Twitter handle (`@thiagonfigueiredo`)
- User supplies `apps/web/public/identity/thiago.jpg` (or approves `.gitkeep` placeholder with Person.imageUrl 404-tolerance)
- User decides AI crawler stance (default permit)
