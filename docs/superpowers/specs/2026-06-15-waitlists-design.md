# Waitlist — Refined Design (self-contained, v5 — final)

> Status: refined against the live codebase with all v3 + v4 expert critiques resolved and all 19 round-4 gaps closed against grounded codebase facts (no remaining "verify empirically" hedges on the load-bearing paths). Corrections to the preamble (load-bearing):
> - **`env.ts` is at `apps/web/src/lib/env.ts`** (NOT `apps/web/lib/env.ts`). The SES config-set env vars live here.
> - **`contact_rate_check` uses `SET search_path TO 'public'`** (schema.sql:3950) — NOT `''`. ALL new waitlist DEFINER functions use `search_path = ''` (the *correct* hardened posture), not the contact precedent.
> - **`verifyTurnstileToken` already FAILS-CLOSED** (`apps/web/lib/turnstile.ts`): returns `false` when `TURNSTILE_SECRET_KEY` is unset. The route adds an explicit non-dev assertion on top (§3).
> - **`tg_set_updated_at()`** (schema.sql:5088) is the canonical updated-at trigger function used by `blog_posts`, `authors`, etc. Pinned explicitly.
> - **The send route has FOUR `status:'sent'` write sites**: empty-subscriber early-return (~259), crash-resume completion (~333), a mid-path completion (~507), and the normal completion (~623). The send-completion status gate must cover all four.
> - **`contact_submissions_pending_anonymize`** is `(site_id, submitted_at DESC) WHERE anonymized_at IS NULL` (schema.sql:5486). The waitlist retention index is designed to its own sweep predicate (§1, §2), NOT this shape.
> - **`campaign_submissions` carries NO `site_id`** (reaches site via `campaign_id → campaigns.site_id`). `waitlist_signups.site_id` is a deliberate NET-NEW denormalization.
> - **`audit_log.resource_id` is `uuid`** (schema.sql:726). An email-hash cannot live there; it goes in `after_data` jsonb. `audit_log` is **append-only** by RLS: it has only THREE SELECT policies and NO UPDATE/DELETE RLS policy and NO UPDATE/DELETE GRANT, so authenticated users are denied mutation by default; only `service_role` can mutate (gap 7, §2).
> - **`getEmailSender(siteId)`** (`apps/web/lib/email/sender.ts`) returns a single constructed `noreply@{primaryDomain}` address. There is **NO** SES identity-verification API anywhere in the app.
> - **`requireSiteScope` supports `mode: 'publish'` → `can_publish_site`**. No net-new publish wrapper is needed.
> - **Newsletter anon-INSERT policy (gap 14 — verified this session, supersedes earlier flip-flop):** the actual policy, after migration `20260603000001_restrict_anon_insert_pending_only.sql`, IS `WITH CHECK (status = 'pending_confirmation' AND EXISTS (SELECT 1 FROM public.sites s WHERE s.id = newsletter_subscriptions.site_id AND public.site_visible(s.id)))`. (The original squashed policy at `20260507000001_schema.sql:6522` was later tightened by this migration to add the `status` predicate.) The waitlist decision is unaffected — waitlist has **no** anon-INSERT policy at all (signups funnel through the DEFINER RPC) — so the contrast is informational only.
> - **Citation anchoring (gap re stale line numbers):** "schema.sql" references in this doc resolve to **`supabase/migrations/20260507000001_schema.sql`** (the squashed base schema), with later behavior overridden by subsequent dated migrations (e.g. `20260603000001`, `20260608000002`). Some line numbers were transcribed from the `supabase/backup_schema_pre_squash.sql` dump and may be off by a constant offset against the squashed migration; the cited FACTS were re-verified, but anchor to the migration file + grep the symbol rather than trusting the exact line.
> - **TipTap/MDX persistence path corrected (gap 5):** the JSON content path stores **HTML** in `content_html` (via `compileJsonContent()` in `compile-json.ts`), NOT MDX JSX. The MDX path stores `content_mdx` and renders via `compile()`+`run(blogRegistry)`. These are two distinct pipelines; WaitlistForm's registration differs per path (§7.3, pinned to verified facts — no allowlist exists; the JSON path uses a finite 31-case switch; unknown node types are silently dropped).
> - Prior-verified & unchanged: `unsubscribe_tokens.token_hash` PK + `UNIQUE(site_id,email)`; all email columns `public.citext`; `campaign_submissions_email_unique` partial `WHERE anonymized_at IS NULL` (schema.sql:5436); hardened `unsubscribe_via_token` (`20260608000002`, `set search_path=''`); `newsletter_editions.status` NOT NULL CHECK in `('idea','draft','ready','queued','scheduled','sending','sent','failed','cancelled')` (no `'launched'`); `newsletter_editions.segment` NOT NULL CHECK in `('all','high_engagement','re_engagement','new_subscribers')`; `newsletter_type_id` nullable text; in-memory Set eligibility (route.ts:328-329); hardcoded `process.env.SES_MARKETING_CONFIG_SET ?? 'bythiago-marketing'` (route.ts:484); breaker only at `totalAttempted >= 10` (route.ts:565); `MAX_RETRY_PASSES=2`; **`newsletter_sends.edition_id` FK to `newsletter_editions(id)` is `ON DELETE CASCADE`** (schema.sql:2891-2892 — gap 12); SES webhook flips `newsletter_subscriptions` by email (webhooks/ses/route.ts:361-388), edition join selects only `(site_id, newsletter_type_id)` (route.ts:207); **both `send-welcome-emails` (route.ts:162-167) and `send-scheduled-newsletters` (route.ts:383-386) upsert `unsubscribe_tokens` with `onConflict:'site_id,email'`, `ignoreDuplicates:false`** (gap re token onConflict — both call sites change to `'site_id,email,source'`, §5.1).

### Locked decisions (do NOT violate)
1. **Single opt-in** (no double opt-in / confirmation email).
2. **Email + consent only** (no name, phone, custom fields).
3. **Standalone tables**, reusing the newsletter SES send machinery for the launch broadcast.
4. **Three surfaces:** hosted landing page, embeddable block, TipTap/MDX node.
5. **Optional campaign link** (a waitlist may reference a `campaigns` row).
6. **Phased delivery.**

### Lawful-basis anchor
Consent is **strictly first-party**: *"notify me by email when THIS product launches."* No partner/third-party promotion is in scope; the optional `campaign_id` only links a first-party lead-magnet for context. The field is **`consent_launch_notification`**, copy is narrowly scoped (§4), and the broadcast rides a **dedicated/transactional** SES config-set (§5.3).

### Single opt-in residual-risk mitigation (Art. 8 — enrolling a stranger's email)
Single opt-in is **locked**, mitigated without a confirmation email:
1. **Provenance line in the launch email body (mandatory):** *"You asked to be notified about {name} at {site} on {consent_grant_date}."* + RFC 8058 one-click unsubscribe. The date is `consent_grant_at` (§1), refreshed on resurrect and fresh after anonymize-then-fresh-signup (tested).
2. **Append-only consent-grant audit** (`audit_log`, §2) records ip/ua/source_surface/version **and a snapshot of the exact displayed consent text** at grant time.
3. **Technical exposure controls, not just sign-off (gap 9 resolved):** the residual exposure of a stranger's plaintext email is bounded by concrete technical controls, not only DPO sign-off — `ORPHAN_PENDING_DAYS=90` caps how long an un-launched pending email is retained; `IP_UA_DAYS=30` caps network PII; the **per-email DSAR export endpoint (§2.5)** gives any enrolled stranger a self-service access path; one-click unsubscribe gives immediate withdrawal. DPO/legal sign-off documents the *residual* posture after these controls, not in lieu of them.

### State-vocabulary glossary (architecture minor)
- **`waitlist_signups.status`** ∈ `pending | suppressed` (mailability).
- **`waitlist_signups.suppression_reason`** ∈ `null | unsubscribe | bounce | complaint` (why suppressed).
- **`audit_log` event-type:** withdrawal = `consent_withdrawn` (`after_data.reason` ∈ `unsubscribe|bounce|complaint`); grant = `consent_granted`; resurrect = `consent_regranted`.

---

## 1. Data model

Two standalone tables + one translations table, `snake_case`, site-scoped. Migrations follow project idempotency (`drop ... if exists` first). New-table CHECKs are inline; future status additions follow `ADD CONSTRAINT ... NOT VALID` + `VALIDATE`.

### `waitlists`
```
id              uuid primary key default gen_random_uuid()
site_id         uuid not null references sites(id) on delete restrict
slug            text not null
name            text not null
description     text
status          text not null default 'draft'
campaign_id     uuid references campaigns(id) on delete set null
sender_name     text
sender_email    text                 -- validated at SAVE and RE-validated at PRE-SEND against site's own domains (§5.4, §6)
reply_to        text
intro_mdx       text                 -- authored in CMS MDX/TipTap; compiled+sanitized; never raw HTML
launched_at     timestamptz
created_at      timestamptz not null default now()
updated_at      timestamptz not null default now()

constraint waitlists_status_check check (status in ('draft','open','closed','launching','launched','failed'))
constraint waitlists_slug_site_key unique (site_id, slug)
constraint waitlists_id_site_key   unique (id, site_id)   -- enables composite FK from signups
```
- `site_id → ON DELETE RESTRICT`; `campaign_id → ON DELETE SET NULL`.
- **Six states:** `draft` (private), `open` (accepting), `closed` (public, signups rejected, still broadcastable), `launching` (broadcast in flight), `launched` (terminal), `failed` (operator-recoverable).
- **`set_updated_at` trigger pinned to `public.tg_set_updated_at()`**: `drop trigger if exists trg_waitlists_set_updated_at on public.waitlists;` then `create trigger trg_waitlists_set_updated_at before update on public.waitlists for each row execute function public.tg_set_updated_at();`
- **The broadcast confirm token is the UNIQUE `slug`, NOT the `name` (gap 4 resolved):** because only `(site_id, slug)` is UNIQUE — two waitlists on a site may share a `name` — the operator-facing typed-confirmation token is the `slug` (§6 broadcast dialog), which is guaranteed per-site-unique and therefore unambiguous.

### `waitlist_signups`
```
id                          uuid primary key default gen_random_uuid()
waitlist_id                 uuid not null
site_id                     uuid not null               -- DENORMALIZED (net-new; composite FK backstop)
email                       public.citext not null
locale                      text
consent_launch_notification boolean not null
consent_text_version        text not null
consent_grant_at            timestamptz not null default now()  -- refreshed on resurrect (provenance source)
suppression_reason          text                         -- null | 'unsubscribe' | 'bounce' | 'complaint'
status                      text not null default 'pending'
suppressed_at               timestamptz
source_surface              text                         -- 'landing'|'embed'|'tiptap'
ip                          inet
user_agent                  text
anonymized_at               timestamptz
created_at                  timestamptz not null default now()

constraint waitlist_signups_status_check    check (status in ('pending','suppressed'))
constraint waitlist_signups_consent_required check (consent_launch_notification = true)
constraint waitlist_signups_email_len       check (length(email::text) between 5 and 320)
constraint waitlist_signups_suppress_coherent
  check ((status = 'suppressed') = (suppressed_at is not null))
constraint waitlist_signups_suppress_reason_coherent
  check ((status = 'suppressed') = (suppression_reason is not null))
constraint waitlist_signups_suppress_reason_enum
  check (suppression_reason is null or suppression_reason in ('unsubscribe','bounce','complaint'))

constraint waitlist_signups_parent_fk
  foreign key (waitlist_id, site_id) references waitlists (id, site_id) on delete cascade
```
```sql
create unique index waitlist_signups_email_unique
  on waitlist_signups (waitlist_id, email) where anonymized_at is null;
```
- **`site_id` DELIBERATE NET-NEW denormalization:** site-scoped RLS reads `site_id` directly; the per-site retention sweep keys on `site_id`. The **composite FK `(waitlist_id, site_id) → waitlists(id, site_id)`** makes desync provable-impossible at the DB layer. The signup RPC populates `site_id` from the parent row; SES-webhook and CSV-export UPDATEs filter by **both** `site_id` AND `waitlist_id`. `ON DELETE CASCADE` handles signup cleanup on waitlist delete.
- `email public.citext` — native case-insensitivity, equal to `unsubscribe_tokens.email`.
- `consent_grant_at` is the provenance timestamp (refreshed on resurrect; fresh on anonymize-then-fresh-signup).
- `consent_text_version` stays free-text inline. Tamper-evidence is the audit consent-text snapshot (§2), not a row FK.

### `waitlist_translations`
Documented per-column nullability (does NOT mirror `campaign_translations`):
```
id                    uuid primary key default gen_random_uuid()
waitlist_id           uuid not null references waitlists(id) on delete cascade
locale                text not null
headline              text                 -- nullable; FORM_STRINGS fallback
subheadline           text                 -- nullable; FORM_STRINGS fallback
consent_label         text not null default ''
button_label          text
button_loading_label  text
success_headline      text
success_body          text
duplicate_headline    text
duplicate_body        text
closed_message        text
launched_message      text
constraint waitlist_translations_waitlist_id_locale_key unique (waitlist_id, locale)
```
- Every public-facing field nullable-or-defaulted; the form's `FORM_STRINGS` map (pt-BR + en) supplies a fallback for every field. The public `GET` (§3) resolves `x-locale` → site default locale → `FORM_STRINGS`; never errors.

### `newsletter_editions` extension
```sql
alter table newsletter_editions
  add column recipient_source text not null default 'newsletter'
    check (recipient_source in ('newsletter','waitlist')),
  add column source_ref_id uuid references waitlists(id) on delete restrict,
  add constraint newsletter_editions_source_ref_coherent
    check ((recipient_source = 'waitlist') = (source_ref_id is not null));
create unique index newsletter_editions_waitlist_uniq
  on newsletter_editions (source_ref_id)
  where recipient_source = 'waitlist' and status not in ('failed','cancelled');
```
- **`source_ref_id → ON DELETE RESTRICT`** (avoids conflict with the coherence CHECK). A waitlist with any edition cannot be hard-deleted; the §6 delete guard + retention sweep handle lifecycle.
- Partial unique index excludes BOTH `failed` AND `cancelled`.
- **Failed-edition delete is FK-safe (gap 12 resolved against verified facts):** `newsletter_sends.edition_id` has FK `ON DELETE CASCADE` to `newsletter_editions(id)` (schema.sql:2891-2892). Therefore the Resume/Retry path (§5.8) that deletes the `failed` edition **cannot hit an FK error** even when that edition already has `newsletter_sends` rows — the cascade deletes them automatically, with no error. No manual cascade or pre-delete cleanup is needed. (The `source_ref_id` RESTRICT FK is edition→waitlist, the opposite direction, and does not impede the edition delete.) Test: delete a failed edition that has ≥1 `newsletter_sends` row and assert it succeeds with the sends cascade-deleted.

### `unsubscribe_tokens` extension — source-namespaced token
```ts
// apps/web/lib/newsletter/confirm-email.ts
export function generateUnsubscribeToken(
  siteId: string,
  email: string,
  source: 'newsletter' | 'waitlist' = 'newsletter',
): { raw: string; hash: string } {
  const message = source === 'newsletter'
    ? `${siteId}:${email.toLowerCase()}`                 // byte-identical legacy → outstanding tokens stay valid
    : `waitlist:${siteId}:${email.toLowerCase()}`        // distinct namespace; lowercasing PRESERVED
  const raw  = createHmac('sha256', key).update(message).digest('hex')
  const hash = sha256(raw)
  return { raw, hash }
}
```
```sql
alter table unsubscribe_tokens
  add column source text not null default 'newsletter'
    check (source in ('newsletter','waitlist'));
alter table unsubscribe_tokens drop constraint if exists unsubscribe_tokens_site_id_email_key;
alter table unsubscribe_tokens add constraint unsubscribe_tokens_site_id_email_source_key
  unique (site_id, email, source);
```
- **The stored `source` column is the SOLE routing authority.** A write-time invariant test asserts `token_hash == sha256(hmac(namespaced-message-for(stored source)))`.
- **Upsert onConflict change (both verified call sites):** `send-scheduled-newsletters` (route.ts:383-386) AND `send-welcome-emails` (route.ts:162-167) both currently use `onConflict:'site_id,email'`, `ignoreDuplicates:false`. The newsletter send-path upsert that the waitlist seam touches (route.ts:~383-385) MUST change to `onConflict:'site_id,email,source'` and write `source` — for BOTH sources. `send-welcome-emails` is out of the waitlist send scope (welcome path stays newsletter-only); its onConflict is left unchanged because no waitlist write flows through it, but it is documented here so a future audit does not flag asymmetry.

### Indexes
- `waitlist_signups (waitlist_id, status)` — broadcast recipient scan + counts.
- **`waitlist_signups (site_id, status, created_at) where anonymized_at is null`** — designed to the sweep predicate (§2). **The leading `site_id` is justified by the per-site iteration model (gap 1 resolved):** the sweep is **per-site-keyed** (`where site_id = $1`), iterating over the site enumeration the existing cron infra already provides (the cron resolves the active site set the same way `fetchLayoutCounts`/middleware do), NOT a single site-agnostic UPDATE. This keeps every site's sweep an index-only range over its own partition of the table, bounds per-site lock scope, and lets a single misconfigured site's data not force a full-table scan. The `status` key column keeps the per-status age predicates off a heap filter; `created_at` orders within. (If a future operational decision makes the sweep site-agnostic, the index should be re-shaped to `(anonymized_at, status, created_at)` — but the per-site model is the chosen one and the index matches it.)
- `waitlists (site_id, status)` — CMS list + public lookup.

### RLS (fail-closed, reuse helpers — never inline)
- **`waitlists` public read:** `status in ('open','closed','launched')` AND `public.site_visible(site_id)`. `draft`/`launching`/`failed` invisible.
- **`waitlist_translations` public read:** joined visibility via parent.
- **`waitlists` write:** `public.can_edit_site(site_id)` insert/update; delete gated `public.can_admin_site_users(site_id)`.
- **`waitlist_signups`:** **NO anon INSERT RLS policy at all** (signups funnel exclusively through the SECURITY DEFINER RPC with `EXECUTE` granted only to `anon`, `REVOKE`d from `public`, no table-level INSERT grant). A future direct anon INSERT silently fails-closed. **No public SELECT policy.** Staff read/export gated `public.can_view_site(site_id)`. (For contrast: the newsletter anon-INSERT policy IS `WITH CHECK (status='pending_confirmation' AND site_visible(site_id))` per migration `20260603000001` — verified this session, gap 14.) Integration test: direct anon INSERT is RLS-denied.

---

## 2. LGPD wiring

- **Lawful basis = consent (Art. 7 I), first-party only.** Broadcast uses the dedicated/transactional config-set (§5.3).
- **Consent versioning:** server-pinned `WAITLIST_CONSENT_VERSION` in server-only `consent.ts`. Client string ignored.

### 2.1 Consent ledger model — fully inline, tamper-evident
Follows the verified `contact_submissions`/`newsletter` inline precedent (no `consents` ledger rows; no `consents_category_check` change; no `consent_texts` CHECK change — none exists, schema.sql:2124).
- Register the waitlist consent text in **`consent_texts`** under category `'launch_notification'`, locale + version = `WAITLIST_CONSENT_VERSION`.
- **`consent_texts.id` seed convention (gap 15 resolved):** `consent_texts.id` is `text NOT NULL` with no default (schema ~958), so the seed MUST supply a deterministic id. Convention: **`id = 'launch_notification:{locale}:{version}'`** (e.g. `launch_notification:en:launch-notification-v1-2026-06`). The CI version-resolution invariant looks up by this exact key per supported locale; the signup RPC's consent-text snapshot reads the row by this key.
- **Do NOT insert `consents` ledger rows.**
- **Tamper-evident proof:** the consent-GRANT audit row snapshots the EXACT displayed consent text into `after_data.consent_text_snapshot` (proof-of-what-was-consented-to per-signup, independent of any later in-place edit of the `consent_texts` row). A CI/seed invariant (`WAITLIST_CONSENT_VERSION` resolves in `consent_texts` per supported locale, by the id convention above) is the secondary deploy-time check.

### 2.2 Audit trail — append-only, ip/ua as explicit RPC params, mechanism PINNED
- **Mapping:** `resource_type='waitlist_signup'`, `resource_id = waitlist_signups.id` (uuid), `site_id = site_id`; **email-hash + reason + source_surface + consent_text_version + consent_text_snapshot in `after_data` jsonb.**
- **Write mechanism PINNED (gap 7 resolved against verified facts):** the signup RPC writes the audit row via a **direct `INSERT` into `audit_log` using the service-role/DEFINER path**, following the verified `AuditLogLgpdRepository.create()` pattern (audit-repo.ts:47-66) and the `lib/lgpd/container.ts` lifecycle handlers — **NOT** by relying on the `tg_audit_mutation` trigger (which fires only for the specific tracked tables `organization_members`/`site_memberships`/`invitations`, and is not attached to `waitlist_signups`/`consents`). Because the public POST path may not set the `app.client_ip`/`app.user_agent` GUCs, **ip/ua are passed as explicit RPC params and written as explicit columns on the INSERT** (`audit_log.ip` inet, `audit_log.user_agent` text) — the most reliable approach for an RPC context per the verified guidance, rather than relying on `set_audit_context()` + a trigger.
- **Append-only guarantee PINNED (gap 7 resolved):** `audit_log` is append-only at the application layer because it has **only three SELECT (READ) RLS policies** (`audit_log_read` for super_admin/org_admin; `audit_log_self_as_actor`; `audit_log_self_lifecycle_target`) and **NO UPDATE/DELETE RLS policy and NO UPDATE/DELETE GRANT** in the migration. With RLS enabled and no UPDATE/DELETE policy, PostgreSQL denies UPDATE/DELETE to all authenticated users; only `service_role` can mutate. The DEFINER signup RPC only ever INSERTs, never UPDATE/DELETE, so the audit rows it writes are immutable from the app. The "append-only" claim therefore rests on a verified RLS fact, not an assumption.
- **Events:** `consent_granted` (fresh signup), `consent_withdrawn` (`after_data.reason` ∈ `unsubscribe|bounce|complaint`), `consent_regranted` (suppressed→pending re-consent). Tests assert grant/regrant rows have non-null ip/ua and the immutability of an inserted row (UPDATE/DELETE as `authenticated` is denied).

### 2.3 Erasure + export — honest anonymous-member story
- **Anonymous-member gap stated explicitly:** `lgpd_phase1_cleanup` runs ONLY on account deletion (auth.users flow). Anonymous waitlist signups have no `user_id`, so phase1 NEVER touches them. The phase1 branch + `collectUserData` cover only the rare authenticated-email subset.
- **`lgpd_phase1_cleanup` RPC migration (Fase 1):** add a `waitlist_emails` branch anonymizing `waitlist_signups` like the `newsletter_subscriptions` branch: `email = encode(sha256(email::text::bytea),'hex')`, `ip=null`, `user_agent=null`, `locale=null`, `anonymized_at=now()`.
  - **search_path note (gap 17 resolved):** `lgpd_phase1_cleanup` currently uses `SET search_path TO 'public'` (schema ~4336), NOT `''`. The waitlist branch is added **in-place** and therefore **inherits the existing function's `'public'` search_path** — this is intentional and acceptable for an existing function; it is documented here explicitly so a reviewer does NOT flag it as inconsistent with the `''` posture mandated for **net-new** functions. (Net-new waitlist functions still use `search_path = ''`.)
  - **EXECUTE scoping + existing-caller interaction (gap 18 resolved):** the existing caller guard is `auth.role() IN ('service_role','supabase_admin') OR auth.uid() = p_user_id`, which already permits an authenticated user to anonymize **their own** emails. The design's intent is that **anonymous/non-owner callers cannot drive anonymization of arbitrary waitlist emails** — which the existing `auth.uid() = p_user_id` body guard already enforces (a non-owner authenticated user fails the guard). Therefore we **KEEP the existing caller guard rather than tightening EXECUTE to service_role-only**, so the authenticated self-service erasure path AND the `collectUserData`/export flow that may run as the user are NOT accidentally locked out. The hardening that matters is: the pre-capture email set is derived **server-side from the authenticated user's identity, never from client-supplied JSONB**, and the body guard already blocks cross-user targeting. Erasure-injection negative test: an authenticated non-owner cannot drive anonymization of another user's waitlist emails; an anon caller is rejected.
- **`collectUserData`** (`apps/web/src/lib/lgpd/domain-adapter.ts`): include waitlist memberships in the Art. 18 export with an **explicit narrowed projection**: `email, consent_launch_notification, consent_text_version, status, source_surface, created_at` — **ip/user_agent EXCLUDED** (parity with the `newsletter_sends` export).
- **Pre-capture:** the adapter enumerates the authenticated user's waitlist emails into `p_pre_capture` (server-derived) so the RPC can erase them. Tests mirror `domain-adapter.test.ts`.

### 2.4 Retention sweep — dedicated always-on cron, per-site iteration, idempotency-guarded
- **Standalone route** modeled on `anonymize-newsletter-tracking` (always-on, `withCronLock`, `CRON_SECRET`-gated), gated ONLY by `WAITLIST_RETENTION_SWEEP_ENABLED` — **NOT** under `LGPD_CRON_SWEEP_ENABLED`.
- **Iteration model (gap 1 resolved):** the sweep **iterates per-site** over the resolved active-site enumeration, running the UPDATE below once per `site_id = $1`. This is what justifies the `(site_id, status, created_at)` leading column (§1). Each site's pass is bounded and index-only.
- **Helper RPC `EXECUTE` granted only to `service_role`**, `search_path=''`, schema-qualified.
- **Cron split-brain fix:** route exports BOTH `GET` and `POST` (GET=POST alias). **Vercel cron schedule entry (gap 19, operational deliverable):** add to `vercel.json` crons a daily entry hitting the route path with the `CRON_SECRET` header. Emit a Sentry breadcrumb + persist a last-run timestamp.
- **Retention windows — explicit numeric constants with purpose-binding rationale** (reconciled against verified precedents `purge_old_contact_submissions(730)` and newsletter tracking `RETENTION_DAYS=90`):
  - `WITHDRAWN_DAYS = 30` — short grace post-withdrawal for dispute/audit reconciliation.
  - `SPENT_CONSENT_DAYS = 7` — after a `closed`/`launched` list's purpose is consummated; 7d covers delivery/bounce settling.
  - `ORPHAN_PENDING_DAYS = 90` — max-reasonable-launch-horizon; aligned with the 90d tracking norm.
  - `IP_UA_DAYS = 30` — network PII nulled regardless of status.
  - `STUCK_LAUNCHING_HOURS = 6` — watchdog threshold (§5.8).
  - **Entire schedule under explicit DPO sign-off** (Fase-1 deliverable).
- **Exact sweep SQL — per site, with the IP/UA idempotency guard (gap 2 resolved):**
  ```sql
  -- PASS 1 (full anonymization) — per site, anonymized_at IS NULL only:
  update public.waitlist_signups s set
    email = encode(sha256(s.email::text::bytea),'hex'),
    ip = null, user_agent = null, locale = null, anonymized_at = now()
  where s.site_id = $1 and s.anonymized_at is null
    and (
      (s.status = 'suppressed' and s.suppression_reason = 'unsubscribe'
         and s.suppressed_at < now() - (interval '1 day' * $WITHDRAWN_DAYS))
      or
      (exists (select 1 from public.waitlists w where w.id = s.waitlist_id
                 and w.status in ('closed','launched'))
         and s.created_at < now() - (interval '1 day' * $SPENT_CONSENT_DAYS))
      or
      (s.status = 'pending'
         and exists (select 1 from public.waitlists w where w.id = s.waitlist_id
                       and w.status in ('draft','open'))
         and s.created_at < now() - (interval '1 day' * $ORPHAN_PENDING_DAYS))
    )
    -- SUPPRESSION-PRECEDENCE-OVER-ERASURE: never anonymize bounce/complaint
    and not (s.status = 'suppressed' and s.suppression_reason in ('bounce','complaint'));

  -- PASS 2 (network-PII minimization) — does NOT set anonymized_at, so it MUST
  -- be self-terminating to avoid unbounded re-scan of long-lived pending rows.
  -- IDEMPOTENCY GUARD: only touch rows that still hold network PII.
  update public.waitlist_signups s set
    ip = null, user_agent = null
  where s.site_id = $1
    and (s.ip is not null or s.user_agent is not null)   -- <<< guard: no-op churn impossible
    and s.created_at < now() - (interval '1 day' * $IP_UA_DAYS);
  ```
  - **PASS 2 explicitly does NOT set `anonymized_at`** (the row is only network-minimized, not fully anonymized, so it stays mailable / resurrectable). Because the partial index `WHERE anonymized_at IS NULL` still includes these rows, the **`(s.ip is not null or s.user_agent is not null)` predicate is the load-bearing idempotency guard**: once a row's ip/ua are nulled, it no longer matches PASS 2 and is never re-updated, so a long-lived pending row produces **zero no-op writes** on subsequent sweeps. Test: run the sweep twice over a fixture with an aged pending row and assert PASS 2 affects 0 rows on the second run.
- **Anonymization eligibility:** **never anonymize a `pending` row on an `open` list** until `ORPHAN_PENDING_DAYS`. Returning-user paths: anonymized→fresh consent (mailable); suppressed→resurrect (subject to the suppression_reason guard).
- **Suppression survives erasure:** bounce/complaint excluded from PASS 1 — email retained so suppression survives; the resurrect guard refuses re-enrollment by reason.
- **Unsubscribe = consent withdrawal:** flips `status='suppressed'`, `suppressed_at=now()`, `suppression_reason='unsubscribe'`, clears `ip`/`user_agent`/`locale`. Email retained (resurrectable); hashed by PASS 1 after `WITHDRAWN_DAYS`. Divergence from newsletter (hashes immediately) is intentional and asserted by a test.
- **No PII to Sentry:** the signup path scrubs the request body before any Sentry capture; the `source_surface` funnel metric is count-only.
- No cookie-banner concerns (public marketing pages already under `app/(public)/layout.tsx`).

### 2.5 Per-email DSAR export endpoint (Art. 18) — closes the anonymous-signup gap (gap 8 resolved)
The common anonymous case previously had Art. 16 (one-click unsubscribe) but no self-service Art. 18 (access/portability) path. We **ADD a minimal token-gated per-email export endpoint that reuses the unsubscribe-token machinery — no confirmation email, no new auth surface:**

- **`GET /api/waitlists/dsar/[token]` (NEW, public, token-gated).** The `token` is the **same raw unsubscribe token** already issued to the subscriber (the `raw` from `generateUnsubscribeToken`, source-namespaced `'waitlist'`). The handler:
  1. Hashes the supplied raw token (`sha256(raw)`) and looks it up in `unsubscribe_tokens` by `token_hash` filtered to `source='waitlist'` — reusing the exact verified token-verification mechanism, with the **same generic-neutral response on unknown/used token (no oracle)** as the unsubscribe handler (§5.6).
  2. On a valid match, resolves `(site_id, email)` from the token row and returns the subscriber's own waitlist data with the **same narrowed projection as `collectUserData`**: `email, consent_launch_notification, consent_text_version, status, source_surface, created_at` (across all that site's waitlists for that email) — **ip/user_agent EXCLUDED**. Anonymized rows are omitted.
  3. Format: JSON (machine-readable portability) with a `Content-Disposition: attachment` download.
- **Why this is sufficient + safe:** the token is a per-recipient HMAC secret already in the subscriber's possession (it rides every launch email's List-Unsubscribe / unsubscribe link), so possession of it is the access proof — no separate confirmation email is needed (consistent with the single-opt-in lock). HMAC-256 makes the token unguessable; the no-oracle response prevents enumeration. The endpoint is **read-only** and returns ONLY the requesting email's own rows. This converts the "documented limitation under DPO sign-off" into a **shipped technical control**, closing the Art. 18 gap for anonymous signups. `collectUserData` remains the path for the authenticated subset.
- **Tests:** valid waitlist token returns that email's own rows only (ip/ua excluded); unknown/used token returns the generic neutral response (no data, no oracle); a `source='newsletter'` token does NOT resolve waitlist data (source-scoped lookup); cross-email isolation (token for email A never returns email B's rows).

---

## 3. Public signup + status endpoint

### `GET /api/waitlists/[slug]` (NEW)
Public. **Resolves `(slug, resolved site_id)`:** `site_id` comes from the request's resolved site context (`x-site-id` set by middleware), NOT slug alone. 404 if the slug does not belong to the resolved site OR status ∈ `draft`/`launching`/`failed`/missing. Returns the resolved-locale translation block. **NO signup data.** Integration test: same slug on two sites returns each site's own list only.

### `POST /api/waitlists/[slug]/signup`
Mirrors `/api/campaigns/[slug]/submit`. Runs under `getSupabaseServiceClient()` (RLS bypassed); status gating enforced in-route/in-RPC, NOT via RLS.

Flow:
1. Zod body `{ email, locale, consent_launch_notification: z.literal(true), turnstile_token }`.
2. **Turnstile fail-closed contract:** the route asserts `TURNSTILE_SECRET_KEY` present when `VERCEL_ENV !== 'development'` and `NODE_ENV !== 'development'` — returns `503` if absent. `verifyTurnstileToken` is confirmed fail-closed. Missing/invalid token → `400 turnstile_failed`. No Origin allow-list. Integration test: missing secret in non-dev → `503`.
3. **Rate limit:** new `waitlist_rate_check(p_site_id, p_ip, p_email)` RPC, `search_path=''`, anon-only EXECUTE. **Fail-CLOSED on RPC error** (`503` with retry copy). `false` → `429`. The Vercel WAF per-IP rule (§3.1) is the DB-independent backstop. Integration test pins fail-closed under simulated RPC error.
4. **List gating (in-route, service client):** resolve `(site_id, slug)` loading `status`; `404` if not found / status ∈ `draft`/`launching`/`failed`; `409 { error:'waitlist_not_open', status }` if status ∈ `closed|launched`. Enforced before any insert.
5. **Insert** via SECURITY DEFINER RPC `waitlist_signup(p_slug, p_email, p_locale, p_consent_version, p_consent_text_snapshot, p_source_surface, p_ip, p_user_agent)`:
   - **`SECURITY DEFINER set search_path = ''`**, schema-qualified; `EXECUTE` granted ONLY to `anon`; no table-level INSERT grant.
   - Re-derives `site_id` from the waitlist row (never caller input); re-validates the list is `open`.
   - Normalizes email (lowercase) before any token generation.
   - Writes the consent-grant audit row via **direct `audit_log` INSERT with explicit ip/ua columns** (§2.2 mechanism).
   - **Control flow uses `SELECT ... FOR UPDATE` + PL/pgSQL branching** keyed by `(waitlist_id, email) where anonymized_at is null`:
     - no live row → `INSERT` fresh `pending`, `consent_granted` audit, return `{duplicate:false}`.
     - `suppressed`+`unsubscribe` → resurrect (`status='pending'`, clear `suppressed_at`/`suppression_reason`, refresh `consent_text_version` + `consent_grant_at=now()`, `consent_regranted` audit), return `{duplicate:false}`.
     - `suppressed`+(`bounce`|`complaint`) → refuse, return `{duplicate:true}`.
     - `pending` → `{duplicate:true}`.
     - (Anonymized prior rows are outside the partial index → fresh `pending`.)
   - Returns `{ duplicate: boolean }`.
6. Response `{ success:true, duplicate }`. Duplicate = idempotent success.

**Public-UX states:** idle / submitting / success / duplicate-success / closed / launched / error / rate-limited / 409-race / 503. See §7.

### 3.1 Vercel WAF per-IP rate-limit rule — concrete spec (gaps 6 + 11 resolved)
This is the only DB-independent abuse control on a no-Origin-allowlist public surface and the backstop when `waitlist_rate_check` fails closed to 503. **Concrete rule spec (Fase-1 operational deliverable, configured via the Vercel WAF / `vercel firewall`):**
- **Path scope:** matches `/api/waitlists/:slug/signup` (the POST signup endpoint) AND the embed/TipTap-originated traffic, which hits the **same** endpoint path — the embed/TipTap surfaces POST to `/api/waitlists/[slug]/signup`, so a single path rule covers all three surfaces. (The DSAR endpoint §2.5 and the `GET` status endpoint are read-only and excluded from this write rule; if abused, they get a separate lower-priority rule.)
- **Condition:** request path matches the signup path AND HTTP method = `POST`.
- **Threshold + window:** **20 requests per IP per 60-second sliding window** (generous for a legitimate single human submit + retries; aggressive enough to blunt scripted enumeration). A second, slower rule: **100 requests per IP per 1 hour**.
- **Action:** rate-limit (429 at the edge) — NOT permanent block (avoids locking out shared-NAT users).
- **Soft-DoS interaction with fail-closed 503 (gap 6 resolved):** an attacker who can induce `waitlist_rate_check` RPC errors turns every signup into a 503; without an edge control this is a soft-DoS amplifier. The WAF rule **counts and rate-limits the request at the edge BEFORE the function runs**, so the 503-generating requests are themselves throttled by the same per-IP rule — the WAF sees the inbound POST regardless of the eventual 503 response code, because edge rate-limiting is evaluated on the request, not the response. Thus a flood that would otherwise produce a wall of 503s is capped at 20/min/IP at the edge, and the fail-closed 503 cannot be weaponized into unbounded function invocations. Documented as a required Fase-1 deliverable with the exact thresholds above.

---

## 4. Consent constant + copy
```ts
// apps/web/src/app/api/waitlists/consent.ts (server-only)
export const WAITLIST_CONSENT_VERSION = 'launch-notification-v1-2026-06'
```
Scope-accurate copy (registered in `consent_texts`, category `launch_notification`, id `launch_notification:{locale}:{version}`; the exact rendered string is snapshotted into the grant audit row):
- EN: *"Notify me by email when {name} launches. I can unsubscribe anytime."*
- PT: *"Quero ser avisado(a) por email quando {name} for lançado. Posso cancelar quando quiser."*

Checkbox placed immediately below the email field, associated with the input group. Marketing CONSENT phrasing is NOT reused.

---

## 5. Launch broadcast — reusing the SES send pipeline

All references anchor to **`apps/web/src/app/api/cron/send-scheduled-newsletters/route.ts`** (633 lines). Edition state machine `scheduled → sending → sent`; a crash leaves `sending`; stuck-edition recovery (route.ts:69-76) resets `sending → scheduled`. Four `status:'sent'` write sites: ~259, ~333, ~507, ~623.

### 5.1 RecipientSource seam (in-app route, NOT the package)
```ts
interface RecipientSource {
  resolveRecipients(edition): AsyncIterable<{ email: string; locale: string | null }>
  filterEligible(batch: Array<{email:string; ...}>): Promise<Array<...>>  // BATCH-shaped
  resolveUnsubscribe(siteId, email): { raw: string; hash: string }        // passes its own source
  persistUnsubscribeToken(siteId, email): Promise<void>                   // upsert onConflict 'site_id,email,source' + write source
  senderConfig(): SenderConfig                                            // configurationSet + maxSendErrorRatePct + senderEmail (pre-validated)
  templateContext(): TemplateContext                                      // owns ALL type?.* reads
  finalizeStatus(sentCount: number, eligibleCount: number): 'sent' | 'failed'  // single owner of terminal status
}
```
Two impls: `NewsletterRecipientSource` and `WaitlistRecipientSource`. `sendEdition` calls `source.*` instead of inline queries.

**NewsletterRecipientSource refactor checklist (the seam fully replaces inline or isn't merged):**
- **Extend the edition SELECTOR:** add `recipient_source, source_ref_id` to `route.ts:94 .select(...)` AND to the `sendEdition()` edition param type. Typecheck/assertion that the factory receives a non-null `recipient_source`.
- recipient query (route.ts:~242).
- **eligibility re-shaped to BATCH:** `filterEligible(batch)` lets newsletter keep its O(1) Set and waitlist issue one citext `IN`-list query per batch. Query-count assertion verifies newsletter path issues O(1).
- **`senderConfig()` includes `configurationSet` + `maxSendErrorRatePct` + `senderEmail`:** relocate `maxSendErrorRatePct` out of the inline `newsletter_types` query (route.ts:~350) into `senderConfig()`. **Thread `configurationSet` into `attemptSend`'s `metadata.configurationSet` (route.ts:484)** replacing the hardcoded `process.env.SES_MARKETING_CONFIG_SET ?? 'bythiago-marketing'`: newsletter → `env.SES_MARKETING_CONFIG_SET`; waitlist → `env.SES_WAITLIST_CONFIG_SET ?? env.SES_TRANSACTIONAL_CONFIG_SET`. All via typed env at `apps/web/src/lib/env.ts`.
- **`templateContext()` owns ALL `type?.*` reads.**
- **unsubscribe token upsert onConflict → `'site_id,email,source'` + write `source` (route.ts:~383-385).**
- `generateUnsubscribeToken(..., 'newsletter')` explicit.
- `last_sent_at` write + `newsletter-suggestions` revalidation stay behind `recipient_source==='newsletter'`.
- **`finalizeStatus()` is the single owner of terminal edition status** (§5.8).
- **golden-snapshot test** captures exact `newsletter_sends` rows + `send_count` + `status` + token rows (carrying `source`) BEFORE refactor; refactored path reproduces identical rows.
- **STATIC guard:** CI grep/AST check asserts ZERO direct `type?.`/`newsletter_type` reads remain in `route.ts` outside `source.templateContext()`, paired with the e2e render test.

### 5.2 Edition routing
The `route.ts:92-97` selector picks up scheduled waitlist editions. `WaitlistRecipientSource.senderConfig()` reads `sender_name/email/reply_to` from the `waitlists` row (sender_email **re-validated at pre-send**, §5.4), returns constant `maxSendErrorRatePct = 5`, and the config-set from §5.3. Waitlist edition `segment='all'` (semantically inert; in golden fixtures).

### 5.3 Config-set + env
Waitlist broadcasts use **`SES_WAITLIST_CONFIG_SET` if set, else `SES_TRANSACTIONAL_CONFIG_SET`**. **Add `SES_WAITLIST_CONFIG_SET: z.string().optional()` to `apps/web/src/lib/env.ts`.** **Open/click tracking DISABLED on this config-set** (operational deliverable, gap 19). Defense in depth: `processEvent` short-circuits `'opened'`/`'clicked'` for waitlist (§5.7).

### 5.4 Pre-send eligibility — DB-authoritative + sender re-validation (gaps 3 + 13 resolved)
- **Recipient eligibility:** `WaitlistRecipientSource.filterEligible(batch)` = one citext `IN`-list query: `select email from waitlist_signups where waitlist_id = $1 and status = 'pending' and anonymized_at is null and email in (...)` — Postgres citext case-folding, NOT JS `.toLowerCase()`. Bounce/complaint already `suppressed` and excluded.
- **Sender-email RE-VALIDATION at pre-send (gap 3 resolved):** `sender_email` is validated against the site's own domains at SAVE (§6), but a domain could be removed between save and the irreversible launch. Therefore `WaitlistRecipientSource.senderConfig()` (called once at the start of `sendEdition`, before any send) **re-validates `sender_email`'s domain against the current site domain set** (`ringContext().getSite(siteId).domains`). If the domain is no longer in the set, the broadcast is aborted **before fan-out** and `finalizeStatus` returns `'failed'` (the edition never transitions to `sent`), surfacing the Retry affordance — rather than discovering the problem mid-send. This is the pre-send re-validation, not only the save-time check.
- **Known sharp edge (gap 13, documented not silently assumed):** domain-set membership confirms the domain is OWNED but NOT that it is SES-verified. There is no SES-identity API and no pre-flight SES send-test, so a configured-but-not-SES-verified owned domain still fails only at SES send time on this one-shot send. This is an accepted, documented limitation; `finalizeStatus` (§5.8) catches the resulting all-error outcome and marks the edition `failed` (recoverable via Retry), so even this case does not produce a silent `sent`.
- On crash-resume, the queued snapshot is filtered through `filterEligible`, dropping anyone unsubscribed/anonymized/bounce-suppressed between fan-out and resume (§5.8 resume semantics).
- Test fixture with a mixed-case/non-ASCII email asserts eligibility matches citext semantics; a domain-removed fixture asserts pre-send abort → `failed`.

### 5.5 Archive + tracking
Waitlist editions are one-shot transactional sends: no archive link, link-tracking rewrite disabled, open/click disabled (§5.3). Delivery reconciliation still includes waitlist editions — with a **minimum-recipient floor** and **absolute bounce count** (not ratio) for small audiences.

### 5.6 Unsubscribe routing
- Token source-namespaced (§1) → `token_hash` differs per source → no PK collision.
- The List-Unsubscribe URL stays the single `/api/newsletters/unsubscribe` handler; routing happens inside the RPC from the stored `source` (sole routing authority).
- **`unsubscribe_via_token` extended on the HARDENED version** (`set search_path=''`, `20260608000002`):
  ```sql
  if v_tok.source = 'waitlist' then
    update public.waitlist_signups
      set status='suppressed', suppressed_at=now(), suppression_reason='unsubscribe',
          ip=null, user_agent=null, locale=null
      where site_id = v_tok.site_id and email = v_tok.email and status <> 'suppressed';
  else
    -- existing newsletter flip-then-hash behavior, unchanged
  end if;
  ```
  **Idempotency + no oracle:** the `status <> 'suppressed'` guard makes a repeat unsubscribe a no-op; an invalid/unknown `token_hash` returns the **same generic neutral response** as a valid-but-used token. HMAC-256 makes brute force infeasible. (The DSAR endpoint §2.5 reuses this exact no-oracle pattern.)

### 5.7 SES webhook recipient-source awareness
**Single prerequisite:** extend the `processEvent` `newsletter_editions` select (currently `'id, edition_id, subscriber_email, link_rewrite_enabled, newsletter_editions(site_id, newsletter_type_id)'`, route.ts:207) to also select `recipient_source, source_ref_id`.
- `recipient_source==='waitlist'`: hard bounce → `waitlist_signups` `status='suppressed', suppressed_at=now(), suppression_reason='bounce', ip=null, user_agent=null, locale=null` for `(waitlist_id=source_ref_id, email)` filtered by **both** keys; complaint → same with `'complaint'`. **DO NOT touch `newsletter_subscriptions`.**
- `'opened'`/`'clicked'` short-circuit for waitlist.
- **`'delivered'` PERMITTED for waitlist** (writes only `delivered_at`) so reconciliation works.
- `recipient_source==='newsletter'`: unchanged.

### 5.8 Broadcast trigger, single-owner terminal status, crash-resume, failure recovery
- **Broadcast** creates one `newsletter_editions` row (`recipient_source='waitlist'`, `source_ref_id=waitlist_id`, `segment='all'`, `status='scheduled'`, `scheduled_at=now()`) and flips the waitlist via **CAS to `launching`**: `update waitlists set status='launching' where id=$1 and status in ('open','closed')` → 0 rows ⇒ idempotent no-op. The partial unique index blocks a second non-failed/non-cancelled edition.
- **`finalizeStatus()` is the SINGLE owner of terminal edition status.** The generic route holds ZERO waitlist conditionals. `WaitlistRecipientSource.finalizeStatus`:
  - `eligibleCount === 0` → **`'failed'`** (overrides the route's empty-subscriber `'sent'` at ~259).
  - `sentCount < eligibleCount` (after all retry passes) → **`'failed'`** (partial failure, independent of the `>=10` breaker).
  - `sentCount === eligibleCount && eligibleCount > 0` → `'sent'`.
  `NewsletterRecipientSource.finalizeStatus` reproduces the legacy decision. **All FOUR sent-write sites route their final status through `finalizeStatus`.**
- **Crash-resume "fewer-eligible-than-fanned-out" semantics + test (gap 10 resolved):** when a send crashes after partial fan-out and resumes, the queued snapshot is re-filtered through `filterEligible`, so recipients who unsubscribed/anonymized/bounce-suppressed between fan-out and resume are dropped — `eligibleCount` on resume is the **re-filtered** count, which may be **fewer than the number of `newsletter_sends` rows already written** during the pre-crash fan-out. Specified behavior, mirroring the newsletter path: **the already-written `newsletter_sends` rows for now-ineligible recipients are LEFT AS-IS (queued/NULL status) as an audit record — they are NOT deleted and NOT re-sent.** `finalizeStatus(sentCount, eligibleCount)` is then evaluated against the **re-filtered `eligibleCount`**, so a resume where `sentCount === eligibleCount` (every still-eligible recipient was sent) correctly yields `'sent'` even though some pre-crash `newsletter_sends` rows exist for recipients now excluded; and the mid-path completion site (~507) routes through `finalizeStatus` identically to the other three sites so no path can mark a partial-but-complete-over-eligible resume incorrectly. **Explicit integration test:** fan out N recipients, simulate `sending→scheduled` crash reset, unsubscribe one recipient, resume; assert (a) the unsubscribed recipient's stale `newsletter_sends` row is untouched, (b) `eligibleCount` excludes them, (c) `finalizeStatus` returns `'sent'` when all remaining eligible were sent, and (d) the waitlist transitions `launched` via the trigger.
- **Lifecycle flip OWNER = DB trigger** on `newsletter_editions.status` (crash-safe):
  ```sql
  create or replace function public.sync_waitlist_on_edition_status() returns trigger
    language plpgsql security definer set search_path = '' as $$
  begin
    if new.recipient_source = 'waitlist' and new.source_ref_id is not null
       and new.status is distinct from old.status then
      if new.status = 'sent' then
        update public.waitlists set status='launched', launched_at=now()
          where id = new.source_ref_id and status = 'launching';
      elsif new.status = 'failed' then
        update public.waitlists set status='failed'
          where id = new.source_ref_id and status = 'launching';
      end if;
    end if;
    return new;
  end $$;
  drop trigger if exists trg_sync_waitlist_on_edition_status on public.newsletter_editions;
  create trigger trg_sync_waitlist_on_edition_status
    after update of status on public.newsletter_editions
    for each row execute function public.sync_waitlist_on_edition_status();
  ```
- **Stuck-launching watchdog.** The trigger fires only on `sent`/`failed`. A crash mid-send resets the edition `sending → scheduled` (route.ts:75), which retries fine — but the waitlist stays `launching`. The always-on retention cron runs a watchdog: **if `waitlist.status='launching'` for `> STUCK_LAUNCHING_HOURS` (6h) AND no associated edition is in `scheduled`/`sending`/`sent`, flip the waitlist to `failed`** so Resume/Retry becomes reachable. A still-`scheduled` edition leaves the waitlist `launching` (next cron resumes). Integration test: simulate `sending→scheduled` reset and assert recoverability; simulate orphaned `launching` and assert watchdog flips to `failed`.
- **`failed` recovery (FK-safe per gap 12):** CMS surfaces a **Resume/Retry** action reverting `failed → closed` and **deleting the failed edition** — which is safe even with dependent `newsletter_sends` rows because `newsletter_sends.edition_id` is `ON DELETE CASCADE` (schema.sql:2891-2892); the cascade removes the sends automatically with no FK error. The partial index excludes `failed`, so a fresh edition can be created.
- **WaitlistRecipientSource tolerance:** missing/deleted waitlist mid-send → `resolveRecipients`/`filterEligible` yield empty, Sentry warns, never throws.
- **Seam-tax guard:** all waitlist branching is in the two impls; route holds zero waitlist conditionals (static guard).
- Broadcast action requires **publish-class auth** (§6) + the §6 typed-confirmation server contract.

---

## 6. CMS surface

Lives at `app/cms/(authed)/waitlists/`, consistent with `campaigns`/`contacts`/`newsletters`.

### Authorization — the REAL convention
- read/list/export: `requireSiteScope({ area:'cms', siteId, mode:'view' })` (export) / `'edit'` (mutations), `if (!res.ok) return { error:'forbidden' }`.
- **Broadcast action: `requireSiteScope({ area:'cms', siteId, mode:'publish' })`** (verified → `can_publish_site`). Test: editor-without-publish rejected at the broadcast **server action**.
- CI grep guard asserts every waitlist `requireSiteScope` call is immediately followed by an `!ok` check (does NOT forbid the call).

### List page
`force-dynamic` + `loading.tsx`; columns: name, status badge (six EN labels + colors), signup count (single grouped `count` query), resolved linked-campaign title, empty-state copy. Default sort `updated_at desc`. Reused `StatusBadge` MUST be parameterized (no inherited pt-BR labels). Broadcast button reads a fresh server-side count at action time.

### Status transitions — discrete guarded actions
Edit form rejects status mutation via `STATUS_TRANSITION_KEYS` guard (`status_transition_rejected`). Discrete buttons + CAS: `draft→open`, `open↔closed`, `(open|closed)→launching` (broadcast only). Status-control strip on detail page; disabled-states per current status. **CAS 0-rows returns `status_changed`** + visible "Status changed — refresh to continue".

### Create/Edit form spec
1. `name` (required) — slug auto-slugify on blur.
2. `slug` (required, editable) — both create AND slug-mutating edit catch `23505` → `slug_taken` (the catch wraps the INSERT/UPDATE itself, not a TOCTOU pre-SELECT). Concurrent-create test.
3. `description` (optional).
4. `intro_mdx` (optional) — CMS MDX/TipTap editor + sanitize path.
5. `campaign_id` (optional) — searchable select with explicit "None"; resolved title; "No linked campaign" when null/deleted.
6. `sender_name` / `sender_email` / `reply_to` (optional).
- Inline field-error contract; Save/Cancel + unsaved-changes guard.
- **Sender validation (save-time):** no SES verified-identity API exists; `getEmailSender` returns one `noreply@{primaryDomain}`. Validate `sender_email` against the site's own domains (`ringContext().getSite(siteId).domains`) at save, field-level error. **Re-validated again at pre-send (§5.4).** Editor notes a send-time SES rejection is still possible for a configured-but-not-SES-verified owned domain (documented sharp edge, gap 13).

### Signups list — server-side query
Server component applies status + email filters AND pagination in the Supabase query:
```
.eq('waitlist_id', id).eq('site_id', siteId)
[.eq('status', statusFilter)]
[.ilike('email', q + '%')]               // prefix search; citext folds case at the DB
```
- **Single pagination mechanism = keyset/cursor on `(created_at desc, id)` with Next/Prev only** plus an approximate `count()`. Client does NOT re-filter. Test: a matching email on a later page is found from the first page.
- Columns: email, status, suppression_reason, source_surface, created_at.

### CSV export
- Export dialog: Status filter, optional date range, "Exclude suppressed" toggle.
- Columns: `email, status, suppression_reason, source_surface, locale, created_at`. Anonymized rows OMITTED.
- Filename `waitlist-{slug}-{YYYY-MM-DD}.csv`. Row cap + over-cap streaming Route Handler affordance (same `requireSiteScope({mode:'view'})`). Below cap: server action → Blob → synthetic `<a download>`.
- **IDOR closed:** resolve `.eq('id',waitlistId).eq('site_id',siteId).maybeSingle()` → 404 if not owned, THEN query signups with BOTH `.eq('site_id',siteId)` AND `.eq('waitlist_id',waitlistId)`.
- **`escapeCsv` extraction is a STANDALONE PREP commit BEFORE Fase-1 feature code:** extract `contacts/actions.ts:275` closure into `apps/web/lib/cms/csv.ts` with formula-injection hardening (prefix cells starting with `=`,`+`,`-`,`@`,tab,CR with `'`) + RFC-4180 quoting; refactor contacts to import it; ship with regression + `=HYPERLINK(...)` neutralization tests.

### Broadcast confirmation dialog — confirm token = UNIQUE slug (gap 4 resolved)
Server contract reuses `newsletters/actions.ts` `requires_confirmation`/`confirm_text_mismatch` (verified ~1180-1215). The action accepts `{ confirmed, confirmText }` and **re-validates `confirmText === waitlist.slug` (case/trim-normalized) AND fresh `recipientCount > 0` server-side** before sending.
- **Why slug, not name:** `(site_id, slug)` is UNIQUE while `name` is NOT, so two waitlists on a site can share a `name`; using the **`slug`** as the typed-confirmation token guarantees the operator-facing safety token is unambiguous and non-duplicable. (This is a deliberate divergence from the newsletters precedent, which types the subject; the subject is non-unique there, so the waitlist surface improves on it.)
- Client dialog: Heading "Launch {name}?"; Body "This sends one email to **N** recipients and cannot be undone."; **Confirm token = the waitlist `slug`** (shown verbatim to copy, disabled-until-match); live recipient count (fresh at open + re-validated at submit); 0-count disables with "No eligible recipients"; dangling campaign → warn, do NOT block; post-submit "Launching…" → `launching` badge → Retry on failure.

### Delete guard
Rejects (`409 waitlist_send_in_flight`) when an associated edition is `status in ('scheduled','launching')` OR `waitlist.status='launching'`. Because `source_ref_id` is `ON DELETE RESTRICT`, a waitlist with ANY persisted edition (incl. `sent`/`failed`) cannot be hard-deleted — rejected with "this waitlist has a broadcast history and cannot be deleted". Tests: delete during `launching` rejected; delete of a launched waitlist with a `sent` edition rejected (no CHECK violation).

### Nav badge
Extend `fetchLayoutCountsInner` with two actionable counts: `failed`-state waitlists + `launching`-stuck waitlists past the watchdog threshold. `unstable_cache` `revalidate:60`; write actions may `revalidateTag('layout-counts')`.

### CMS copy language
English-first; adjacent pt-BR dialogs non-blocking until the broader CMS-EN migration.

---

## 7. Three public surfaces — one shared form

**Single shared client component `<WaitlistSignupForm slug locale variant>`** owns the state machine, Turnstile mount, accessibility, status→copy mapping, and the POST. Precedent: `ad-inquiry-form.tsx` / `newsletter-signup.tsx` (NOT `contact-form.tsx`, which redirects).

### Mount-GET lifecycle
On mount the islands `GET /api/waitlists/[slug]`. States for ALL surfaces: loading (`aria-busy`), loaded-open (form), loaded-closed/launched (message block only, `role='status'`), unavailable (GET 404 → stable copy), transient-error (5xx/network → retry control). The hosted page resolves server-side (no flash); embed/TipTap resolve client-side; the form is never shown-then-yanked.

### Status → copy mapping
| State | EN | PT |
|---|---|---|
| idle | (form) | (form) |
| submitting | "Sending…" | "Enviando…" |
| success | `success_*` + "We'll email you once — unsubscribe anytime." | `success_*` + "Enviaremos um único email — cancele quando quiser." |
| duplicate-success | `duplicate_*` + same expectation line | `duplicate_*` + idem |
| closed | `closed_message` | `closed_message` |
| launched | `launched_message` | `launched_message` |
| error (retryable) | "Something went wrong. Please try again." | "Algo deu errado. Tente novamente." |
| rate-limited (429) | "Too many attempts. Please wait a moment." | "Muitas tentativas. Aguarde um instante." |
| 409-race | "This waitlist just closed." | "Esta lista acabou de fechar." |
| 503 fail-closed | "Temporarily unavailable, please try again shortly." | "Temporariamente indisponível, tente em instantes." |
All strings in `FORM_STRINGS` (pt-BR + en) as fallback.

### Accessibility & success rendering
- Success/duplicate renders IN PLACE on all three surfaces — never `router.push`.
- Result container `role='status' aria-live='polite' tabIndex={-1}`.
- Iframe-safe focus: focus moves to the result container only after a user-initiated submit, via `focus({ preventScroll:true })`; embed never autofocuses on mount. On retryable errors focus moves to the email input; error region `role='alert'`.
- Turnstile disabled-until-token (`disabled={!token || loading}`, `aria-describedby`). No-key dev mode when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` empty; server still rejects in non-dev (§3 503 makes the bypass provably unreachable in preview/prod).
- Missing-consent client rejection does NOT reset the Turnstile token.
- Email input `type='email' inputMode='email' autoComplete='email' autoCapitalize='none' autoCorrect='off' spellCheck={false}` + `required` + `maxLength`; inline `aria-invalid`/`aria-describedby` on blur/submit.
- Reduced motion honored; resize `postMessage` fires AFTER the DOM swap.

### Surfaces
1. **Hosted landing page:** `app/(public)/waitlists/[slug]/page.tsx` — server component, direct host→site lookup, resolves `(slug, x-locale)`. Respects status server-side.
2. **Embeddable block:** `app/embed/waitlists/[slug]/page.tsx`.
   - **Framing headers + FULL CSP re-emit (gaps 16 resolved):** `next.config.ts` globally sets `X-Frame-Options: DENY` AND a single `Content-Security-Policy` header bundling ~12 directives. Header values do NOT merge per-directive, so the embed override MUST **re-emit the ENTIRE CSP string** — every directive (`default-src`, `script-src` including `challenges.cloudflare.com`, `style-src`, `img-src`, `connect-src`, `font-src`, `frame-src`, `base-uri`, `form-action`, `object-src`, etc.) — with ONLY `frame-ancestors` relaxed; a partial override would silently drop Turnstile's `script-src` and break the captcha. Implementation: **restructure the global `headers()` source to EXCLUDE `/embed` via a negative-lookahead pattern**, then add a dedicated `headers()` entry for `/embed/waitlists/:path*` that (a) emits NO `X-Frame-Options` at all (modern browsers dropped `ALLOW-FROM`, so XFO cannot allow a third-party), and (b) emits the **complete CSP string copied from the global config with `frame-ancestors` changed** from `'none'` to the documented allow-list. **Header-assertion test:** the embed route returns NO `X-Frame-Options: DENY`, a `frame-ancestors` that is not `'none'`, AND a `script-src` that still contains `challenges.cloudflare.com` (proving the full re-emit preserved Turnstile).
   - **Sizing contract:** namespaced message `{ type:'waitlist:resize', height }` posted with a configured `targetOrigin` (`'*'` only as documented opt-in). Height broadcast on mount AND via `ResizeObserver`. Ship a copy-paste host-side resize listener snippet + the `<iframe>` snippet (`width`/`min-height`/`loading="lazy"`).
   - **Theming:** accent via `?accent=` validated against `^#[0-9a-fA-F]{6}$` before binding to a CSS var; invalid → site default. `color-mix()` avoided for load-bearing chrome.
3. **TipTap / MDX node (gap 5 resolved against verified facts — TWO distinct pipelines):**
   The codebase has **two separate content pipelines** and WaitlistForm registration differs per path. There is **NO component allowlist** in either; the difference is which compiler/serialization runs.
   - **Decision: persist WaitlistForm via the MDX (`content_mdx`) path, NOT the JSON (`content_html`) path.** Rationale, per verified facts: the JSON path (`compileJsonContent()` in `compile-json.ts`) serializes TipTap nodes to **static HTML** stored in `content_html` and rendered via `BlogArticleHtml` → `DOMPurify.sanitize()` + `dangerouslySetInnerHTML` (blog-article-html.tsx:21). That path has a **finite 31-case switch** (compile-json.ts:122-178); any node type not explicitly cased falls through the default (lines 172-177) and is **silently dropped** (this is exactly why `playlistEmbed` and `blogImage` would vanish if compiled via JSON). A WaitlistForm on the JSON path could only be **static markup** with client hydration via the `EmbedHydrator` pattern (blog-article-html.tsx:16-18) — workable but it discards the interactive React form. Since WaitlistForm IS an interactive React island, **the MDX path is the correct choice.**
   - **MDX-path registration (the chosen path):** WaitlistForm is a `'use client'` React component **registered in `blogRegistry`** (`apps/web/lib/cms/registry.tsx`), which is the `ComponentRegistry` consumed ONLY by the MDX render path (`compileMdx(tx.content_mdx, blogRegistry)`, page.tsx:127; `<MdxRunner compiledSource registry={blogRegistry} />`). The TipTap node (`Node.create`, following `pipeline-image-node.tsx`) **must serialize to an MDX JSX component reference `<WaitlistForm slug="…" />`** (NOT inlined HTML) so `compile()` emits a reference that `run(blogRegistry)` resolves. Because the registry is a plain key→component map with no allowlist gate, adding the `WaitlistForm` key is the entire registration step on the render side. The post must be persisted as `content_mdx` (not `content_json`→`content_html`) for this node.
   - **If a research surface later needs this node:** there is no research registry today; either render the research MDX through `blogRegistry` or create a research registry mirroring it — a Fase-3 decision, but no allowlist work is required either way.
   - **Round-trip test (Fase-3 gate):** author → TipTap serialize to `<WaitlistForm slug="…" />` → `compile()` to `content_mdx`/`content_compiled` → `run(blogRegistry)` → island mounts and the mount-GET lifecycle runs. Verifies the node emits a JSX component element (not dropped) and that `blogRegistry` resolves it. Missing/deleted-slug → the mount-GET 404 renders "unavailable" copy. Turnstile mounts under the same page CSP (multiple forms per page supported).

**Package boundary:** everything in `apps/web`, not `@tn-figueiredo/cms` — depends on app-local SES route, `getSiteContext`, app RLS helpers, Turnstile env, `blogRegistry`. Extract after a second consumer.

---

## 8. Phasing

- **Prep commit (before Fase 1):** `escapeCsv` extraction to `apps/web/lib/cms/csv.ts` + `contacts/actions.ts` refactor + regression + formula-injection unit test.
- **Fase 1 (ships alone, NO send-pipeline changes):** `waitlists` + `waitlist_signups` (composite FK + suppression_reason + email-len CHECK + consent_grant_at + `(site_id,status,created_at)` partial index) + `waitlist_translations` + RLS (NO anon-insert policy); `waitlist_signup` (FOR UPDATE branching, direct-INSERT audit with explicit ip/ua) + `waitlist_rate_check` RPCs (`search_path=''`, anon-only EXECUTE, fail-closed); **Vercel WAF rate-limit rule (concrete §3.1 spec)**; `GET` (site-scope-pinned) + `POST` (Turnstile 503 non-dev assertion) endpoints; **per-email DSAR export endpoint (§2.5)**; hosted landing page + shared `<WaitlistSignupForm>` (full mount-GET lifecycle + copy table); CMS create/edit + discrete status actions (CAS 0-row message) + signups list (server-side keyset query) + CSV export (export dialog + IDOR guard, consuming prep helper); `fetchLayoutCounts` extension (failed + stuck-launching); `consent_texts` seed (id convention `launch_notification:{locale}:{version}`) + CI version-resolution invariant + consent-text snapshot in audit; `lgpd_phase1_cleanup` RPC migration (waitlist branch, inherited `'public'` search_path documented, existing caller guard KEPT) + `collectUserData` (narrowed projection) + pre-capture (server-derived emails) + dedicated always-on retention-sweep route (GET=POST, per-site iteration, explicit windows, PASS-2 ip/ua idempotency guard, last-run observability, stuck-launching watchdog) + **Vercel cron schedule entry**; consent-grant/withdrawal/resurrect audit rows (correct uuid mapping, append-only verified); no-PII-to-Sentry scrub; DPO/legal sign-off note (single-opt-in posture + retention schedule + anonymous-member DSAR residual). **Fase-1 invariant:** `recipient_source` is a Fase-2 migration, so no `newsletter_editions` waitlist row can exist before Fase 2; bounce/complaint sweep branches are dead-but-harmless until Fase 2 (structurally enforced).
- **Fase 2 (higher-risk live send path):** `RecipientSource` seam refactor (edition selector + sendEdition param type + batch `filterEligible` + `templateContext` for all `type?.*` + `finalizeStatus` single-owner at all four sent-write sites + **crash-resume fewer-eligible semantics + test** + config-set threading at attemptSend:484 + token upsert onConflict change + **sender-email pre-send re-validation** + golden-snapshot + STATIC type?.* grep guard); `newsletter_editions` schema extension (RESTRICT FK, index excludes failed+cancelled); source-namespaced `generateUnsubscribeToken` + `unsubscribe_tokens` migration + hardened `unsubscribe_via_token` extension (idempotent, no-oracle); SES webhook recipient-source awareness (single select-extension); broadcast action (server-authoritative typed confirm on **slug** + `requireSiteScope({mode:'publish'})`) + `launching`/`failed` lifecycle trigger + watchdog reachability + delete guard (RESTRICT-aware) + recovery (FK-CASCADE-safe edition delete); `SES_WAITLIST_CONFIG_SET` env + tracking disabled (operational).
- **Fase 3 (additive surfaces):** embed route (framing-header override + **FULL CSP re-emit** + postMessage/ResizeObserver sizing + host listener snippet + accent validation) + TipTap/MDX node (**MDX-path registration in `blogRegistry`** + JSX-reference serialization + round-trip test gate; research-registry decision).

Each phase is independently deployable; no phase leaves the send pipeline half-migrated.

---

## 9. Testing & observability
- **Unit:** signup RPC (FOR UPDATE branching: duplicate, resurrect-after-unsubscribe with `consent_regranted` audit + non-null ip/ua + `consent_grant_at` refresh, refuse-resurrect for bounce/complaint returns `duplicate:true`, closed-list reject, site_id re-derived/spoof-ignored, concurrent ordering); rate-check fail-CLOSED on RPC error; `unsubscribe_via_token` source-routing both ways + divergent retention + idempotent already-used + unknown-token no-oracle; status-transition CAS + 0-row `status_changed`; shared `escapeCsv` formula-injection; token HMAC distinct-per-source + newsletter golden-hash regression + case-insensitive round-trip + write-time invariant `token_hash == sha256(hmac(namespaced-message-for(stored source)))`.
- **Integration (`HAS_LOCAL_DB`):** anon cannot read `waitlist_signups`; direct anon INSERT RLS-denied; cannot read draft/launching/failed `waitlists`; POST to draft slug under service client → 404; composite-FK rejects site_id desync; same slug on two sites returns each site's own list; Turnstile missing-secret non-dev → 503; **audit row is immutable (UPDATE/DELETE as `authenticated` denied)**; **DSAR endpoint: valid waitlist token returns own rows only (ip/ua excluded), unknown/used token = generic neutral, newsletter token does not resolve waitlist data, cross-email isolation**; erasure-injection (authenticated non-owner cannot anonymize another user's emails; anon rejected); dual-membership unsubscribe; SES webhook bounce routes by `recipient_source` + `suppression_reason='bounce'` + bounce-suppressed re-signup NOT resurrected; cross-ring + cross-list export → 404; broadcast CAS idempotency; editor-without-publish rejected at broadcast server action; anonymization eligibility (never anonymizes pending-on-open); **PASS-2 ip/ua idempotency (second sweep affects 0 rows)**; lifecycle trigger (sent⇒launched; failed⇒failed); crash-recovery: sending→scheduled reset leaves recoverable, watchdog flips orphaned launching→failed; **crash-resume fewer-eligible: stale newsletter_sends untouched, eligibleCount excludes unsubscribed, finalizeStatus='sent', waitlist→launched**; **failed-edition delete succeeds with dependent newsletter_sends cascade-deleted**; delete-during-launching rejected + delete of launched waitlist with sent edition rejected; concurrent-create slug → one success + one `slug_taken`; signups search across pages; CI grep guard (every waitlist `requireSiteScope` has `!ok`).
- **Send-pipeline:** `WaitlistRecipientSource` DB-authoritative citext (mixed-case/non-ASCII); query-count assertion newsletter eligibility O(1); config-set threaded to attemptSend metadata; **sender-email pre-send re-validation: domain removed between save and send → broadcast aborts pre-fanout → finalizeStatus='failed'**; no-archive-link + open/click short-circuit + delivered permitted; missing-waitlist tolerance (no throw); end-to-end waitlist-edition render (no NULL-type access) + STATIC grep guard; `finalizeStatus`: zero-eligible → failed, all-error tiny-list → failed, partial-failure sub-10 → failed, covering all four sent-write sites; golden-snapshot for the newsletter refactor (rows + send_count + status + token-with-source + segment='all').
- **LGPD:** `lgpd_phase1_cleanup` erases `waitlist_signups` (authenticated-email subset) with inherited `'public'` search_path + existing caller guard intact; `collectUserData` includes memberships, ip/ua EXCLUDED; retention sweep anonymizes per windows (per-site) + bounce/complaint survives spent-consent; consent-text snapshot present in grant audit; no email/ip/ua reaches Sentry; CI invariant `WAITLIST_CONSENT_VERSION` resolves per locale by the id convention.
- **Public-UX:** mount-GET lifecycle (loading/open/closed/launched/unavailable/transient-error) with retry; in-place success on all surfaces; missing-consent does not reset Turnstile; disabled-until-token + no-key dev fallback unreachable in non-dev; **embed header test (no XFO DENY, frame-ancestors not 'none', script-src still contains challenges.cloudflare.com — full CSP re-emit verified)**; postMessage targetOrigin + ResizeObserver; accent validation rejects non-hex; iframe focus({preventScroll}) only after submit.
- **Observability:** `source_surface` funnel (count-only); Sentry tag `component:'waitlist'`; Sentry warning on 0-eligible at broadcast-trigger + Sentry ERROR for waitlists pinned in `launching` past the watchdog threshold; low-delivery alert gated by minimum-recipient floor + absolute bounce count; retention-sweep last-run timestamp + Sentry breadcrumb; nav counts for `failed` + stuck-`launching`.

---

## 10. Where critics conflicted / chose (delta from v4)
- **Sweep iteration:** chose **per-site iteration** (justifies the `(site_id,status,created_at)` leading column) over a site-agnostic single UPDATE.
- **IP/UA pass:** PASS 2 does NOT set `anonymized_at`; added the `(ip is not null or user_agent is not null)` **idempotency guard** so long-lived pending rows never produce no-op churn.
- **Sender domain:** validated at save AND **re-validated at pre-send** (before fan-out); domain-removed → abort → `failed`. SES-verification-vs-ownership gap documented, caught by `finalizeStatus`.
- **Confirm token:** the **UNIQUE `slug`**, not the duplicable `name` — improves on the newsletters-subject precedent.
- **TipTap/MDX:** pinned to verified facts — two pipelines, **chose the MDX (`content_mdx`) path + `blogRegistry` registration + JSX-reference serialization** (the JSON path would silently drop or de-interactivize the node); no allowlist exists either way.
- **WAF rule:** concrete spec — POST to `/api/waitlists/:slug/signup` (covers all three surfaces), 20/IP/60s + 100/IP/1h, edge rate-limit (not block); resolves the fail-closed-503 soft-DoS by throttling the request before the function runs.
- **Audit append-only:** pinned — direct `audit_log` INSERT (AuditLogLgpdRepository pattern) with explicit ip/ua columns; append-only guaranteed by RLS (3 SELECT policies, no UPDATE/DELETE policy/grant).
- **Art. 18 anonymous DSAR:** **added a shipped token-gated per-email export endpoint** reusing the unsubscribe-token + no-oracle machinery — converts the prior "documented limitation" into a technical control.
- **Single-opt-in residual:** mitigation now leans on technical controls (ORPHAN/IP_UA windows + DSAR endpoint + one-click unsub), with DPO sign-off documenting the *residual* posture.
- **Crash-resume fewer-eligible:** specified (stale `newsletter_sends` left as audit, `eligibleCount` re-filtered, `finalizeStatus` evaluated against it) + explicit test.
- **Failed-edition delete:** confirmed FK-safe via `newsletter_sends.edition_id ON DELETE CASCADE`.
- **lgpd_phase1_cleanup:** documented inherited `'public'` search_path + KEPT the existing self-targeting caller guard (did NOT tighten to service_role-only) to avoid locking out authenticated self-erasure/export.
- **Preamble corrections:** newsletter anon-INSERT policy contrast corrected to the VERIFIED truth (`status='pending_confirmation' AND site_visible(site_id)` per migration `20260603000001` — the v5 "no status/site_visible" claim was wrong and is reverted); citation anchoring note added (schema.sql = `migrations/20260507000001_schema.sql`, line numbers may be offset from the backup dump); `consent_texts.id` seed convention pinned.