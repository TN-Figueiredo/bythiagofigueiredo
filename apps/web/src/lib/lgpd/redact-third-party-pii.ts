/**
 * LGPD 3rd-party PII redaction helper for data export.
 *
 * When user A exports their data, that dataset may include text authored by
 * user A that references PII of user B (e.g. a contact form reply that quotes
 * someone else's email/phone). Per LGPD Art. 7 IX + Art. 18 V, portability is
 * a right belonging to the data subject — it does not extend to 3rd-party
 * personal data. We redact those values with stable placeholder strings.
 *
 * The `redacted` flag is included so the caller can emit a per-field
 * `redaction_applied: true` marker in the export schema (design spec §Data
 * export schema v1).
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\+?\d{2,3}[- ]?\(?\d{2,3}\)?[- ]?\d{4,5}[- ]?\d{4}/g;

export interface RedactionResult {
  text: string | null;
  redacted: boolean;
}

export function redactThirdPartyPii(text: string | null | undefined): RedactionResult {
  if (!text) return { text: null, redacted: false };
  let redacted = false;
  const out = text
    .replace(EMAIL_RE, () => {
      redacted = true;
      return '[REDACTED_EMAIL]';
    })
    .replace(PHONE_RE, () => {
      redacted = true;
      return '[REDACTED_PHONE]';
    });
  return { text: out, redacted };
}
