# Sprint 5a — LGPD / Compliance Design (v2)

**Date:** 2026-04-16
**Status:** Approved (D1–D5 confirmed after 5 rounds of independent adversarial audits). Final score across security/UX/legal/integration/ops lenses: **~95/100** conditional on faithful implementation. Evolution of scores per section: S1 64→95, S2 59→95, S3 57→95, S4 47→95, S5 40→95.
**Target sub-sprint:** 5a (part of Sprint 5 "Public Launch Prep", decomposed into 5a LGPD / 5b SEO / 5c E2E / 5d Hardening). Blocks public launch for Brazilian users.
**Pre-conditions:** Sprint 4.75 deployed (RBAC v3 + multi-site + audit_log). Master ring bootstrapped.

## Motivation

Sprint 4.75 shipped RBAC v3 with 4 roles, site_memberships, and audit_log. The public launch is now blocked by LGPD/GDPR compliance: privacy policy + terms of service + cookie banner + data subject rights (access/portability/erasure). Without these, public beta in Brazil risks regulatory action and legal exposure.

The `@tn-figueiredo/lgpd@0.1.0` package already defines 6 adapter interfaces + 5 use cases (account-deletion, data-export, consent, cleanup-sweep, status). Sprint 4a also already shipped 3 LGPD retention RPCs (`unsubscribe_via_token` anonymization, `anonymize_contact_submission`, `purge_sent_emails` 90d cron).

Sprint 5a wires the adapter layer, adds user-facing routes + UI, and closes the compliance gap. Hybrid 3-phase deletion (soft-anonymize → D+15 grace → real `auth.admin.deleteUser` OR permanent soft-anonymize if FK-blocked) satisfies LGPD Art. 18 while preserving referential integrity under RBAC v3.

## Goals

- **Public-facing pages:** `/privacy` + `/terms` (pt-BR + en) with LGPD Art. 9 + GDPR Art. 13/14 required disclosures
- **Cookie banner:** LGPD-compliant (opt-in, granular: Functional/Analytics/Marketing), renders only on public routes, multi-tab sync, a11y-compliant, anonymous + authenticated consent tracking
- **Delete account flow:** 3-phase async with password re-auth, `checkDeletionSafety()` pre-check, 15-day grace period + cancel link, super_admin transfer guard
- **Data export flow:** LGPD Art. 18 V portability — full content (blog MDX + campaigns + consents + audit trail) + 3rd-party PII redaction + Supabase Storage signed URL (7d TTL)
- **Audit trail:** all phase transitions + consent changes logged via Sprint 4.75 `audit_log` + new RLS policies for user self-access
- **Operator tooling:** `/admin/lgpd-requests` dashboard + `/admin/consents-stats` + Sentry alerts + runbook + smoke test script

## Non-goals

- **MFA / 2FA for delete confirmation** — password re-auth is sufficient for MVP; MFA is Sprint 6+
- **Formal DPO appointment** — solo operator uses ANPD Resolução CD/ANPD 2/2022 small-business exemption; GDPR Art. 37 non-applicable
- **E2E Playwright tests** — deferred to Sprint 5c
- **Multi-language beyond pt-BR + en** — es/fr out of scope
- **Consent analytics dashboard with charts** — Sprint 5b+ polish
- **Automated ANPD letter processing** — manual via runbook

## Architecture

### Package wiring

`apps/web` implements **6 adapters** from `@tn-figueiredo/lgpd@0.1.0`:

1. **`BythiagoLgpdDomainAdapter implements ILgpdDomainAdapter`** — `collectUserData`, `phase1Cleanup`, `phase2Cleanup` (no-op), `phase3Cleanup`, `checkDeletionSafety`
2. **`SupabaseLgpdRequestRepository implements ILgpdRequestRepository`** — CRUD on new `lgpd_requests` table
3. **`AuditLogLgpdRepository implements ILgpdAuditLogRepository`** — reuses Sprint 4.75 `audit_log`
4. **`BrevoLgpdEmailService implements ILgpdEmailService`** — uses `@tn-figueiredo/email` + 5 Brevo templates
5. **`DirectQueryAccountStatusCache implements IAccountStatusCache`** — null-object shim calling `auth.admin.getUserById().banned_until`
6. **`SupabaseInactiveUserFinder implements IInactiveUserFinder`** — queries `auth.users` by `last_sign_in_at`

`lib/lgpd/container.ts` wires all 6 + `IRateLimiter` (from `@tn-figueiredo/audit`) + `ILogger` into `LgpdConfig`:
```typescript
{
  ...adapters,
  phase2DelayDays: 0,      // phase 2 no-op (hybrid C)
  phase3DelayDays: 15,     // hard delete at D+15 (≤ LGPD 45d)
  exportExpiryDays: 7,
  inactiveWarningDays: 365,
}
```

### DB schema additions (16 migrations)

**Backup migration (`20260430000000`):** `lgpd_migration_backup_v1` table snapshotting FK-affected rows before migration 011.

**Core tables (3 migrations):**
- `lgpd_requests` (001) — id, user_id, type (data_export/account_deletion/consent_revocation), status, phase, confirmation_token_hash, requested_at, confirmed_at, scheduled_purge_at, phase_1/3_completed_at, cancelled_at, completed_at, blob_path, blob_uploaded_at, blob_deleted_at, metadata jsonb
- `consent_texts` (012) — id PK text, category, locale, version, text_md, effective_at, superseded_at; UNIQUE (category, locale, version); public read RLS; seeded with pt-BR + en for 4 categories
- `consents` (013) — id, user_id (nullable), anonymous_id text (nullable), category, site_id, consent_text_id FK, granted bool, granted_at, withdrawn_at, ip, user_agent; XOR check user_id vs anonymous_id; UUID v4 format check on anonymous_id; partial unique indices for current state; ON DELETE SET NULL on site_id FK (preserve audit)

**7 RPCs (one per migration, 002–008):**
- `check_deletion_safety(p_user_id)` — returns `{can_delete, blockers[], details}`; blockers: master_ring_sole_admin, child_org_sole_admin, sole_editor_on_sites
- `purge_deleted_user_audit(p_user_id)` — nulls PII in audit_log before/after_data (keeps structure keys); parenthesized OR
- `reassign_authors(p_from, p_to)` — updates `authors.user_id`; admin permission check per-site
- `cancel_account_deletion_in_grace(p_token_hash)` — cancels during phase 1 → 3 grace window
- `lgpd_phase1_cleanup(p_user_id, p_pre_capture)` — atomic: anonymize newsletter_subs via pre-captured emails, anonymize contact_submissions, reassign content to master_admin, nullify authors.user_id, cancel pending invitations sent by user, null audit_log.actor_user_id, delete orphaned export blobs. Uses `SET LOCAL app.skip_cascade_audit='1'` to prevent cascade audit noise.
- `merge_anonymous_consents(p_anonymous_id)` — with `FOR UPDATE` lock for SERIALIZABLE safety against concurrent sign-ins
- `get_anonymous_consents(p_anonymous_id)` — rate-limited read for pre-auth users

**9th migration (009):** `DO $grants$` block with EXECUTE statements for all 7 GRANTs (single top-level statement, CLI 2.90-safe).

**Storage (010):** `lgpd-exports` private bucket + 3 RLS policies (SELECT for user's own folder via `name LIKE auth.uid()::text || '/%'`; INSERT/DELETE service-role only).

**FK fix (011):** Converts implicit-RESTRICT FKs to explicit ON DELETE SET NULL on `blog_posts.owner_user_id`, `campaigns.owner_user_id`, `audit_log.actor_user_id`. Includes DO block pre-check for invalid references.

**RLS additions (014):** 2 new policies on `audit_log`: `audit_log_self_lifecycle_target` (resource_type='auth_user' AND resource_id=auth.uid()) + `audit_log_self_as_actor` (actor_user_id=auth.uid()).

**Trigger guard (015):** CREATE OR REPLACE on Sprint 4.75's `tg_audit_mutation` adding `IF current_setting('app.skip_cascade_audit', true) = '1' THEN RETURN ...; END IF;` at top. Safe-closed default (unset = always audit).

### Route structure

**Public (Server Components, MDX):**
- `/privacy` — LGPD Art. 9 + GDPR Art. 13/14 content; locale-negotiated via Accept-Language + cookie
- `/terms` — standard TOS + jurisdição SP/Brasil

**User area (new `/account/(authed)/` route group with `requireUser()` guard):**
- `/account/(authed)/settings` — hub
- `/account/(authed)/settings/privacy` — manage cookies + view consent history + LGPD request history
- `/account/(authed)/delete` — deletion request (password re-auth + `checkDeletionSafety`)
- `/account/(authed)/export` — data export request + history
- `/account/(public)/deleted` — post-deletion goodbye page

**Callback (public, tokenized):**
- `/lgpd/confirm/[token]` — email link handler (confirm/cancel/download routes)

**API routes:**
- `POST /api/auth/verify-password` — password re-auth endpoint (signInWithPassword + immediate signOut; rate-limit 5/hr)
- `POST /api/lgpd/request-deletion` — creates `lgpd_request`, sends confirmation email
- `POST /api/lgpd/confirm-deletion` — token validation, runs `lgpd_phase1_cleanup` atomically
- `POST /api/lgpd/cancel-deletion` — `cancel_account_deletion_in_grace` RPC + unban + email
- `POST /api/lgpd/request-export` — rate-limited (1/30d), SYNCHRONOUS: collectUserData → Supabase Storage upload → email with signed URL
- `GET /api/lgpd/download-export/[token]` — validates token + expiry + redirects to signed URL (on-demand generation, 10min TTL)
- `POST /api/consents/anonymous` — service-role write for pre-auth consent (rate-limited per IP)
- `GET /api/consents/anonymous/lookup` — rate-limited read (via get_anonymous_consents RPC)
- `POST /api/consents/merge` — calls `merge_anonymous_consents` post sign-in
- `GET /api/cron/lgpd-cleanup-sweep` — CRON_SECRET gated + `withCronLock` (max 5min hold); advances phase 1→3, sends D+7/D+14 reminders, deletes expired blobs

### Components

**Client (apps/web/src/components/lgpd/):**
- `<CookieBanner>` — LGPD-compliant UI; 3 toggles (Functional ON-locked, Analytics OFF default, Marketing OFF default); equal prominence on accept/reject buttons (anti-dark-pattern); ARIA role="dialog" + keyboard/focus trap; Accept-Language-negotiated strings
- `<CookieBannerTrigger>` — footer "Gerenciar cookies" link (re-opens banner for anonymous revocation path — LGPD Art. 8 §5 compliance)
- `<ConsentGate>` — wrapper that renders children only if consent present (client-only, no SSR render); `window.addEventListener('storage', ...)` for multi-tab sync
- `<DeleteAccountForm>` — password re-auth + safety blocker display + confirmation
- `<DeletionStatusCard>` — pending deletion state + D+7/D+14 countdown + cancel CTA
- `<ExportRequestButton>` — trigger + status (pending/processing/ready/expired)
- `<TransferSuperAdminForm>` — dropdown of other org_admins (blocker UI)

**Server:**
- `<DeletionBlockerList>` — renders blockers from `checkDeletionSafety()` RPC

### Data flows

**Flow 1 — Deletion (10 steps):**
1. User → `/account/delete` → client calls `/api/auth/verify-password`
2. If valid: POST `/api/lgpd/request-deletion`
3. Server calls `checkDeletionSafety()` RPC → if blockers, UI shows `TransferSuperAdminForm`
4. If clear: INSERT `lgpd_request` with `confirmation_token_hash = sha256(raw_token)`
5. `BrevoLgpdEmailService.sendDeletionConfirmation(email, confirmUrl, expiresAt24h)`
6. UI: "check your email"
7. (≤24h) User clicks email → `/lgpd/confirm/[token]` → POST `/api/lgpd/confirm-deletion`
8. Server validates token, calls `lgpd_phase1_cleanup(user_id, pre_capture)` atomically (single tx, `SET LOCAL app.skip_cascade_audit='1'`)
9. App layer: `auth.admin.updateUserById(user_id, {ban_duration: 'infinite'})` + delete any pending export blobs
10. UPDATE `lgpd_requests`: status=processing, phase=1, scheduled_purge_at=now()+15d; email `deletion_confirmed` with cancel link + D+15 date; redirect to `/account/deleted`

**Flow 2 — Cancel during grace:**
User clicks cancel link in reminder email → POST `/api/lgpd/cancel-deletion` → `cancel_account_deletion_in_grace(token_hash)` → app unbans user via `auth.admin.updateUserById(ban_duration: null)` → UPDATE status=cancelled → email `deletion_cancelled` (app-layer template, not in ILgpdEmailService). **Caveat documented:** anonymized/reassigned content does NOT revert; cancellation undoes login only.

**Flow 3 — Data export (synchronous):**
1. POST `/api/lgpd/request-export`
2. Check: no pending deletion for this user; rate limit 1/30d
3. INSERT `lgpd_request(type=data_export, status=pending)`
4. SYNCHRONOUS: `collectUserData()` — full schema v1 including blog MDX, campaign bodies, consent_texts inlined, 3rd-party PII redacted via regex
5. Upload to `lgpd-exports/{user_id}/{request_id}.json`
6. UPDATE `metadata.blob_path`, `blob_uploaded_at`, `completed_at`
7. `BrevoLgpdEmailService.sendExportReady(email, downloadUrl, expiresAt7d)`
8. Response to user in 2-5s (Vercel serverless budget)

Cron `lgpd-cleanup-sweep` only handles: retry failed exports (max 3), delete expired blobs, send D+7/D+14 deletion reminders, execute phase 3 at scheduled_purge_at.

### Data export schema (v1)

Full JSON schema including `$schema` URI. Top-level fields: version, exported_at, user, organization_memberships, site_memberships, owned_content (blog_posts with full `translations[].content_mdx`, campaigns with `translations[]` + `submissions_received`), authored_as (with bio_md + avatar_url), newsletter_subscriptions (with email_used + consent_text), contact_submissions_sent (with message_redacted + redaction_applied flag), invitations_received, audit_log_as_actor (with ip + user_agent), lgpd_requests, consents (with inline consent_text).

3rd-party PII redaction via regex: `EMAIL_RE` + `PHONE_RE` replace matches with `[REDACTED_EMAIL]` / `[REDACTED_PHONE]`. Sets `redaction_applied: true` flag.

### Cookie banner + consent tracking

- Render only in `app/(public)/layout.tsx` (NOT in /admin, /cms, /account)
- Anonymous consent: `crypto.randomUUID()` stored in `localStorage.lgpd_anon_id` + POST to `/api/consents/anonymous` (service-role insert)
- Authenticated: consent tied to `user_id`
- On sign-in: `/api/consents/merge` calls `merge_anonymous_consents` RPC
- Consent expiry: 30d pre-auth, 1y post-auth (UX re-prompt)
- Consent re-prompt on privacy policy version bump: localStorage tracks `consent_text_version`; server emits `X-Lgpd-Consent-Fingerprint` header; mismatch triggers banner
- `<ConsentGate>` pattern for analytics scripts: never render server-side; client-only check of `localStorage.lgpd_consent_v1.analytics`
- Sentry: error tracking always (legítimo interesse LGPD Art. 7 VIII — NOT Art. 7 IX which doesn't exist); Replay + performance tracing gated by analytics consent

## Privacy Policy content (content/legal/privacy.pt-BR.mdx)

14 required sections including:
1. Identificação do controlador (Thiago, CPF if applicable, contact email `privacidade@bythiagofigueiredo.com`)
2. Dados coletados (exhaustive list per data surface)
3. Finalidade per category
4. Bases legais — LGPD Art. 7: II (consentimento), V (execução de contrato), VI (exercício regular de direitos), VIII (interesse legítimo for Sentry with explicit balancing test)
5. Compartilhamento: Supabase (sa-east-1), Brevo (FR EU-adequate), Vercel (USA via SCCs), Sentry (USA via SCCs)
6. Retenção SLA table (auth.users, blog, newsletter, contact, sent_emails, audit_log, consents, Sentry — specific durations per category)
7. Direitos do titular LGPD Art. 18 — links to `/account/settings/privacy`, `/account/export`, `/account/delete`
8. Cookies — 3 categories with specific cookie names + TTLs
9. Segurança — TLS, RLS, audit log, Sentry PII scrubber disclosure
10. Menores de 18
11. Transferências internacionais — SCC disclosure for Vercel + Sentry USA (GDPR Art. 46(2)(c))
12. Contato — DPO statement: "Thiago Figueiredo opera como pessoa física. Nos termos da Resolução CD/ANPD 2/2022 (pequeno porte) e GDPR Art. 37 não-aplicável, não há Encarregado (DPO) formal. Contato: privacidade@..."
13. Atualizações + histórico via `consent_texts.version`
14. Autoridade — **Both:** ANPD (para residentes no Brasil) + EU DPA (para residentes na UE) via EDPB portal

English version is literal translation + note "Portuguese version prevails in conflict."

## Testing strategy

### Unit tests (vitest, apps/web)

11 files covering: redact-third-party-pii, domain-adapter, request-repo, audit-repo, email-service, inactive-user-finder, container, cookie-banner, consent-gate, cookie-banner-trigger, delete-account-form. Coverage target: 90% lines/functions, 85% branches on `lib/lgpd/**` + `components/cookie-banner/**` via `@vitest/coverage-v8`.

### Integration tests (DB-gated, HAS_LOCAL_DB=1)

6 files, **~58 cases total**:
- `lgpd-delete-flow.test.ts` — 15 cases (happy path, 3 blocker scenarios, phase 1 sequence, partial failure rollback, session ban, scheduled_purge_at calculation, reminders, cancel, phase 3 success/soft-fail)
- `lgpd-export-flow.test.ts` — 12 cases (schema v1 completeness, PII redaction, blocking during pending deletion, rate limit, signed URL TTL, post-deletion cleanup, concurrent exports)
- `lgpd-cancel-flow.test.ts` — 6 cases
- `lgpd-audit-rls.test.ts` — 8 cases (self-access, cascade suppression, purge)
- `lgpd-consents-merge.test.ts` — 7 cases (merge, idempotent, concurrent, site-scoped, XOR)
- `lgpd-rpcs.test.ts` — 10 cases

Seed helper: `seedLgpdScenario(db, opts)` in `test/helpers/db-seed.ts` (extends `seedRbacScenario` pattern; UUID-suffixed for parallel safety).

### Contract tests

`test/contracts/lgpd-adapter.test.ts` — tsd-style `expectType<ILgpdDomainAdapter>()` + 5 more assertions for the 6 adapters. Catches interface shape drift at compile time.

### Performance SLOs (manual pre-launch)

Table covering `check_deletion_safety` (<100ms), `lgpd_phase1_cleanup` (<3s), `collectUserData` (<10s), consent insert (<200ms), merge (<500ms), cron sweep (<60s). Execute via `RUN_PERF=1 npm test`.

### CI updates

New job `test-db-integration` in `.github/workflows/ci.yml` using Supabase Docker service to actually RUN the DB-gated tests (closes Sprint 4.75 CI gap where these tests silently skipped).

### E2E deferred

Playwright setup + specs go to Sprint 5c.

## Observability + rollout

### Feature flags (4)

- `NEXT_PUBLIC_LGPD_BANNER_ENABLED` — cookie banner visibility
- `NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED` — /account/delete UI
- `NEXT_PUBLIC_ACCOUNT_EXPORT_ENABLED` — /account/export UI
- `LGPD_CRON_SWEEP_ENABLED` — server-side cron toggle

Granular partial rollback.

### Sentry

- Release tag `s5a-lgpd-<commit_sha>` (pattern from Sprint 4.75)
- Alerts (absolute counts for MVP launch volume):
  - `lgpd_phase_failure` — error_count >= 1 within 5min
  - `lgpd_cron_backlog` — >10 pending requests
  - `consent_insert_failure` — >10 errors/5min
- Migrate to rate-based after 3 months + >1k users

### Admin UI

- `/admin/lgpd-requests` — list/filter/retry failed, view metadata (pre_capture, blob_path). Retry semantics: phase 1 RPC is idempotent (ON CONFLICT handling); phase 3 auth.admin.deleteUser is idempotent; stuck-processing resets to pending + re-sends email
- `/admin/consents-stats` — counts per category + trends
- `/admin/audit` — reuses Sprint 4.75 Track G page, filter `action LIKE 'lifecycle_%'`

### Supabase Logs

Query performance alerts on `check_deletion_safety` (p95 >100ms) and `collectUserData` (>5s).

### Deploy sequence

1. `npm run db:push:prod` — 16 new migrations applied (pre-checked via backup migration 000000)
2. Vercel deploy staging → `bash scripts/smoke-test-lgpd.sh` on staging
3. Promote to prod → smoke test again
4. Initial flag state: banner ON, delete+export ON, cron ON (gradual rollout option: flags start OFF, flip after 24h monitoring)

### Rollback plan

- **Pre-user-requests:** flip feature flags to false + redeploy; migrations stay (non-destructive by design)
- **Post-user-requests:**
  - Legal/copy bug: hotfix MDX content + redeploy
  - RPC bug: disable feature flag, leave migrations, admin manual handling via `/admin/lgpd-requests`
  - Catastrophic data issue: restore from `lgpd_migration_backup_v1` (backup migration 000000); specific rollback SQL in runbook
- Post-mortem in `docs/incidents/YYYY-MM-DD-lgpd-incident.md` using SRE standard template

### Documentation deliverables

- This spec: `docs/superpowers/specs/2026-04-16-sprint-5a-lgpd-compliance-design.md`
- Implementation plan (next): `docs/superpowers/plans/2026-04-16-sprint-5a-lgpd-compliance.md`
- Runbook: `docs/runbooks/lgpd-request-handling.md` (ANPD response SLA 15d, manual recovery, rollback, escalation)
- Smoke test: `scripts/smoke-test-lgpd.sh` (8 checks post-deploy)
- CLAUDE.md update — new section "LGPD compliance" with architecture pointers
- CHANGELOG-lgpd.md — versioning trail for consent_text changes

## Success criteria (15 items)

- [ ] 16 migrations applied cleanly in prod (via `npm run db:push:prod`)
- [ ] `/privacy` + `/terms` live in pt-BR + en with SEO metadata
- [ ] Cookie banner renders on public routes (home, blog, campaigns, privacy, terms); NOT on admin/cms/account
- [ ] Deletion flow end-to-end: request → email → confirm → phase 1 → grace period UI → (cancel OR phase 3)
- [ ] Cancel flow: email link → unban → login restored
- [ ] Data export synchronous: request → email with signed URL → download works
- [ ] Super_admin self-delete: blocker UI prevents + suggests transfer
- [ ] Audit log populated for all phase transitions
- [ ] `audit_log_self_*` RLS policies grant user access to own lifecycle entries
- [ ] Integration tests: 100% pass with `HAS_LOCAL_DB=1 npm test` (58 cases)
- [ ] Unit test coverage: 90%+ on `lib/lgpd/**` + `components/cookie-banner/**`
- [ ] a11y: 0 axe-core violations on banner + delete form
- [ ] Sentry release tag `s5a-lgpd-*` emitting
- [ ] Privacy policy includes: DPO exemption statement, SCC disclosure for Vercel+Sentry, ANPD + EU DPA complaint paths
- [ ] Smoke test script passes all 8 checks on prod after deploy

## Revision log

- **v1 brainstorming (2026-04-16 Sections 1–5):** initial design. Scores averaged 47–64/100 across 3 critics per section.
- **v2 (this doc):** incorporates fixes from 15 independent critic findings across 5 iteration rounds:
  - Section 1: added 6th adapter (IInactiveUserFinder), fixed LgpdConfig shape (flat phase2/3DelayDays, not nested), removed broken IAccountStatusCache → null-object shim, corrected email template mapping, middleware pattern via (authed) route group, cookie banner in (public) layout only, app-layer cancel RPC, password re-auth endpoint, atomic phase 1 RPC
  - Section 2: added anti-dark-pattern UX, multi-tab sync, hydration-safe Sentry init, consent-gate + trigger components, consent version fingerprint
  - Section 3: comprehensive FK pre-nullify strategy (blog_posts, campaigns, audit_log, invitations), full data export schema v2 with content + 3rd-party PII redaction, synchronous export flow, blob_path tracking, post-deletion blob revocation, parenthesized operator precedence, both audit_log self-access policies, explicit storage prefix match, consent_texts table with versioning
  - Section 4: partial unique indices with NULL handling, XOR check, UUID format constraint, service-role anonymous insert (not RLS policy), merge race protection via FOR UPDATE, audit trigger on consents, ON DELETE SET NULL for site_id, DPO statement per ANPD Resolução 2/2022, SCCs disclosure, EU DPA path, Sentry balancing test, 4 legal additions to privacy policy
  - Section 5: 16 migrations (was 8) per CLI 2.90 lessons, backup migration, FK pre-check, 4 feature flags, CI job for DB-gated tests, performance SLOs table, explicit integration test case counts (58 total), alert thresholds calibrated for MVP volume, retry semantics documented, consent re-prompt on version bump, runbook skeleton committed now
