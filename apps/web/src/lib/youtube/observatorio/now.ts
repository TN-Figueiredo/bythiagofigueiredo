/** The observatory's "now". The override exists ONLY for the fidelity e2e (frozen mockup clock). */
export function observatoryNow(): number {
  const raw = process.env.OBS_NOW_OVERRIDE
  if (process.env.NODE_ENV === 'test' && raw) { const t = Date.parse(raw); if (Number.isFinite(t)) return t }
  return Date.now()
}
