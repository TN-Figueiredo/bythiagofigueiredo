# Waitlists — Fase 1 DPO / LGPD note

**Status:** Fase 1 (live). **Author:** engineering. **Last updated:** 2026-06-17.

This note is the LGPD sign-off artifact required by the Waitlists plan M6 LOCK. It
records what Fase 1 collects, the legal basis, and the explicit limits that hold until
Fase 2 ships the live data-subject rights paths.

## What Fase 1 collects

A single launch-notification signup per `(waitlist, email)`:

- `email` (the only direct identifier), optional `locale`, `source_surface`.
- A **single, explicit consent**: `consent_launch_notification = true` (DB CHECK enforces
  it can only ever be `true`). No name, no phone, no price, no profiling.
- Request `ip` / `user_agent` are stored transiently for rate-limiting + abuse only and
  are **excluded** from every export projection.

**Legal basis:** consent (LGPD Art. 7 I) for the launch notification.

## Proof of consent (evidentiary basis)

On signup the route snapshots the **exact rendered consent sentence** into the audit log:
`consent_texts.text_md` for `(category='launch_notification', locale, version=WAITLIST_CONSENT_VERSION)`
with `{name}` interpolated. `consent_texts` is an append-only, supersession-tracked ledger
(`effective_at` / `superseded_at`), so the verbatim text a subject agreed to is always
recoverable by version pointer. A committed CI test asserts byte-parity between the
displayed `FORM_STRINGS[locale].consentLabel` and the ledgered text so a copy edit cannot
silently diverge the evidence from what was shown.

## Retention

A daily cron (`waitlist-retention-sweep`, gated by `WAITLIST_RETENTION_SWEEP_ENABLED`)
runs `waitlist_retention_sweep` per `cms_enabled` site, applying the §2.4 retention
windows and anonymizing aged rows. Anonymized rows are excluded from all reads/exports.

## Data-subject rights — Fase 1 limits (LOCKED)

- The **DSAR endpoint is INERT** in Fase 1: `/api/waitlists/dsar/[token]` returns a
  neutral, no-oracle `200 { data: [] }` regardless of token. It collects nothing and
  exposes nothing.
- The **Art. 16 (correction) / Art. 18 (deletion, portability) withdrawal + unsubscribe**
  paths ship in **Fase 2**.
- Because those rights paths are not yet live, **no production waitlist may be `status='open'`**.
  This is enforced in code, not just policy: `transitionWaitlistStatus` rejects any
  transition to `open` with `fase1_only_draft` unless `WAITLIST_ACCEPT_PUBLIC_SIGNUPS === 'true'`
  (unset in production). The landing page + form still ship and are exercised via seeded
  `open` rows in DB-gated tests; production lists stay `draft` (RLS-invisible).

**Gate to flip for Fase 2:** ship live DSAR export + unsubscribe/withdrawal, then (and only
then) enable `WAITLIST_ACCEPT_PUBLIC_SIGNUPS` and update this note.
