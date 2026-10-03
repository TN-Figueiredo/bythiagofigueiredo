/**
 * The observatory's "now". The override exists ONLY for the fidelity e2e (frozen mockup clock).
 * Gate: OBS_E2E === '1' (set only in the Playwright webServer env) AND a non-production NODE_ENV. A NODE_ENV === 'test'
 * gate would be dead there: `next dev` inlines process.env.NODE_ENV as 'development' in server bundles.
 */
export function observatoryNow(): number {
  const raw = process.env.OBS_NOW_OVERRIDE
  if (process.env.NODE_ENV !== 'production' && process.env.OBS_E2E === '1' && raw) { const t = Date.parse(raw); if (Number.isFinite(t)) return t }
  return Date.now()
}
