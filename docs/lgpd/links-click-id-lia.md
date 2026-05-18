# Links Engine — Click ID Passthrough LIA/RIPD

**Date:** 2026-05-18
**Data Controller:** ByThiagoFigueiredo
**Legal Basis:** Legitimate Interest (LGPD Art. 7, IX)

## 1. Processing Activity

When a visitor clicks a tracked short link (go.domain.com/code), the redirect handler:

- **Always** forwards ad click IDs (gclid, fbclid, etc.) from the incoming URL to the destination URL
- **Conditionally** stores the click IDs in `link_clicks.ad_click_ids` (requires analytics consent)

## 2. Legitimate Interest (Passthrough)

The passthrough acts as a transparent intermediary — the click ID was already present in the visitor's URL and would reach the destination directly if the short link didn't exist. The short link must not strip information the visitor was already carrying.

## 3. Consent-Gated Storage

Storage of `ad_click_ids` in the database is gated on LGPD analytics consent (cookie banner). Without consent, click IDs are forwarded but not stored.

## 4. Data Minimization

- Only 13 known ad platform IDs are forwarded (allowlist)
- Values are sanitized (charset, length cap, URL length cap)
- Unknown parameters are dropped
- Stored data is anonymized after 30 days by the `links-anonymize-clicks` cron

## 5. Data Subject Rights

- Phase 1 anonymization nullifies `ad_click_ids` on account deletion
- 30-day retention ensures timely cleanup
- Data export includes click IDs when present
