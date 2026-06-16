// apps/web/src/app/api/waitlists/consent.ts
// Shared consent-version constant (NOT a server guard — a plain string, safe in any
// bundle). Must stay in lockstep with the consent_texts seed version in
// migration 20260616000006_waitlist_consent_seed.sql.
export const WAITLIST_CONSENT_VERSION = 'launch-notification-v1-2026-06'
