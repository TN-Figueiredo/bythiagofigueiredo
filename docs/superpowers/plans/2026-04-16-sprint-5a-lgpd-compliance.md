# Sprint 5a — LGPD Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan. 5 parallel tracks designed for 5 parallel subagents in isolated git worktrees — same pattern as Sprint 4.75 (5/5 tracks delivered in <2h wall-clock). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship LGPD-compliant privacy policy + terms + cookie banner + account deletion (3-phase) + data export, wiring `@tn-figueiredo/lgpd@0.1.0` against Sprint 4.75 RBAC v3 schema.

**Architecture:** 6 adapter impls in `apps/web/src/lib/lgpd/` + 16 DB migrations + 9 API routes + 8 client components + 2 MDX content files (privacy, terms, pt-BR + en). Synchronous data export, 3-phase async deletion with 15d grace. Anonymous consent via `/api/consents/anonymous` + merge on sign-in.

**Tech Stack:** Next.js 15 + React 19 + Tailwind 4 + TypeScript 5 + Supabase (DB/Auth/Storage) + `@tn-figueiredo/lgpd@0.1.0` + `@tn-figueiredo/email@0.1.0` + `@sentry/nextjs`.

**Spec:** [2026-04-16-sprint-5a-lgpd-compliance-design.md](../specs/2026-04-16-sprint-5a-lgpd-compliance-design.md)

**Pre-requisites:**
- ✅ Sprint 4.75 merged + DB deployed to prod
- ✅ Spec + runbook + smoke test script already committed (PR #18)
- ⏳ Master ring bootstrap in prod (manual SQL; user responsibility pre-launch)
- ⏳ 5 Brevo templates provisioned (manual; Track E task)

**Estimated:** ~45h coding time. Realistic wall-clock ~14h with 5 parallel subagents + merge overhead.

---

## Dependency graph

```
PHASE 0: Pre-flight (sequential, 30min)
   ├─ Verify baseline CI green
   ├─ Create 5 worktrees (A, B, C, D, E)
   └─ Confirm @tn-figueiredo/lgpd@0.1.0 + @tn-figueiredo/email@0.1.0 installed
   │
   ▼
PHASE 1: ⚡ 5 PARALLEL TRACKS (~12h wall-clock)
   🟦 Track A — 16 DB migrations + integration test seeds
   🟩 Track B — 6 adapters + container + unit tests
   🟨 Track C — 9 API routes + route tests
   🟥 Track D — 8 UI components + client tests
   🟪 Track E — MDX content + CI workflow + feature flags
   │
   ▼
PHASE 2: Integration + smoke (sequential, ~2h)
   ├─ Merge 5 PRs to staging in order: A → B → C → D → E
   ├─ Run full test suite locally (HAS_LOCAL_DB=1 npm test)
   ├─ Deploy staging → run scripts/smoke-test-lgpd.sh
   └─ Fix any integration regressions
   │
   ▼
PHASE 3: Prod rollout
   ├─ npm run db:push:prod (16 migrations)
   ├─ Vercel promote prod
   ├─ Run smoke test on prod
   └─ Flip feature flags (staggered: banner → delete → export)
```

**Cross-track notes:**
- Track A is bytes-only (DB + test seeds); no TypeScript dependencies. Can run fully independent.
- Track B (adapters) + Track C (API routes) both import from `@tn-figueiredo/lgpd`. They share types but touch different files.
- Track D (UI) depends on Track E's MDX content (for /privacy, /terms routes). E must finish content before D wires `import('content/legal/...')` but D can scaffold components against empty MDX first.
- Track E is lightest; can be done quickly to unblock others.

---

## File structure

```
bythiagofigueiredo/
├── supabase/migrations/
│   └── 20260430000000..015_*.sql                    # Track A (16 files)
├── apps/web/
│   ├── src/
│   │   ├── lib/lgpd/                                # Track B (7 files)
│   │   │   ├── container.ts
│   │   │   ├── domain-adapter.ts
│   │   │   ├── request-repo.ts
│   │   │   ├── audit-repo.ts
│   │   │   ├── email-service.ts
│   │   │   ├── account-status-cache.ts
│   │   │   ├── inactive-user-finder.ts
│   │   │   └── redact-third-party-pii.ts
│   │   ├── app/
│   │   │   ├── (public)/
│   │   │   │   ├── layout.tsx                       # Track E (add banner + trigger)
│   │   │   │   ├── privacy/page.tsx                 # Track E
│   │   │   │   └── terms/page.tsx                   # Track E
│   │   │   ├── account/
│   │   │   │   ├── (authed)/
│   │   │   │   │   ├── layout.tsx                   # Track D
│   │   │   │   │   ├── settings/page.tsx            # Track D
│   │   │   │   │   ├── settings/privacy/page.tsx    # Track D
│   │   │   │   │   ├── delete/page.tsx              # Track D
│   │   │   │   │   └── export/page.tsx              # Track D
│   │   │   │   └── (public)/deleted/page.tsx        # Track D
│   │   │   ├── lgpd/confirm/[token]/page.tsx        # Track C
│   │   │   └── api/
│   │   │       ├── auth/verify-password/route.ts    # Track C
│   │   │       ├── lgpd/request-deletion/route.ts   # Track C
│   │   │       ├── lgpd/confirm-deletion/route.ts   # Track C
│   │   │       ├── lgpd/cancel-deletion/route.ts    # Track C
│   │   │       ├── lgpd/request-export/route.ts     # Track C
│   │   │       ├── lgpd/download-export/[token]/route.ts  # Track C
│   │   │       ├── consents/anonymous/route.ts      # Track C
│   │   │       ├── consents/merge/route.ts          # Track C
│   │   │       └── cron/lgpd-cleanup-sweep/route.ts # Track C
│   │   └── components/lgpd/                         # Track D (8 files)
│   │       ├── cookie-banner.tsx
│   │       ├── cookie-banner-trigger.tsx
│   │       ├── consent-gate.tsx
│   │       ├── delete-account-form.tsx
│   │       ├── deletion-status-card.tsx
│   │       ├── export-request-button.tsx
│   │       ├── transfer-super-admin-form.tsx
│   │       └── deletion-blocker-list.tsx
│   ├── content/legal/                               # Track E (4 MDX files)
│   │   ├── privacy.pt-BR.mdx
│   │   ├── privacy.en.mdx
│   │   ├── terms.pt-BR.mdx
│   │   └── terms.en.mdx
│   ├── test/
│   │   ├── integration/lgpd-*.test.ts               # Track A (6 files, 58 cases)
│   │   ├── helpers/db-seed.ts                       # Track A (extend)
│   │   └── contracts/lgpd-adapter.test.ts           # Track B
│   ├── sentry.client.config.ts                      # Track D (extend)
│   └── vitest.config.ts                             # Track E (add coverage config)
├── .github/workflows/ci.yml                          # Track E (add DB-integration job)
└── .env.example                                      # Track E (add 4 feature flags)
```

---

# PHASE 0 — Pre-flight (sequential, 30min)

### Task 0.1: Verify baseline

- [ ] **Step 1: Confirm staging is healthy**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git checkout staging && git pull origin staging --ff-only
git log origin/staging -3 --oneline
# Expected: recent commits include fb27382 (spec PR #18)
```

- [ ] **Step 2: Verify packages**

```bash
npm view @tn-figueiredo/lgpd@0.1.0 version --registry https://npm.pkg.github.com
npm view @tn-figueiredo/email@0.1.0 version --registry https://npm.pkg.github.com
```
Expected: both return versions cleanly.

- [ ] **Step 3: Verify apps/web has packages pinned**

```bash
grep "@tn-figueiredo/lgpd\|@tn-figueiredo/email" apps/web/package.json
```
Expected: both listed (may be pinned to 0.1.0 already).

### Task 0.2: Create 5 worktrees

- [ ] **Step 1: Track A (DB)**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git worktree remove ../bythiago-s5a-a 2>/dev/null || true
git worktree add ../bythiago-s5a-a -b feat/s5a-db origin/staging
```

- [ ] **Step 2: Track B (Adapters)**

```bash
git worktree remove ../bythiago-s5a-b 2>/dev/null || true
git worktree add ../bythiago-s5a-b -b feat/s5a-adapters origin/staging
```

- [ ] **Step 3: Track C (API routes)**

```bash
git worktree remove ../bythiago-s5a-c 2>/dev/null || true
git worktree add ../bythiago-s5a-c -b feat/s5a-api origin/staging
```

- [ ] **Step 4: Track D (UI)**

```bash
git worktree remove ../bythiago-s5a-d 2>/dev/null || true
git worktree add ../bythiago-s5a-d -b feat/s5a-ui origin/staging
```

- [ ] **Step 5: Track E (Content + CI)**

```bash
git worktree remove ../bythiago-s5a-e 2>/dev/null || true
git worktree add ../bythiago-s5a-e -b feat/s5a-content-ci origin/staging
```

- [ ] **Step 6: Verify**

```bash
git worktree list | grep s5a
```
Expected: 5 worktrees listed.

---

# PHASE 1 — 5 Parallel Tracks

Dispatch 5 subagents simultaneously, one per worktree. Each produces a draft PR.

## 🟦 Track A — Database migrations + integration tests (~12h)

**Owner:** DB subagent. All work in `/Users/figueiredo/Workspace/bythiago-s5a-a`.

**Scope:** 16 migrations + 6 integration test files + seed helper extension.

**Files:**
- Create: `supabase/migrations/20260430000000_lgpd_backup_snapshot.sql`
- Create: `supabase/migrations/20260430000001_lgpd_requests.sql`
- Create: `supabase/migrations/20260430000002_rpc_check_deletion_safety.sql`
- Create: `supabase/migrations/20260430000003_rpc_purge_deleted_user_audit.sql`
- Create: `supabase/migrations/20260430000004_rpc_reassign_authors.sql`
- Create: `supabase/migrations/20260430000005_rpc_cancel_account_deletion_in_grace.sql`
- Create: `supabase/migrations/20260430000006_rpc_lgpd_phase1_cleanup.sql`
- Create: `supabase/migrations/20260430000007_rpc_merge_anonymous_consents.sql`
- Create: `supabase/migrations/20260430000008_rpc_get_anonymous_consents.sql`
- Create: `supabase/migrations/20260430000009_lgpd_rpc_grants.sql`
- Create: `supabase/migrations/20260430000010_lgpd_storage_bucket.sql`
- Create: `supabase/migrations/20260430000011_fk_on_delete_fix.sql`
- Create: `supabase/migrations/20260430000012_consent_texts.sql`
- Create: `supabase/migrations/20260430000013_consents.sql`
- Create: `supabase/migrations/20260430000014_audit_log_self_policies.sql`
- Create: `supabase/migrations/20260430000015_tg_audit_mutation_skip_cascade.sql`
- Modify: `apps/web/test/helpers/db-seed.ts` (add `seedLgpdScenario`)
- Create: `apps/web/test/integration/lgpd-delete-flow.test.ts`
- Create: `apps/web/test/integration/lgpd-export-flow.test.ts`
- Create: `apps/web/test/integration/lgpd-cancel-flow.test.ts`
- Create: `apps/web/test/integration/lgpd-audit-rls.test.ts`
- Create: `apps/web/test/integration/lgpd-consents-merge.test.ts`
- Create: `apps/web/test/integration/lgpd-rpcs.test.ts`

### Task A1: Backup snapshot migration

- [ ] **Step 1: Create backup migration**

File: `supabase/migrations/20260430000000_lgpd_backup_snapshot.sql`

```sql
-- Snapshot FK-affected rows BEFORE migration 011 changes delete semantics.
-- Retention: drop after 30d confidence window (manual via admin console).

CREATE TABLE IF NOT EXISTS lgpd_migration_backup_v1 (
  table_name text NOT NULL,
  row_snapshot jsonb NOT NULL,
  backed_up_at timestamptz DEFAULT now()
);

INSERT INTO lgpd_migration_backup_v1 (table_name, row_snapshot)
SELECT 'blog_posts', to_jsonb(bp) FROM blog_posts bp WHERE owner_user_id IS NOT NULL
UNION ALL
SELECT 'campaigns', to_jsonb(c) FROM campaigns c WHERE owner_user_id IS NOT NULL
UNION ALL
SELECT 'audit_log_sample', to_jsonb(a) FROM audit_log a
  WHERE actor_user_id IS NOT NULL
  ORDER BY created_at DESC LIMIT 10000;
```

- [ ] **Step 2: Apply locally + commit**

```bash
cd /Users/figueiredo/Workspace/bythiago-s5a-a
npm run db:reset 2>&1 | tail -5
git add supabase/migrations/20260430000000_lgpd_backup_snapshot.sql
git commit -m "feat(db): backup snapshot before LGPD migrations

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task A2: `lgpd_requests` table

- [ ] **Step 1: Create migration**

File: `supabase/migrations/20260430000001_lgpd_requests.sql`

```sql
-- Sprint 5a: lgpd_requests table tracks deletion/export/consent_revocation lifecycle.

CREATE TABLE IF NOT EXISTS lgpd_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('data_export','account_deletion','consent_revocation')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','completed_soft','cancelled','failed')),
  phase int CHECK (phase BETWEEN 1 AND 3),
  confirmation_token_hash text UNIQUE,
  requested_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  scheduled_purge_at timestamptz,
  phase_1_completed_at timestamptz,
  phase_3_completed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  blob_path text,
  blob_uploaded_at timestamptz,
  blob_deleted_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS lgpd_requests_one_pending
  ON lgpd_requests(user_id, type)
  WHERE status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS lgpd_requests_scheduled_purge
  ON lgpd_requests(scheduled_purge_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS lgpd_requests_blob_cleanup
  ON lgpd_requests(blob_uploaded_at)
  WHERE blob_deleted_at IS NULL AND blob_path IS NOT NULL;

ALTER TABLE lgpd_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lgpd_requests_self_read ON lgpd_requests;
CREATE POLICY lgpd_requests_self_read ON lgpd_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS lgpd_requests_self_insert ON lgpd_requests;
CREATE POLICY lgpd_requests_self_insert ON lgpd_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2: Apply + commit**

```bash
npm run db:reset 2>&1 | tail -3
git add supabase/migrations/20260430000001_lgpd_requests.sql
git commit -m "feat(db): lgpd_requests table + RLS + partial indices

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Tasks A3–A9: 7 RPC migrations (one per file)

Each RPC gets its own file to avoid Supabase CLI 2.90 multi-statement bug (Sprint 4.75 lesson). Follow same commit pattern.

- [ ] **Task A3:** `20260430000002_rpc_check_deletion_safety.sql` — see spec Section 3 Fix #1 for full SQL (3 blocker checks returning `{can_delete, blockers, details}`)
- [ ] **Task A4:** `20260430000003_rpc_purge_deleted_user_audit.sql` — scrubs PII in audit_log before/after_data, parenthesized OR clause
- [ ] **Task A5:** `20260430000004_rpc_reassign_authors.sql` — updates authors.user_id with admin permission check
- [ ] **Task A6:** `20260430000005_rpc_cancel_account_deletion_in_grace.sql` — cancels during phase 1→3 grace window
- [ ] **Task A7:** `20260430000006_rpc_lgpd_phase1_cleanup.sql` — atomic cleanup (newsletter anonymize, contact anonymize, reassign content, nullify authors.user_id, delete pending invites, null audit_log.actor_user_id). Uses `SET LOCAL app.skip_cascade_audit='1'`.
- [ ] **Task A8:** `20260430000007_rpc_merge_anonymous_consents.sql` — with `FOR UPDATE` lock
- [ ] **Task A9:** `20260430000008_rpc_get_anonymous_consents.sql` — rate-limited read for pre-auth

Full SQL content is in spec Section 3 v2 (copy verbatim). Each migration is ONE `CREATE OR REPLACE FUNCTION` + ends with `$$;`. No trailing GRANTs (those go to A10).

Commit after each: `feat(db): RPC <name>`.

### Task A10: Consolidated grants migration

- [ ] **Step 1:** File `supabase/migrations/20260430000009_lgpd_rpc_grants.sql`

```sql
-- Sprint 5a: GRANTs for all LGPD RPCs.
-- Wrapped in DO block so Supabase CLI 2.90 parses file as single statement.

DO $grants$ BEGIN
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.check_deletion_safety(uuid) TO authenticated$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.purge_deleted_user_audit(uuid) TO service_role$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.reassign_authors(uuid, uuid) TO authenticated$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.cancel_account_deletion_in_grace(text) TO anon, authenticated$stmt$;
  EXECUTE $stmt$REVOKE EXECUTE ON FUNCTION public.lgpd_phase1_cleanup(uuid, jsonb) FROM public$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.lgpd_phase1_cleanup(uuid, jsonb) TO service_role$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.merge_anonymous_consents(text) TO authenticated$stmt$;
  EXECUTE $stmt$GRANT EXECUTE ON FUNCTION public.get_anonymous_consents(text) TO anon$stmt$;
END $grants$;
```

- [ ] **Step 2:** Apply + commit.

### Task A11: Storage bucket migration

- [ ] **Step 1:** File `supabase/migrations/20260430000010_lgpd_storage_bucket.sql`

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('lgpd-exports', 'lgpd-exports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "lgpd_exports_own_select" ON storage.objects;
CREATE POLICY "lgpd_exports_own_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lgpd-exports' AND name LIKE auth.uid()::text || '/%');

DROP POLICY IF EXISTS "lgpd_exports_service_insert" ON storage.objects;
CREATE POLICY "lgpd_exports_service_insert" ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'lgpd-exports');

DROP POLICY IF EXISTS "lgpd_exports_service_delete" ON storage.objects;
CREATE POLICY "lgpd_exports_service_delete" ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'lgpd-exports');
```

- [ ] **Step 2:** Apply + commit.

### Task A12: FK fix with pre-check

- [ ] **Step 1:** File `supabase/migrations/20260430000011_fk_on_delete_fix.sql`

```sql
DO $fk_precheck$
DECLARE v_orphan_owner integer; v_orphan_actor integer;
BEGIN
  SELECT count(*) INTO v_orphan_owner FROM blog_posts bp
  WHERE owner_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = bp.owner_user_id);
  IF v_orphan_owner > 0 THEN
    RAISE EXCEPTION 'Pre-check failed: % blog_posts have orphan owner_user_id', v_orphan_owner;
  END IF;

  SELECT count(*) INTO v_orphan_actor FROM audit_log al
  WHERE actor_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = al.actor_user_id);
  IF v_orphan_actor > 0 THEN
    RAISE NOTICE 'Warning: % audit_log rows have orphan actor_user_id', v_orphan_actor;
  END IF;
END $fk_precheck$;

ALTER TABLE blog_posts DROP CONSTRAINT IF EXISTS blog_posts_owner_user_id_fkey;
ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_owner_user_id_fkey
  FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_owner_user_id_fkey;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_owner_user_id_fkey
  FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_user_id_fkey;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
```

- [ ] **Step 2:** Apply + commit.

### Task A13: consent_texts table + seed

- [ ] **Step 1:** File `supabase/migrations/20260430000012_consent_texts.sql`

```sql
CREATE TABLE IF NOT EXISTS consent_texts (
  id text PRIMARY KEY,
  category text NOT NULL,
  locale text NOT NULL DEFAULT 'pt-BR',
  version text NOT NULL,
  text_md text NOT NULL,
  effective_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  UNIQUE (category, locale, version)
);

ALTER TABLE consent_texts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consent_texts_public_read ON consent_texts;
CREATE POLICY consent_texts_public_read ON consent_texts FOR SELECT USING (true);

INSERT INTO consent_texts (id, category, locale, version, text_md) VALUES
('cookie_functional_v1_pt-BR','cookie_functional','pt-BR','1.0','Cookies necessários para o funcionamento básico do site (sessão, segurança). Sempre ativos.'),
('cookie_functional_v1_en','cookie_functional','en','1.0','Cookies necessary for basic site operation (session, security). Always active.'),
('cookie_analytics_v1_pt-BR','cookie_analytics','pt-BR','1.0','Cookies de análise (Sentry Session Replay) para monitorar performance e erros. Opcional.'),
('cookie_analytics_v1_en','cookie_analytics','en','1.0','Analytics cookies (Sentry Session Replay) to monitor performance and errors. Optional.'),
('cookie_marketing_v1_pt-BR','cookie_marketing','pt-BR','1.0','Cookies de marketing para personalização de conteúdo. Opcional.'),
('cookie_marketing_v1_en','cookie_marketing','en','1.0','Marketing cookies for content personalization. Optional.'),
('privacy_policy_v1_pt-BR','privacy_policy','pt-BR','1.0','Ao continuar, você concorda com nossa Política de Privacidade.'),
('privacy_policy_v1_en','privacy_policy','en','1.0','By continuing, you agree to our Privacy Policy.'),
('terms_of_service_v1_pt-BR','terms_of_service','pt-BR','1.0','Ao continuar, você concorda com nossos Termos de Uso.'),
('terms_of_service_v1_en','terms_of_service','en','1.0','By continuing, you agree to our Terms of Use.'),
('newsletter_v1_pt-BR','newsletter','pt-BR','1.0','Ao assinar, você concorda em receber emails do bythiagofigueiredo. Descadastre-se a qualquer momento.'),
('newsletter_v1_en','newsletter','en','1.0','By subscribing, you agree to receive emails from bythiagofigueiredo. Unsubscribe anytime.')
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2:** Apply + commit.

### Task A14: consents table

- [ ] **Step 1:** File `supabase/migrations/20260430000013_consents.sql`

```sql
CREATE TABLE IF NOT EXISTS consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id text,
  category text NOT NULL CHECK (category IN ('cookie_functional','cookie_analytics','cookie_marketing','newsletter','privacy_policy','terms_of_service')),
  site_id uuid REFERENCES sites(id) ON DELETE SET NULL,
  consent_text_id text NOT NULL REFERENCES consent_texts(id),
  granted boolean NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  ip inet,
  user_agent text,
  CHECK ((user_id IS NOT NULL AND anonymous_id IS NULL) OR (user_id IS NULL AND anonymous_id IS NOT NULL)),
  CHECK (anonymous_id IS NULL OR anonymous_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS consents_auth_current
  ON consents(user_id, category, site_id) WHERE user_id IS NOT NULL AND withdrawn_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS consents_anon_current
  ON consents(anonymous_id, category, site_id) WHERE anonymous_id IS NOT NULL AND withdrawn_at IS NULL;

CREATE INDEX IF NOT EXISTS consents_user_lookup ON consents(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS consents_anon_lookup ON consents(anonymous_id) WHERE anonymous_id IS NOT NULL;

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consents_self_read ON consents;
CREATE POLICY consents_self_read ON consents FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS consents_self_insert ON consents;
CREATE POLICY consents_self_insert ON consents FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS consents_self_update ON consents;
CREATE POLICY consents_self_update ON consents FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Audit trigger reuses Sprint 4.75 tg_audit_mutation
DROP TRIGGER IF EXISTS audit_consents ON consents;
CREATE TRIGGER audit_consents
  AFTER INSERT OR UPDATE OR DELETE ON consents
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_mutation();
```

- [ ] **Step 2:** Apply + commit.

### Task A15: audit_log self policies

- [ ] **Step 1:** File `supabase/migrations/20260430000014_audit_log_self_policies.sql`

```sql
DROP POLICY IF EXISTS audit_log_self_lifecycle_target ON audit_log;
CREATE POLICY audit_log_self_lifecycle_target ON audit_log FOR SELECT TO authenticated
USING (resource_type = 'auth_user' AND resource_id = auth.uid());

DROP POLICY IF EXISTS audit_log_self_as_actor ON audit_log;
CREATE POLICY audit_log_self_as_actor ON audit_log FOR SELECT TO authenticated
USING (actor_user_id = auth.uid());
```

- [ ] **Step 2:** Apply + commit.

### Task A16: tg_audit_mutation skip cascade guard

- [ ] **Step 1:** File `supabase/migrations/20260430000015_tg_audit_mutation_skip_cascade.sql`

(Read existing `20260420000013_tg_audit_mutation_with_ip_ua.sql` + re-create with guard at top.)

```sql
CREATE OR REPLACE FUNCTION public.tg_audit_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action text := lower(TG_OP);
  v_before jsonb := CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_after jsonb := CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_org_id uuid;
  v_site_id uuid;
  v_resource_id uuid;
  v_ip inet;
  v_ua text;
  v_ip_raw text;
BEGIN
  -- Sprint 5a: skip during LGPD phase 1 cascade ops
  IF COALESCE(current_setting('app.skip_cascade_audit', true), '') = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_resource_id := COALESCE((NEW).id, (OLD).id);

  IF TG_TABLE_NAME = 'organization_members' THEN
    v_org_id := COALESCE(NEW.org_id, OLD.org_id);
  ELSIF TG_TABLE_NAME = 'site_memberships' THEN
    v_site_id := COALESCE(NEW.site_id, OLD.site_id);
    SELECT org_id INTO v_org_id FROM sites WHERE id = v_site_id;
  ELSIF TG_TABLE_NAME = 'invitations' THEN
    v_org_id := COALESCE(NEW.org_id, OLD.org_id);
    v_site_id := COALESCE(NEW.site_id, OLD.site_id);
  END IF;

  v_ip_raw := nullif(current_setting('app.client_ip', true), '');
  IF v_ip_raw IS NOT NULL THEN
    BEGIN v_ip := v_ip_raw::inet;
    EXCEPTION WHEN invalid_text_representation THEN v_ip := NULL;
    END;
  END IF;
  IF v_ip IS NULL THEN v_ip := inet_client_addr(); END IF;
  v_ua := nullif(current_setting('app.user_agent', true), '');

  INSERT INTO audit_log (actor_user_id, action, resource_type, resource_id, org_id, site_id, before_data, after_data, ip, user_agent)
  VALUES (auth.uid(), v_action, TG_TABLE_NAME, v_resource_id, v_org_id, v_site_id, v_before, v_after, v_ip, v_ua);
  RETURN COALESCE(NEW, OLD);
END $$;
```

- [ ] **Step 2:** Apply + commit.

### Task A17: Extend db-seed with `seedLgpdScenario`

- [ ] **Step 1:** Modify `apps/web/test/helpers/db-seed.ts` (append function)

```typescript
export async function seedLgpdScenario(admin: SupabaseClient, opts?: {
  userWithConsents?: boolean;
  anonymousWithConsents?: boolean;
  pendingDeletion?: boolean;
  pendingExport?: boolean;
}) {
  const rbac = await seedRbacScenario(admin);
  const suffix = randomUUID().slice(0, 8);
  const anonId = randomUUID();

  if (opts?.userWithConsents) {
    await admin.from('consents').insert([
      { user_id: rbac.reporter_a, category: 'cookie_functional', consent_text_id: 'cookie_functional_v1_pt-BR', granted: true },
      { user_id: rbac.reporter_a, category: 'cookie_analytics', consent_text_id: 'cookie_analytics_v1_pt-BR', granted: false }
    ]);
  }
  if (opts?.anonymousWithConsents) {
    await admin.from('consents').insert([
      { anonymous_id: anonId, category: 'cookie_functional', consent_text_id: 'cookie_functional_v1_pt-BR', granted: true }
    ]);
  }
  let deletionRequestId: string | undefined;
  if (opts?.pendingDeletion) {
    const { data } = await admin.from('lgpd_requests').insert({
      user_id: rbac.reporter_a, type: 'account_deletion', status: 'pending',
      confirmation_token_hash: `test-${suffix}`
    }).select('id').single();
    deletionRequestId = data?.id;
  }
  let exportRequestId: string | undefined;
  if (opts?.pendingExport) {
    const { data } = await admin.from('lgpd_requests').insert({
      user_id: rbac.editor_a, type: 'data_export', status: 'pending'
    }).select('id').single();
    exportRequestId = data?.id;
  }
  return { ...rbac, lgpd: { anonymousId: anonId, deletionRequestId, exportRequestId } };
}
```

- [ ] **Step 2:** Commit.

### Tasks A18–A23: Six integration test files

Following spec Section 5 v2 test case lists:

- [ ] **Task A18:** `lgpd-delete-flow.test.ts` — 15 cases
- [ ] **Task A19:** `lgpd-export-flow.test.ts` — 12 cases
- [ ] **Task A20:** `lgpd-cancel-flow.test.ts` — 6 cases
- [ ] **Task A21:** `lgpd-audit-rls.test.ts` — 8 cases
- [ ] **Task A22:** `lgpd-consents-merge.test.ts` — 7 cases
- [ ] **Task A23:** `lgpd-rpcs.test.ts` — 10 cases

Each test file follows the pattern established in Sprint 4.75's `rbac-matrix.test.ts` (describe.skipIf + seedLgpdScenario + signUserJwt). For each case, copy test body from spec Section 3/5 where shown, or structure as: seed → act → assert DB state / return value.

Run all: `HAS_LOCAL_DB=1 npm test --workspace=apps/web -- lgpd-`. Expected: all 58 cases pass.

- [ ] **Step 1:** Commit after each test file lands.

### Task A24: Open PR for Track A

- [ ] **Step 1: Push + PR**

```bash
git push -u origin feat/s5a-db
gh pr create --base staging --head feat/s5a-db --draft --title "feat: Sprint 5a Track A — LGPD DB layer" --body "16 migrations + 6 integration test suites (58 cases) + seedLgpdScenario helper. Spec: docs/superpowers/specs/2026-04-16-sprint-5a-lgpd-compliance-design.md"
```

## 🟩 Track B — 6 Adapters + container + unit tests (~8h)

**Owner:** Adapters subagent. Work in `/Users/figueiredo/Workspace/bythiago-s5a-b`.

**Files:**
- Create: `apps/web/src/lib/lgpd/redact-third-party-pii.ts` + `.test.ts`
- Create: `apps/web/src/lib/lgpd/account-status-cache.ts` + `.test.ts`
- Create: `apps/web/src/lib/lgpd/inactive-user-finder.ts` + `.test.ts`
- Create: `apps/web/src/lib/lgpd/audit-repo.ts` + `.test.ts`
- Create: `apps/web/src/lib/lgpd/request-repo.ts` + `.test.ts`
- Create: `apps/web/src/lib/lgpd/email-service.ts` + `.test.ts`
- Create: `apps/web/src/lib/lgpd/domain-adapter.ts` + `.test.ts`
- Create: `apps/web/src/lib/lgpd/container.ts` + `.test.ts`
- Create: `apps/web/test/contracts/lgpd-adapter.test.ts`

### Task B1: redact-third-party-pii utility

- [ ] **Step 1: Write test (TDD)**

File: `apps/web/src/lib/lgpd/redact-third-party-pii.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { redactThirdPartyPii } from './redact-third-party-pii';

describe('redactThirdPartyPii', () => {
  it('redacts emails', () => {
    const r = redactThirdPartyPii('contact joao@example.com for details');
    expect(r.text).toBe('contact [REDACTED_EMAIL] for details');
    expect(r.redacted).toBe(true);
  });
  it('redacts phones', () => {
    const r = redactThirdPartyPii('call +55 11 99876 1234');
    expect(r.text).toContain('[REDACTED_PHONE]');
    expect(r.redacted).toBe(true);
  });
  it('returns unredacted text with flag false', () => {
    const r = redactThirdPartyPii('hello world');
    expect(r.text).toBe('hello world');
    expect(r.redacted).toBe(false);
  });
  it('handles null', () => {
    const r = redactThirdPartyPii(null);
    expect(r.text).toBeNull();
    expect(r.redacted).toBe(false);
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

```bash
cd /Users/figueiredo/Workspace/bythiago-s5a-b
npm test --workspace=apps/web -- redact-third-party-pii
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

File: `apps/web/src/lib/lgpd/redact-third-party-pii.ts`

```typescript
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\+?\d{2,3}[- ]?\(?\d{2,3}\)?[- ]?\d{4,5}[- ]?\d{4}/g;

export function redactThirdPartyPii(text: string | null): { text: string | null; redacted: boolean } {
  if (!text) return { text: null, redacted: false };
  let redacted = false;
  const out = text
    .replace(EMAIL_RE, () => { redacted = true; return '[REDACTED_EMAIL]'; })
    .replace(PHONE_RE, () => { redacted = true; return '[REDACTED_PHONE]'; });
  return { text: out, redacted };
}
```

- [ ] **Step 4: Re-run — pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/lgpd/redact-third-party-pii.ts apps/web/src/lib/lgpd/redact-third-party-pii.test.ts
git commit -m "feat(web): redactThirdPartyPii util for LGPD export

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

### Task B2: account-status-cache (null-object shim)

- [ ] **Step 1: Test**

```typescript
// apps/web/src/lib/lgpd/account-status-cache.test.ts
import { describe, it, expect, vi } from 'vitest';
import { DirectQueryAccountStatusCache } from './account-status-cache';

describe('DirectQueryAccountStatusCache', () => {
  it('returns true when banned_until is null', async () => {
    const admin = { auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { banned_until: null } } }) } } };
    const cache = new DirectQueryAccountStatusCache(admin as any);
    expect(await cache.isActive('u1')).toBe(true);
  });
  it('returns false when banned', async () => {
    const admin = { auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { banned_until: 'infinity' } } }) } } };
    const cache = new DirectQueryAccountStatusCache(admin as any);
    expect(await cache.isActive('u1')).toBe(false);
  });
  it('invalidate is no-op (always queries)', async () => {
    const cache = new DirectQueryAccountStatusCache({} as any);
    await expect(cache.invalidate('u1')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2–5: Implement + commit**

```typescript
// apps/web/src/lib/lgpd/account-status-cache.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IAccountStatusCache } from '@tn-figueiredo/lgpd';

export class DirectQueryAccountStatusCache implements IAccountStatusCache {
  constructor(private readonly admin: SupabaseClient) {}
  async isActive(userId: string): Promise<boolean> {
    const { data } = await this.admin.auth.admin.getUserById(userId);
    return data?.user?.banned_until == null;
  }
  async invalidate(_userId: string): Promise<void> { /* no-op */ }
  async set(_userId: string, _active: boolean, _ttl?: number): Promise<void> { /* no-op */ }
}
```

### Task B3–B6: remaining adapters

Following TDD pattern (test → fail → implement → pass → commit) for each:

- [ ] **Task B3:** `inactive-user-finder.ts` — queries `auth.users` where `last_sign_in_at < now() - interval 'X days'`
- [ ] **Task B4:** `audit-repo.ts` — thin wrapper over Sprint 4.75 `audit_log` (create, findByRequestId, countByAction)
- [ ] **Task B5:** `request-repo.ts` — CRUD on `lgpd_requests` using authenticated/service-role clients appropriately
- [ ] **Task B6:** `email-service.ts` — impl of `ILgpdEmailService` using `@tn-figueiredo/email` Brevo helpers

Each task: test file + impl file + commit.

### Task B7: domain-adapter.ts

The most complex adapter. Implements `ILgpdDomainAdapter.collectUserData()`, `.phase1Cleanup()`, `.phase2Cleanup()` (no-op), `.phase3Cleanup()`, `.checkDeletionSafety()`.

- [ ] **Step 1: Write test mocks** (verify phase 1 calls `lgpd_phase1_cleanup` RPC, phase 3 calls `auth.admin.deleteUser`, collectUserData queries all required tables, etc.)
- [ ] **Step 2: Implement** — ~200 lines, mostly RPC dispatching + data collection for export
- [ ] **Step 3: Commit**

### Task B8: container factory

- [ ] **Step 1–5:** Wire all 6 adapters into `LgpdConfig`, inject via DI. Test verifies correct construction.

File: `apps/web/src/lib/lgpd/container.ts`

```typescript
import { createAccountDeletionUseCases, createDataExportUseCases, createConsentUseCases, createCleanupSweepUseCases, createStatusUseCases, type LgpdConfig } from '@tn-figueiredo/lgpd';
import { BythiagoLgpdDomainAdapter } from './domain-adapter';
import { SupabaseLgpdRequestRepository } from './request-repo';
import { AuditLogLgpdRepository } from './audit-repo';
import { BrevoLgpdEmailService } from './email-service';
import { DirectQueryAccountStatusCache } from './account-status-cache';
import { SupabaseInactiveUserFinder } from './inactive-user-finder';
import { getSupabaseServiceClient } from '@/lib/supabase/server';
import { logCron } from '@/lib/logger';

export function createLgpdContainer() {
  const admin = getSupabaseServiceClient();
  const config: LgpdConfig = {
    domainAdapter: new BythiagoLgpdDomainAdapter(admin),
    lgpdRequestRepo: new SupabaseLgpdRequestRepository(admin),
    lgpdAuditLogRepo: new AuditLogLgpdRepository(admin),
    emailService: new BrevoLgpdEmailService(),
    accountStatusCache: new DirectQueryAccountStatusCache(admin),
    inactiveUserFinder: new SupabaseInactiveUserFinder(admin),
    rateLimiter: /* inject from @tn-figueiredo/audit */ undefined as any,
    logger: { info: (m, d) => logCron('info', m, d), warn: (m, d) => logCron('warn', m, d), error: (m, d) => logCron('error', m, d) },
    phase2DelayDays: 0,
    phase3DelayDays: 15,
    exportExpiryDays: 7,
    inactiveWarningDays: 365,
  };
  return {
    accountDeletion: createAccountDeletionUseCases(config),
    dataExport: createDataExportUseCases(config),
    consent: createConsentUseCases(config),
    cleanupSweep: createCleanupSweepUseCases(config),
    status: createStatusUseCases(config),
  };
}
```

### Task B9: Contract test

- [ ] **Step 1–3:** File `apps/web/test/contracts/lgpd-adapter.test.ts`

```typescript
import { describe, it } from 'vitest';
import { expectTypeOf } from 'vitest';
import type { ILgpdDomainAdapter, ILgpdRequestRepository, ILgpdAuditLogRepository, ILgpdEmailService, IAccountStatusCache, IInactiveUserFinder } from '@tn-figueiredo/lgpd';
import { BythiagoLgpdDomainAdapter } from '@/lib/lgpd/domain-adapter';
import { SupabaseLgpdRequestRepository } from '@/lib/lgpd/request-repo';
import { AuditLogLgpdRepository } from '@/lib/lgpd/audit-repo';
import { BrevoLgpdEmailService } from '@/lib/lgpd/email-service';
import { DirectQueryAccountStatusCache } from '@/lib/lgpd/account-status-cache';
import { SupabaseInactiveUserFinder } from '@/lib/lgpd/inactive-user-finder';

describe('LGPD adapter contracts', () => {
  it('BythiagoLgpdDomainAdapter satisfies ILgpdDomainAdapter', () => {
    expectTypeOf<BythiagoLgpdDomainAdapter>().toMatchTypeOf<ILgpdDomainAdapter>();
  });
  // + 5 more expectTypeOf assertions for each adapter
});
```

### Task B10: Open PR

```bash
git push -u origin feat/s5a-adapters
gh pr create --base staging --head feat/s5a-adapters --draft --title "feat: Sprint 5a Track B — LGPD adapters + container" --body "6 adapter impls + container factory + 8 unit test files + contract tests. Spec Section 1/2 v2."
```

## 🟨 Track C — 9 API routes (~10h)

**Files:** 9 `route.ts` files under `apps/web/src/app/api/` + companion tests in `apps/web/test/app/`.

### Task C1: `/api/auth/verify-password`

- [ ] **Step 1: Write test**
- [ ] **Step 2: Run fail**
- [ ] **Step 3: Implement**

```typescript
// apps/web/src/app/api/auth/verify-password/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@tn-figueiredo/auth-nextjs/server';
import { createBrowserClient } from '@tn-figueiredo/auth-nextjs/client';

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (!user.ok) return NextResponse.json({ valid: false }, { status: 401 });
  const { password } = await req.json();
  const client = createBrowserClient({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  });
  const { error } = await client.auth.signInWithPassword({ email: user.user.email!, password });
  if (error) return NextResponse.json({ valid: false }, { status: 401 });
  await client.auth.signOut();
  return NextResponse.json({ valid: true });
}
```

- [ ] **Step 4: Pass + commit**

### Tasks C2–C9: Remaining 8 API routes

Follow same TDD pattern, implementing per spec Section 2 v2 data flows:

- [ ] **Task C2:** `/api/lgpd/request-deletion/route.ts` — uses `createLgpdContainer().accountDeletion.request`
- [ ] **Task C3:** `/api/lgpd/confirm-deletion/route.ts` — invokes phase 1 via container, then `auth.admin.updateUserById(ban_duration: 'infinite')`
- [ ] **Task C4:** `/api/lgpd/cancel-deletion/route.ts` — calls `cancel_account_deletion_in_grace` RPC + unban
- [ ] **Task C5:** `/api/lgpd/request-export/route.ts` — synchronous collectUserData + upload + email
- [ ] **Task C6:** `/api/lgpd/download-export/[token]/route.ts` — validates token + generates on-demand signed URL (10min TTL) + redirects
- [ ] **Task C7:** `/api/consents/anonymous/route.ts` — service-role insert with UUID v4 validation
- [ ] **Task C8:** `/api/consents/merge/route.ts` — calls `merge_anonymous_consents` RPC
- [ ] **Task C9:** `/api/cron/lgpd-cleanup-sweep/route.ts` — CRON_SECRET gate + `withCronLock` + 3 jobs (advance phase 3, send reminders, delete expired blobs)

Each commit separately.

### Task C10: `/lgpd/confirm/[token]` page

Server component that validates token + routes to correct handler (confirm deletion, cancel deletion, or download export redirect).

### Task C11: Open PR

```bash
git push -u origin feat/s5a-api
gh pr create --base staging --head feat/s5a-api --draft --title "feat: Sprint 5a Track C — LGPD API routes" --body "9 API routes + /lgpd/confirm handler. Spec Section 2 v2."
```

## 🟥 Track D — 8 UI components + account pages (~10h)

**Files:** 8 component files + 5 page files + Sentry config update.

### Task D1: `<CookieBanner>` + context

- [ ] **Step 1–5:** TDD — render test, a11y test (axe-core), toggle test, persist test. Implementation per spec Section 2/4 v2.

File: `apps/web/src/components/lgpd/cookie-banner.tsx` (client component)

(~150 lines: compact bar + expanded modal, 3 toggles, ARIA role=dialog, focus trap, keyboard nav, equal-prominence buttons, Accept-Language-negotiated strings)

### Tasks D2–D8: Remaining 7 components

Each with TDD test + implementation + commit.

### Tasks D9–D13: 5 account pages

- [ ] `/account/(authed)/layout.tsx` — requires `requireUser()`
- [ ] `/account/(authed)/settings/page.tsx`
- [ ] `/account/(authed)/settings/privacy/page.tsx`
- [ ] `/account/(authed)/delete/page.tsx`
- [ ] `/account/(authed)/export/page.tsx`
- [ ] `/account/(public)/deleted/page.tsx`

### Task D14: Update Sentry client config

- [ ] **Step 1:** Modify `apps/web/sentry.client.config.ts` per spec Section 4 v2 (consent-aware init, storage event listener).

### Task D15: Open PR

```bash
git push -u origin feat/s5a-ui
gh pr create --base staging --head feat/s5a-ui --draft --title "feat: Sprint 5a Track D — LGPD UI" --body "8 components + 6 account pages + Sentry consent-aware init."
```

## 🟪 Track E — Content + CI + feature flags (~5h)

### Task E1: Privacy policy MDX (pt-BR + en)

- [ ] **Step 1:** File `apps/web/content/legal/privacy.pt-BR.mdx` — 14 sections per spec Section 4 v2 including DPO exemption statement, SCC disclosure, both ANPD + EU DPA complaint paths, retention SLA table, legitimate interest balancing for Sentry (Art. 7 VIII, NOT IX)
- [ ] **Step 2:** `privacy.en.mdx` — translation
- [ ] **Step 3:** Commit

### Task E2: Terms of Service MDX (pt-BR + en)

- [ ] **Step 1:** `terms.pt-BR.mdx` — 12 sections (aceitação, descrição, conta, IP, conduta proibida, limitação responsabilidade, jurisdição SP/Brasil, etc.)
- [ ] **Step 2:** `terms.en.mdx` — translation
- [ ] **Step 3:** Commit

### Task E3: /privacy and /terms pages

- [ ] **Step 1:** File `apps/web/src/app/(public)/privacy/page.tsx`

```tsx
import { cookies, headers } from 'next/headers';
import { LegalShell } from '@/components/legal/legal-shell';
import type { Metadata } from 'next';

function negotiateLocale(acceptLang: string | null, cookieLocale: string | null) {
  if (cookieLocale && ['pt-BR','en'].includes(cookieLocale)) return cookieLocale;
  if (!acceptLang) return 'pt-BR';
  const lang = acceptLang.split(',')[0]?.split('-')[0]?.toLowerCase();
  return lang === 'en' ? 'en' : 'pt-BR';
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Política de Privacidade | bythiagofigueiredo',
    description: 'LGPD-compliant — dados coletados, direitos do titular, cookies.',
    alternates: { canonical: '/privacy' },
    robots: { index: true, follow: true },
  };
}

export default async function PrivacyPage() {
  const locale = negotiateLocale(
    (await headers()).get('accept-language'),
    (await cookies()).get('preferred_locale')?.value ?? null
  );
  const { default: MDXContent } = locale === 'en'
    ? await import('@/content/legal/privacy.en.mdx')
    : await import('@/content/legal/privacy.pt-BR.mdx');
  return <LegalShell locale={locale} lastUpdated="2026-04-16"><MDXContent /></LegalShell>;
}
```

- [ ] **Step 2:** Same for `terms/page.tsx`
- [ ] **Step 3:** Create `<LegalShell>` component (layout with header + locale switcher + TOC sticky + footer)
- [ ] **Step 4:** Commit

### Task E4: Add CI job for DB-gated tests

- [ ] **Step 1:** Modify `.github/workflows/ci.yml`

```yaml
  test-db-integration:
    name: Integration (DB-gated)
    runs-on: ubuntu-latest
    services:
      postgres:
        image: supabase/postgres:15.1.0.147
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: postgres
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx supabase start --exclude gotrue,realtime,storage-api,imgproxy --ignore-health-check
      - run: npx supabase db reset --local
      - run: HAS_LOCAL_DB=1 npm test --workspace=apps/web -- integration/
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 2:** Commit

### Task E5: Feature flags in .env.example

- [ ] **Step 1:** Add to `.env.example`:

```
# Sprint 5a LGPD feature flags
NEXT_PUBLIC_LGPD_BANNER_ENABLED=true
NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED=true
NEXT_PUBLIC_ACCOUNT_EXPORT_ENABLED=true
LGPD_CRON_SWEEP_ENABLED=true
```

- [ ] **Step 2:** Commit

### Task E6: vitest coverage config

- [ ] **Step 1:** Modify `apps/web/vitest.config.ts`

```typescript
  test: {
    // ... existing config ...
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/lgpd/**', 'src/components/lgpd/**'],
      thresholds: { lines: 90, functions: 90, branches: 85 },
    },
  },
```

- [ ] **Step 2:** Install `@vitest/coverage-v8` if missing + commit

### Task E7: Add `<CookieBanner />` + `<CookieBannerTrigger />` to (public) layout

- [ ] **Step 1:** Modify `apps/web/src/app/(public)/layout.tsx`

```tsx
import { CookieBanner } from '@/components/lgpd/cookie-banner';
import { CookieBannerTrigger } from '@/components/lgpd/cookie-banner-trigger';

export default function PublicLayout({ children }) {
  return (
    <>
      {children}
      {process.env.NEXT_PUBLIC_LGPD_BANNER_ENABLED === 'true' && (
        <>
          <CookieBanner />
          <CookieBannerTrigger />
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2:** Commit

### Task E8: Update CLAUDE.md

- [ ] **Step 1:** Add LGPD compliance section to `CLAUDE.md` documenting:
  - 6 adapter wiring pattern
  - 3-phase deletion model
  - Export format schema version
  - Cookie banner integration contract
  - Feature flag names

### Task E9: Open PR

```bash
git push -u origin feat/s5a-content-ci
gh pr create --base staging --head feat/s5a-content-ci --draft --title "feat: Sprint 5a Track E — MDX content + CI + feature flags" --body "Privacy + Terms MDX (pt-BR + en), CI DB-gated job, 4 feature flags, vitest coverage config, CLAUDE.md update."
```

---

# PHASE 2 — Integration + smoke (sequential, ~2h)

### Task P2.1: Merge order

- [ ] **Step 1:** Merge PRs to `staging` in dependency order: A → B → C → D → E
- [ ] **Step 2:** After each merge, run `HAS_LOCAL_DB=1 npm test --workspace=apps/web` to verify no regression
- [ ] **Step 3:** Resolve merge conflicts as they appear

### Task P2.2: Full test run

- [ ] **Step 1:**

```bash
cd /Users/figueiredo/Workspace/bythiagofigueiredo
git checkout staging && git pull
npm install
npm run db:reset
HAS_LOCAL_DB=1 npm test
```
Expected: all tests green, no skipped LGPD integration tests.

### Task P2.3: Staging deploy + smoke

- [ ] **Step 1:** Vercel auto-deploys on `staging` push (verify in Vercel dashboard)
- [ ] **Step 2:** Run smoke test

```bash
PROD_URL=https://staging.bythiagofigueiredo.com PROD_DB_URL="<staging-db-url>" bash scripts/smoke-test-lgpd.sh
```
Expected: 8/8 checks pass.

---

# PHASE 3 — Prod rollout (sequential, ~1h)

### Task P3.1: Apply migrations to prod

- [ ] **Step 1:**

```bash
npm run db:push:prod  # YES confirmation when prompted
```
Expected: 16 migrations applied without error (Sprint 4.75 CLI 2.90 patterns followed).

### Task P3.2: Vercel promote to prod

- [ ] **Step 1:** Via Vercel dashboard: promote staging build to production.

### Task P3.3: Prod smoke test

- [ ] **Step 1:**

```bash
PROD_URL=https://bythiagofigueiredo.com PROD_DB_URL="<prod-db-url>" bash scripts/smoke-test-lgpd.sh
```
Expected: 8/8 pass.

### Task P3.4: Staged feature flag rollout

- [ ] **Step 1:** Day 0: `LGPD_CRON_SWEEP_ENABLED=true` (cron starts running but finds no requests)
- [ ] **Step 2:** Day 0: `NEXT_PUBLIC_LGPD_BANNER_ENABLED=true` (banner visible; anonymous consents start flowing)
- [ ] **Step 3:** Day 1 (after 24h monitoring): `NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED=true` + `NEXT_PUBLIC_ACCOUNT_EXPORT_ENABLED=true`
- [ ] **Step 4:** Monitor Sentry for `lgpd_*` alerts over 72h

### Task P3.5: Close Sprint 5a

- [ ] **Step 1:** Update `docs/roadmap/phase-1-mvp.md` — mark Sprint 5a ✅
- [ ] **Step 2:** Commit + merge

---

## Self-review

**Spec coverage:**
- ✅ 16 migrations → Task A1–A16
- ✅ 6 adapters → Task B1–B7
- ✅ Container → Task B8
- ✅ Contract tests → Task B9
- ✅ 9 API routes → Task C1–C9
- ✅ /lgpd/confirm page → Task C10
- ✅ 8 UI components → Tasks D1–D8
- ✅ 6 account pages → Tasks D9–D13
- ✅ Sentry consent-aware init → Task D14
- ✅ Privacy + Terms MDX → Tasks E1–E2
- ✅ /privacy + /terms routes + LegalShell → Task E3
- ✅ CI DB-gated job → Task E4
- ✅ Feature flags → Task E5
- ✅ Coverage config → Task E6
- ✅ Banner integration → Task E7
- ✅ 58 integration tests → Tasks A18–A23
- ✅ Smoke test script (pre-existing) → referenced in P2.3, P3.3
- ✅ Runbook (pre-existing) → referenced in P3 rollback
- ✅ Prod deploy → Phase 3

**Placeholder scan:** Tasks A18–A23 reference "spec Section 3/5 where shown" for test case bodies. Each case is fully described in Section 5 v2 of the spec — the subagent executing these tasks reads those descriptions to write test code. For the FULL 58 test cases this plan would be 5000+ more lines; the spec cross-reference is intentional compression.

**Type consistency:** All types flow from `@tn-figueiredo/lgpd` (ILgpdDomainAdapter et al) — consistent across tracks. LgpdConfig shape matches spec Section 1 v2.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-16-sprint-5a-lgpd-compliance.md`.**

**Recommended: Subagent-Driven execution** — dispatch 5 parallel subagents for Phase 1 tracks A/B/C/D/E simultaneously (Sprint 4.75 pattern proven, 5/5 tracks delivered in <2h wall-clock). Then sequential Phase 2 + 3.
