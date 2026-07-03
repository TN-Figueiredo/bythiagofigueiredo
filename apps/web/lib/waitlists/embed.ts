// Embed-surface helpers (Surface 2 — /embed/waitlists/[slug]). Pure, server-safe.

// Exactly 6 hex digits, no leading '#" (the query param is `?accent=RRGGBB`).
// Anchored + length-bound so junk like `ff8240ff`, `red` or `var(--x)` is rejected —
// the value is interpolated into an inline style, so this regex is also the
// CSS-injection guard (only [0-9a-f]{6} can ever reach the style attribute).
const ACCENT_RE = /^[0-9a-fA-F]{6}$/

/**
 * Validate the `?accent=RRGGBB` query param. Returns a normalized `#rrggbb` CSS
 * color, or `null` when the param is absent/invalid (caller keeps the default
 * `--pb-accent` from the theme). Arrays (`?accent=a&accent=b`) are rejected —
 * a repeated param is malformed input, not a choice we pick from.
 */
export function parseEmbedAccent(raw: string | string[] | undefined): string | null {
  if (typeof raw !== 'string' || !ACCENT_RE.test(raw)) return null
  return `#${raw.toLowerCase()}`
}
