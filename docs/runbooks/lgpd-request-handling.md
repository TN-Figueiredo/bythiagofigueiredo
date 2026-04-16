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

- **Phase 1 — Immediate soft-anonymize (T+0):** On user confirmation, PII is nulled/pseudonymized in `auth.users` and profile tables; content ownership reassigned to the `deleted_user` sentinel; session tokens revoked; a row is inserted into `lgpd_requests` with `status = 'phase_1_complete'`. This phase is idempotent and reversible within a 15-day cancellation window.
- **Phase 2 — Quiet period (T+0 to T+15):** No-op. The row sits in `lgpd_requests` awaiting either user cancellation (`status = 'cancelled'`) or cron promotion to phase 3. Account login is blocked; profile is a tombstone.
- **Phase 3 — Hard delete (T+15, cron):** Removes residual rows (`auth.users` record, anonymized profile, export blobs older than 7-day TTL). `status = 'phase_3_complete'`. No recovery after this point.

The `lgpd_requests` table carries: `id`, `user_id`, `request_type` (`deletion` | `export` | `access` | `rectification`), `status`, `requested_at`, `phase_1_at`, `phase_3_at`, `cancelled_at`, `metadata` (jsonb: `pre_capture`, `blob_path`, `retry_count`, `notes`). Thiago is the sole reviewer and sign-off authority; there is no second-person control.

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

3. Create an entry in `/admin/lgpd-requests` with `request_type = 'anpd_inquiry'` and paste the ofício number + deadline into `metadata.notes`.

### 2.2 Subject identification

The letter will reference either a CPF (hashed in our DB) or an email. Resolve to `user_id`:

```sql
-- By email
SELECT id, email, created_at, deleted_at
FROM auth.users
WHERE lower(email) = lower('<email-from-letter>');

-- By CPF hash (if stored in profile)
SELECT u.id, u.email, p.cpf_hash
FROM auth.users u
JOIN profiles p ON p.user_id = u.id
WHERE p.cpf_hash = crypt('<cpf-from-letter>', p.cpf_salt);
```

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
-- Posts authored by the user (pre- and post-reassignment)
SELECT id, title, created_at, author_id,
       CASE WHEN author_id = '<uuid>' THEN 'original'
            ELSE 'reassigned_to_deleted_user' END AS ownership
FROM posts
WHERE author_id = '<uuid>' OR legacy_author_id = '<uuid>';
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

Paste results (redacted) into the email reply. Log in `lgpd_requests` with `request_type = 'access'`, `status = 'completed_manual'`.

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

Only when automated retry has failed twice and Sentry shows an unrecoverable error (e.g., schema drift, FK violation). Run inside a transaction:

```sql
BEGIN;

-- 1. Null PII
UPDATE auth.users
SET email = 'deleted-' || id || '@deleted.local',
    encrypted_password = NULL,
    raw_user_meta_data = '{}'::jsonb,
    phone = NULL,
    banned_until = 'infinity'
WHERE id = '<uuid>';

-- 2. Anonymize profile
UPDATE profiles
SET display_name = 'Deleted User',
    bio = NULL, avatar_url = NULL,
    cpf_hash = NULL, cpf_salt = NULL
WHERE user_id = '<uuid>';

-- 3. Reassign content to sentinel
UPDATE posts SET author_id = '00000000-0000-0000-0000-000000000000',
                 legacy_author_id = '<uuid>'
WHERE author_id = '<uuid>';

UPDATE comments SET author_id = '00000000-0000-0000-0000-000000000000',
                    legacy_author_id = '<uuid>'
WHERE author_id = '<uuid>';

-- 4. Revoke sessions
DELETE FROM auth.sessions WHERE user_id = '<uuid>';
DELETE FROM auth.refresh_tokens WHERE user_id = '<uuid>';

-- 5. Mark request complete
UPDATE lgpd_requests
SET status = 'phase_1_complete',
    phase_1_at = NOW(),
    metadata = metadata || jsonb_build_object('manual_recovery', true, 'recovered_by', 'thiago', 'recovered_at', NOW())
WHERE id = '<request-uuid>';

-- Verify before committing:
SELECT email, banned_until FROM auth.users WHERE id = '<uuid>';
SELECT status, phase_1_at FROM lgpd_requests WHERE id = '<request-uuid>';

COMMIT;
-- If anything looks wrong: ROLLBACK;
```

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
vercel env add FEATURE_COOKIE_BANNER false production
vercel env add FEATURE_ACCOUNT_DELETE false production
vercel env add FEATURE_ACCOUNT_EXPORT false production
vercel env add FEATURE_LGPD_CRON false production
# Trigger a redeploy (env changes need it):
vercel --prod --force
```

Flags read in `packages/config/flags.ts`. When `FEATURE_LGPD_CRON=false`, the D+15 cron short-circuits with a logged skip.

### 5.2 DB restore from migration backup

Sprint 5a follows the Sprint 4.75 backup pattern (`rbac_migration_backup`). Before the LGPD migration ran, full table snapshots were written to `lgpd_migration_backup_v1`:

```sql
-- Inspect what's in the backup
SELECT table_name, row_count, backed_up_at
FROM lgpd_migration_backup_v1_manifest;

-- Restore a specific table (example: consents)
BEGIN;
TRUNCATE consents;
INSERT INTO consents SELECT * FROM lgpd_migration_backup_v1.consents;
SELECT COUNT(*) FROM consents;
-- If correct:
COMMIT;
```

**Do not** restore `auth.users` from backup without Supabase support in the loop — auth table restores can break session integrity globally.

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
  | `lgpd_cron_backlog`       | >10 requests stuck in phase_1_complete beyond T+15       | Check cron <4h  |
  | `consent_insert_failure`  | Banner POST to `/api/consents` failing — attack or infra | Investigate <1h |
  | `export_blob_stale`       | Signed URL TTL check found blob >7d still linked         | Clean <24h      |

### 6.2 `/admin/lgpd-requests`

Admin UI at `https://bythiagofigueiredo.com/admin/lgpd-requests` (requires `is_member_staff = true`).

- Filters: status, request_type, date range.
- Row detail pane shows `metadata.pre_capture` (state snapshot at request time), `metadata.blob_path` (for exports), and a **Retry** button when `status = 'failed'`.
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
| Legal counsel           | **[TBD — placeholder; fill before S5a goes live]** |
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
SELECT id, user_id, requested_at, phase_1_at,
       (phase_1_at + interval '15 days') AS phase_3_due
FROM lgpd_requests
WHERE request_type = 'deletion'
  AND status = 'phase_1_complete'
ORDER BY phase_1_at ASC;

-- Pending export requests (not yet delivered)
SELECT id, user_id, requested_at, metadata->>'blob_path' AS blob_path
FROM lgpd_requests
WHERE request_type = 'export'
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
SELECT id, user_id, request_type, status,
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
SELECT lr.id, lr.user_id, lr.metadata->>'blob_path' AS path,
       lr.phase_1_at, NOW() - lr.phase_1_at AS age
FROM lgpd_requests lr
WHERE lr.request_type = 'export'
  AND lr.metadata ? 'blob_path'
  AND lr.phase_1_at < NOW() - interval '7 days';
```

---

## 9. Known Limitations & Caveats

- **Export blob TTL leak window:** The 7-day signed URL on data export means a blob remains accessible for up to 7 days after a user requests deletion (if they exported shortly before deleting). This is documented in the public privacy policy under "Data Retention." No action required unless a user explicitly asks for shorter TTL — then invalidate manually via Supabase Storage API.
- **Cancellation is partial:** Calling cancel during the T+0→T+15 window **unbans login** only. It does **not** restore anonymized email, profile fields, or reassigned content ownership. The user effectively gets a clean empty account under the old ID. Users requesting cancellation must be told this explicitly in the confirmation email.
- **JWT staleness on `is_member_staff`:** Up to 1-hour window where a revoked staff JWT can still access admin endpoints (Sprint 4.75 carry-over). For LGPD-critical actions (phase 3 hard delete, rollback), rely on the in-request DB check via `check_staff_membership(auth.uid())` rather than the JWT claim alone.
- **Sole-operator risk:** No second person reviews ANPD responses. Mandatory 2-hour cool-off between draft and send is the only compensating control.
- **No on-call rotation:** Sentry alerts outside waking hours may be missed. For ANPD SLA math, "business days" gives buffer — don't overreact to a weekend alert, but do triage first thing Monday.
- **Brevo email deliverability:** LGPD confirmation emails (`deletion_initiated`, `export_ready`) depend on Brevo. If Brevo is down, the UI shows "Email delayed — your request is still being processed" but we must not block the phase 1 action on email success.

---

**End of runbook.** If you've read this during an incident and something here is wrong or unclear, edit it **after** the incident resolves. Stress-reading reveals gaps that calm-writing hides.
