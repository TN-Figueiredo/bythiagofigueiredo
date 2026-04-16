# LGPD Request Handling Runbook

**Last updated:** 2026-04-16
**Owner:** Thiago Figueiredo (Controller + informal DPO)
**Scope:** bythiagofigueiredo.com — blog + CMS multi-site
**Related spec:** [`docs/superpowers/specs/2026-04-16-sprint-5a-lgpd-compliance-design.md`](../superpowers/specs/2026-04-16-sprint-5a-lgpd-compliance-design.md)

> This runbook is designed to be followed **under stress** during a live ANPD incident or data subject request. Clarity beats comprehensiveness. If a step is ambiguous, stop and escalate before guessing.

---

## 1. Overview

bythiagofigueiredo.com is operated solo by Thiago Figueiredo, who acts as both the **data controller** under LGPD (Law 13.709/2018) and the informal **DPO (Encarregado)**. All LGPD rights requests — access, deletion, rectification, portability, consent withdrawal — route through `privacidade@bythiagofigueiredo.com` and are tracked in the `lgpd_requests` table.

Deletion uses a **3-phase lifecycle** to reconcile LGPD Art. 18 VI ("right to deletion") with Art. 16 ("data retention obligation for regulatory/legal defense"):

- **Phase 1 — Immediate soft-anonymize (T+0):** On user confirmation, PII is nulled/pseudonymized in newsletter/contact rows; content ownership (`blog_posts.owner_user_id`, `campaigns.owner_user_id`) is reassigned to a master_ring `org_admin`; `authors.user_id` is nulled; session tokens revoked via `auth.admin.updateUserById(id, { ban_duration: 'infinite' })`; the `lgpd_requests` row advances to `status = 'processing'`, `phase = 1`, with `phase_1_completed_at` set and `scheduled_purge_at = now() + 15 days`. This phase is idempotent and reversible within a 15-day cancellation window.
- **Phase 2 — Quiet period (T+0 to T+15):** No-op (`phase2DelayDays: 0` in config). The row sits in `lgpd_requests` awaiting either user cancellation (`cancel_account_deletion_in_grace(token_hash)` → `status = 'cancelled'`) or cron promotion to phase 3. Login is blocked via `banned_until = 'infinity'`.
- **Phase 3 — Hard delete (T+15, cron `/api/cron/lgpd-cleanup-sweep`):** Attempts `auth.admin.deleteUser(id)`. If FKs block removal, the row soft-completes with `status = 'completed_soft'` (effective deletion via anonymization). On success, `status = 'completed'`, `phase = 3`, `phase_3_completed_at` set. Export blobs older than 7 days are deleted in the same sweep (`blob_deleted_at` stamped). No recovery after this point.

The `lgpd_requests` table carries: `id`, `user_id`, `type` (`data_export` | `account_deletion` | `consent_revocation`), `status` (`pending` | `processing` | `completed` | `completed_soft` | `cancelled` | `failed`), `phase` (1–3), `confirmation_token_hash`, `requested_at`, `confirmed_at`, `scheduled_purge_at`, `phase_1_completed_at`, `phase_3_completed_at`, `completed_at`, `cancelled_at`, `blob_path`, `blob_uploaded_at`, `blob_deleted_at`, `metadata` (jsonb: `pre_capture`, `retry_count`, `notes`, `last_error`). Thiago is the sole reviewer and sign-off authority; there is no second-person control.

> **Note on data-subject-rights request types not tracked in `lgpd_requests`:** Access and rectification requests arrive via `privacidade@bythiagofigueiredo.com` and are handled manually (see §3) — they are **not** persisted as rows in `lgpd_requests`. That table is restricted by CHECK constraint to the three automated flows above. For audit purposes, manual handling of access/rectification is logged in `metadata.notes` of a related row when one exists, or otherwise only in the inbox thread.

---

## 2. ANPD Letter Response (SLA: 15 business days)

When a letter arrives from the **Autoridade Nacional de Proteção de Dados** (postal or `comunicacao@anpd.gov.br`), treat it as a P0 — ANPD SLA is 15 business days from receipt.

### 2.1 Acknowledgment (within 48 hours)

1. Scan/photograph the letter; store in the private `anpd-correspondence/` bucket (Supabase Storage, admin-only RLS).
2. Reply from `privacidade@bythiagofigueiredo.com` with the following template:

```
Prezados,

Confirmamos o recebimento do ofício [NÚMERO DO OFÍCIO] em [DATA] às [HORA] (horário de Brasília).
Estamos diligenciando internamente e retornaremos com resposta formal dentro do prazo regulamentar
de 15 dias úteis, conforme Art. 37 da LGPD.

Dados do controlador:
- Razão: Thiago Figueiredo (pessoa física — operador individual)
- Contato DPO: privacidade@bythiagofigueiredo.com

Atenciosamente,
Thiago Figueiredo
Encarregado pelo Tratamento de Dados Pessoais
```

3. Create a tracking note in the `privacidade@bythiagofigueiredo.com` inbox with label `anpd-oficio` containing the ofício number + deadline. The `lgpd_requests` table does **not** support an `anpd_inquiry` row type (CHECK constraint restricts `type` to `data_export`/`account_deletion`/`consent_revocation`). If a specific user row exists for the ANPD subject, append the ofício number to that row's `metadata.notes` in `/admin/lgpd-requests`.

### 2.2 Subject identification

The letter will reference either a CPF (not stored in our DB — no CPF column currently exists) or an email. Resolve to `user_id`:

```sql
-- By email
SELECT id, email, created_at, last_sign_in_at, banned_until
FROM auth.users
WHERE lower(email) = lower('<email-from-letter>');
```

CPF resolution is not available — we do not persist CPF. If the ofício references only a CPF, reply requesting an email identifier, citing LGPD Art. 9 (data minimization).

If no match: reply stating no data found under the provided identifiers, request clarification, and log in `metadata.notes`.

### 2.3 Evidence gathering

Run all three queries and save output as CSV in `anpd-correspondence/<oficio>/evidence/`:

```sql
-- All LGPD requests by user (includes deletion/export/access history)
SELECT * FROM lgpd_requests
WHERE user_id = '<uuid>'
ORDER BY requested_at DESC;

-- Full lifecycle audit trail (who did what to this user's records)
SELECT * FROM audit_log
WHERE (resource_type = 'auth_user' AND resource_id = '<uuid>')
   OR actor_user_id = '<uuid>'
ORDER BY created_at DESC;

-- Consent history (banner clicks, policy acceptance, marketing opt-ins)
SELECT * FROM consents
WHERE user_id = '<uuid>'
ORDER BY granted_at DESC;
```

Supplementary if the inquiry references content:

```sql
-- Blog posts owned or authored by the user.
-- Post-deletion, `owner_user_id` is reassigned to a master_admin and the
-- authors.user_id pointer is nulled (we do NOT carry a legacy_author_id
-- column). Pre-capture snapshot of authorship lives in
-- lgpd_requests.metadata.pre_capture for deletion requests.
SELECT bp.id, bp.site_id, bp.status, bp.created_at, bp.owner_user_id,
       a.id AS author_id, a.user_id AS author_user_id, a.name AS author_name
FROM blog_posts bp
LEFT JOIN authors a ON a.id = bp.author_id
WHERE bp.owner_user_id = '<uuid>'
   OR a.user_id = '<uuid>';

-- Campaigns owned by the user
SELECT id, site_id, status, created_at, owner_user_id
FROM campaigns
WHERE owner_user_id = '<uuid>';
```

### 2.4 Response drafting checklist

- [ ] Cite the ofício number and date in the subject line.
- [ ] State legal basis for each processing activity identified (LGPD Art. 7).
- [ ] Attach redacted evidence CSVs (hash CPFs, strip IPs unless required).
- [ ] **Legal review trigger:** if the inquiry alleges a **breach**, involves **>1 data subject**, references **sensitive data** (Art. 5 II), or threatens **sanction (Art. 52)** — pause and contact legal counsel (see §7) **before** responding.
- [ ] Sign-off: Thiago drafts + reviews + signs. No second pair of eyes exists — take 2 hours offline before sending.
- [ ] Send via **AR postal mail** (Aviso de Recebimento) to the ANPD return address AND email copy to `comunicacao@anpd.gov.br`.
- [ ] Log response date, tracking number, and attachments in `/admin/lgpd-requests` → metadata.notes.

---

## 3. Data Subject Access Request (LGPD Art. 18 I)

Users emailing "quais dados vocês têm sobre mim?" / "what data do you have about me?" get a response within **15 days** (LGPD soft SLA).

### 3.1 Automated path (preferred)

Reply with the template below and direct them to the self-service export flow:

**pt-BR:**
```
Olá [NOME],

Você pode baixar todos os seus dados diretamente em:
https://bythiagofigueiredo.com/account/export

O arquivo ZIP inclui: perfil, posts, comentários, consentimentos, histórico de login
e metadados. O link de download expira em 7 dias.

Caso precise de informações adicionais, responda este email.

Atenciosamente,
Equipe de Privacidade — bythiagofigueiredo.com
```

**en:**
```
Hi [NAME],

You can download all your data directly at:
https://bythiagofigueiredo.com/account/export

The ZIP includes: profile, posts, comments, consents, login history, and metadata.
Download link expires in 7 days.

For anything beyond that, reply to this email.

Best,
Privacy team — bythiagofigueiredo.com
```

### 3.2 Manual path (when user cannot self-serve)

For users who lost account access or need a summary only:

```sql
-- Summary counts
SELECT
  (SELECT COUNT(*) FROM posts WHERE author_id = '<uuid>') AS posts_count,
  (SELECT COUNT(*) FROM comments WHERE author_id = '<uuid>') AS comments_count,
  (SELECT COUNT(*) FROM consents WHERE user_id = '<uuid>') AS consents_count,
  (SELECT MAX(last_sign_in_at) FROM auth.users WHERE id = '<uuid>') AS last_login;

-- Profile snapshot
SELECT email, created_at, last_sign_in_at, raw_user_meta_data
FROM auth.users WHERE id = '<uuid>';
```

Paste results (redacted) into the email reply. Access requests are **not persisted** in `lgpd_requests` (table CHECK constraint restricts `type` to `data_export`/`account_deletion`/`consent_revocation`). Log the handled request in the `privacidade@` inbox thread — label `access-request-fulfilled` — and retain the thread for the LGPD accountability window (5 years per Art. 37 §1).

---

## 4. Manual Deletion Recovery (phase 1 or 3 failed)

When `lgpd_requests.status = 'failed'` shows up in `/admin/lgpd-requests`:

### 4.1 Triage

1. Open Sentry → search tag `lgpd_request_id:<id>` → read the most recent error. Note the phase (1 or 3) and the failing step.
2. Review audit trail for the last successful phase:

   ```sql
   SELECT created_at, action, metadata
   FROM audit_log
   WHERE resource_type = 'lgpd_request'
     AND resource_id = '<request-uuid>'
   ORDER BY created_at DESC
   LIMIT 20;
   ```

3. Check `metadata.retry_count` on the request row. If `>= 3`, **do not** click Retry again without investigating root cause.

### 4.2 Retry

Click **Retry** in `/admin/lgpd-requests/<id>`. The action is idempotent: it re-runs only the steps not marked complete in `metadata.pre_capture.completed_steps`.

### 4.3 Manual phase 1 cleanup (if retry fails)

Only when automated retry has failed twice and Sentry shows an unrecoverable error (e.g., schema drift, FK violation). Prefer to invoke the server-side RPC (which matches the app code path) rather than hand-rolling SQL. The RPC does steps 1–7 atomically:

```sql
BEGIN;

-- 1. Reuse the production RPC — matches what the app does.
--    pre_capture MUST include the user's newsletter emails so
--    newsletter_subscriptions rows get hashed, not just the owner relation.
SELECT public.lgpd_phase1_cleanup(
  p_user_id := '<uuid>',
  p_pre_capture := jsonb_build_object(
    'newsletter_emails', (
      SELECT COALESCE(jsonb_agg(DISTINCT email), '[]'::jsonb)
      FROM newsletter_subscriptions
      WHERE email = (SELECT email FROM auth.users WHERE id = '<uuid>')
    )
  )
);

-- 2. Ban login (the RPC does NOT touch auth.users; the app layer does this via
--    supabase.auth.admin.updateUserById after the RPC returns).
--    Manual equivalent:
UPDATE auth.users SET banned_until = 'infinity' WHERE id = '<uuid>';
DELETE FROM auth.sessions WHERE user_id = '<uuid>';
DELETE FROM auth.refresh_tokens WHERE user_id = '<uuid>';

-- 3. Mark request complete (matches column names in
--    supabase/migrations/20260430000001_lgpd_requests.sql).
UPDATE lgpd_requests
SET status = 'processing',
    phase = 1,
    phase_1_completed_at = NOW(),
    scheduled_purge_at = NOW() + interval '15 days',
    metadata = metadata || jsonb_build_object(
      'manual_recovery', true,
      'recovered_by', 'thiago',
      'recovered_at', NOW()
    )
WHERE id = '<request-uuid>';

-- Verify before committing:
SELECT email, banned_until FROM auth.users WHERE id = '<uuid>';
SELECT status, phase, phase_1_completed_at, scheduled_purge_at
FROM lgpd_requests WHERE id = '<request-uuid>';

COMMIT;
-- If anything looks wrong: ROLLBACK;
```

> Schema reality check: there is no `profiles.cpf_hash`, no `posts` table (use `blog_posts`), no `legacy_author_id`, and no deleted-user sentinel uuid. `authors.user_id` is simply nulled on deletion (FK `ON DELETE SET NULL`). Content ownership is reassigned by setting `blog_posts.owner_user_id` and `campaigns.owner_user_id` to a master_ring org_admin — this is what the RPC does automatically.

### 4.4 Escalation

If DB state is corrupt (e.g., partial row deletion, broken FKs, mixed phase states), **stop** and invoke the rollback procedure in §5.

---

## 5. Emergency Rollback Procedure

Invoke when: widespread LGPD flow failure, data integrity risk, unintended hard deletes, or regulator-directed suspension.

### 5.1 Feature flags (first 2 minutes)

Disable user-facing LGPD surfaces without requiring a deploy:

```bash
# Requires Vercel CLI + env access
vercel env pull .env.production
# Then in Vercel dashboard or via CLI:
vercel env add NEXT_PUBLIC_LGPD_BANNER_ENABLED false production
vercel env add NEXT_PUBLIC_ACCOUNT_DELETE_ENABLED false production
vercel env add NEXT_PUBLIC_ACCOUNT_EXPORT_ENABLED false production
vercel env add LGPD_CRON_SWEEP_ENABLED false production
# Trigger a redeploy (env changes need it):
vercel --prod --force
```

The four flags are read directly from `process.env` at runtime. When `LGPD_CRON_SWEEP_ENABLED=false`, the D+15 cron short-circuits with a logged skip.

### 5.2 DB restore from migration backup

Sprint 5a follows the Sprint 4.75 backup pattern. Before migration 011 flipped FK delete semantics, snapshots of FK-affected rows were captured in a single flat table `lgpd_migration_backup_v1(table_name, row_snapshot jsonb, backed_up_at)` — see `supabase/migrations/20260430000000_lgpd_backup_snapshot.sql`. Snapshots cover `blog_posts`, `campaigns`, and a 10k-row `audit_log_sample`.

```sql
-- Inspect what's in the backup
SELECT table_name, COUNT(*) AS rows, MIN(backed_up_at), MAX(backed_up_at)
FROM lgpd_migration_backup_v1
GROUP BY table_name;

-- Restore a specific row (example: single campaign by id)
BEGIN;
UPDATE campaigns c
SET owner_user_id = (row_snapshot->>'owner_user_id')::uuid
FROM lgpd_migration_backup_v1 b
WHERE b.table_name = 'campaigns'
  AND (b.row_snapshot->>'id')::uuid = c.id
  AND c.id = '<campaign-uuid>';
-- Verify, then:
COMMIT;
```

**Do not** restore `auth.users` from backup — the backup table does not contain it. For auth restore contact Supabase support; auth table restores can break session integrity globally.

### 5.3 Vercel deploy rollback

```bash
# List recent deployments
vercel ls bythiagofigueiredo.com

# Promote a known-good previous deployment
vercel promote <deployment-url> --scope=thiago
```

Or from Vercel dashboard → Deployments → "..." → Promote to Production.

### 5.4 Communication

- **Internal log:** create incident entry in `/admin/incidents` with timeline.
- **Users:** post to status page (`status.bythiagofigueiredo.com`) within 1 hour.
- **If data breach suspected:** notify ANPD within **2 business days** via `comunicacao@anpd.gov.br` (LGPD Art. 48). Do not delay for investigation completion — preliminary notification is acceptable.
- **Email affected users:** use Brevo template `lgpd-incident-v1` once scope is confirmed.

---

## 6. Monitoring Dashboard Walkthrough

### 6.1 Sentry

- Dashboard: https://sentry.io/organizations/bythiagofigueiredo/dashboards/lgpd/
- Relevant alerts (all route to Thiago's primary email + push):

  | Alert                     | Meaning                                                  | SLA             |
  |---------------------------|----------------------------------------------------------|-----------------|
  | `lgpd_phase_failure`      | A phase 1 or phase 3 step threw in production            | Investigate <1h |
  | `lgpd_cron_backlog`       | >10 requests with `status='processing'` + `phase=1` past `scheduled_purge_at` | Check cron <4h  |
  | `consent_insert_failure`  | Banner POST to `/api/consents` failing — attack or infra | Investigate <1h |
  | `export_blob_stale`       | Signed URL TTL check found blob >7d still linked         | Clean <24h      |

### 6.2 `/admin/lgpd-requests`

Admin UI at `https://bythiagofigueiredo.com/admin/lgpd-requests` (requires `is_member_staff = true`).

- Filters: status, type, date range.
- Row detail pane shows `metadata.pre_capture` (state snapshot at request time), `blob_path` (top-level column, populated for completed exports), and a **Retry** button when `status = 'failed'`.
- Notes field is append-only; use it for ANPD ofício cross-references.

### 6.3 `/admin/consents-stats`

Trend view of consent grants/withdrawals:

- Daily rollup: accept rate, reject rate, partial (essentials-only) rate.
- Weekly 7-day average line for anomaly detection.
- Breakdown by banner version — spikes in rejects after a banner change = rollback signal.

### 6.4 Supabase Logs

Dashboard → Logs → Postgres. Watch for slow queries:

- `check_deletion_safety(<uuid>)` — should return in <200ms. Over 2s = scan issue, check indexes on `posts.author_id`, `comments.author_id`.
- `collectUserData(<uuid>)` (export flow) — can be 3-5s legitimately. Over 30s = investigate.

---

## 7. Escalation & Sign-off

### 7.1 Legal review triggers

Engage counsel **before** responding when any of the following apply:

- ANPD formal complaint (not just an informational ofício) or threatened sanction.
- GDPR Data Protection Authority inquiry (EU visitor complaint routed via supervisory authority).
- Suspected or confirmed data breach (LGPD Art. 48 — 2 business day notification).
- Judicial order (mandado judicial) requiring data disclosure.
- Request from law enforcement without judicial backing (refuse pending order).
- Any request to delete content that is subject to a separate legal hold.

### 7.2 Contacts

| Role                    | Contact                                 |
|-------------------------|-----------------------------------------|
| Privacy inbox           | privacidade@bythiagofigueiredo.com      |
| Controller / DPO        | Thiago Figueiredo (same mailbox)        |
| Legal counsel           | *To be assigned* — escalate first to the DPO contact at `privacidade@bythiagofigueiredo.com`; for formal ANPD responses engage external counsel before sending (see §7.1 triggers). |
| Sentry alert recipient  | Thiago's primary email                  |
| ANPD comms              | comunicacao@anpd.gov.br                 |
| Supabase support        | support@supabase.io (include project ref) |
| Vercel support          | Dashboard → Help → Contact              |

### 7.3 Sign-off authority

Thiago is the sole controller and sign-off. For ANPD responses: **mandatory 2-hour cool-off** between drafting and sending to avoid reactive errors. For rollback decisions: execute immediately; document rationale post-hoc.

---

## 8. Common Queries Cheat Sheet

```sql
-- Pending deletion requests (phase 1 complete, awaiting phase 3)
SELECT id, user_id, requested_at, phase_1_completed_at, scheduled_purge_at
FROM lgpd_requests
WHERE type = 'account_deletion'
  AND status = 'processing'
  AND phase = 1
ORDER BY phase_1_completed_at ASC;

-- Pending export requests (not yet delivered)
SELECT id, user_id, requested_at, blob_path
FROM lgpd_requests
WHERE type = 'data_export'
  AND status IN ('pending', 'processing')
ORDER BY requested_at ASC;

-- Consent statistics — last 24 hours
SELECT
  date_trunc('hour', granted_at) AS hour,
  COUNT(*) FILTER (WHERE granted) AS accepts,
  COUNT(*) FILTER (WHERE NOT granted) AS rejects
FROM consents
WHERE granted_at > NOW() - interval '24 hours'
GROUP BY 1 ORDER BY 1 DESC;

-- Consent statistics — last 7 days, daily
SELECT
  date_trunc('day', granted_at) AS day,
  COUNT(*) FILTER (WHERE granted) AS accepts,
  COUNT(*) FILTER (WHERE NOT granted) AS rejects,
  ROUND(100.0 * COUNT(*) FILTER (WHERE granted) / NULLIF(COUNT(*), 0), 1) AS accept_pct
FROM consents
WHERE granted_at > NOW() - interval '7 days'
GROUP BY 1 ORDER BY 1 DESC;

-- Failed phase transitions (last 7 days)
SELECT id, user_id, type, status,
       metadata->>'last_error' AS last_error,
       metadata->>'retry_count' AS retries,
       requested_at
FROM lgpd_requests
WHERE status = 'failed'
  AND requested_at > NOW() - interval '7 days'
ORDER BY requested_at DESC;

-- Users inactive >365 days (auto-cleanup candidates — LGPD Art. 16 review)
SELECT id, email, created_at, last_sign_in_at
FROM auth.users
WHERE last_sign_in_at < NOW() - interval '365 days'
  AND deleted_at IS NULL
  AND banned_until IS NULL
ORDER BY last_sign_in_at ASC
LIMIT 100;

-- Export blobs past 7-day TTL still referenced
SELECT lr.id, lr.user_id, lr.blob_path,
       lr.blob_uploaded_at, NOW() - lr.blob_uploaded_at AS age
FROM lgpd_requests lr
WHERE lr.type = 'data_export'
  AND lr.blob_path IS NOT NULL
  AND lr.blob_deleted_at IS NULL
  AND lr.blob_uploaded_at < NOW() - interval '7 days';
```

---

## 9. Known Limitations & Caveats

- **Export blob TTL leak window:** The 7-day signed URL on data export means a blob remains accessible for up to 7 days after a user requests deletion (if they exported shortly before deleting). This is documented in the public privacy policy under "Data Retention." No action required unless a user explicitly asks for shorter TTL — then invalidate manually via Supabase Storage API.
- **Cancellation is partial:** Calling cancel during the T+0→T+15 window **unbans login** only. It does **not** restore anonymized email, profile fields, or reassigned content ownership. The user effectively gets a clean empty account under the old ID. Users requesting cancellation must be told this explicitly in the confirmation email.
- **JWT staleness on `is_member_staff`:** Up to 1-hour window where a revoked staff JWT can still access admin endpoints (Sprint 4.75 carry-over). For LGPD-critical actions (phase 3 hard delete, rollback), rely on the in-request DB check via `check_staff_membership(auth.uid())` rather than the JWT claim alone.
- **Sole-operator risk:** No second person reviews ANPD responses. Mandatory 2-hour cool-off between draft and send is the only compensating control.
- **No on-call rotation:** Sentry alerts outside waking hours may be missed. For ANPD SLA math, "business days" gives buffer — don't overreact to a weekend alert, but do triage first thing Monday.
- **Brevo email deliverability:** LGPD confirmation emails (`deletion_initiated`, `export_ready`) depend on Brevo. If Brevo is down, the UI shows "Email delayed — your request is still being processed" but we must not block the phase 1 action on email success.
- **Reminder email cancel link is broken (ops workaround required):** The grace-period reminder email built by `cleanupSweep` points to `/account/delete?requestId=<id>`, but the cancel RPC (`cancel_account_deletion_in_grace`) needs the raw confirmation **token**, not the request id — so the reminder-link path cannot cancel. Operational workaround until code is fixed: when a user replies to a reminder asking to cancel, instruct them to open the **original** "deletion confirmation" email and click the cancel link there (that email carries the token). If they no longer have that email, you must manually cancel via `/admin/lgpd-requests/<id>` → Cancel button, which runs the admin cancel path. Tracked as a follow-up to this runbook.

---

**End of runbook.** If you've read this during an incident and something here is wrong or unclear, edit it **after** the incident resolves. Stress-reading reveals gaps that calm-writing hides.
