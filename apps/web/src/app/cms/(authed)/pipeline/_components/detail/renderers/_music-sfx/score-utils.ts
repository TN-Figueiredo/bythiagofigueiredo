/** Score thresholds (percent). Exported for reuse in card components. */
export const SCORE_HIGH = 75
export const SCORE_MID = 50
export const SCORE_LOW = 25

/** Ratio equivalents derived from the percent constants. */
const RATIO_HIGH = SCORE_HIGH / 100
const RATIO_MID = SCORE_MID / 100
const RATIO_LOW = SCORE_LOW / 100

export function getScoreColor(score: number, max: number): string {
  if (max === 0) return '#6b7280'
  const pct = score / max
  if (pct >= RATIO_HIGH) return '#10b981'
  if (pct >= RATIO_MID) return '#f59e0b'
  if (pct >= RATIO_LOW) return '#f97316'
  return '#6b7280'
}

export function getScoreColorFromPercent(pct: number): string {
  if (pct >= SCORE_HIGH) return '#10b981'
  if (pct >= SCORE_MID) return '#f59e0b'
  if (pct >= SCORE_LOW) return '#f97316'
  return '#6b7280'
}

export function getBreakdownColor(score: number, max: number): string {
  if (max === 0) return '#4b5563'
  if (score === 0) return '#4b5563'
  if (score === max) return '#10b981'
  if (score / max > RATIO_MID) return '#34d399'
  return '#f59e0b'
}

export function computeScorePercent(score: number, max: number): number {
  if (max === 0) return 0
  return Math.round((score / max) * 100)
}

const CATEGORY_SHORT: Record<string, string> = {
  category: 'cat',
  subcategory: 'subcat',
  tags: 'tags',
  mood: 'mood',
  energy: 'energy',
  bpm_in_range: 'bpm',
  duration_in_range: 'dur',
  duration: 'dur',
  reuse_scenarios: 'reuse',
  reuse: 'reuse',
  instruments: 'inst',
  description: 'desc',
}

export function getDeltaParts(delta: Record<string, number> | undefined): { label: string; value: number }[] {
  if (!delta) return []
  const parts: { label: string; value: number }[] = []
  for (const [key, value] of Object.entries(delta)) {
    if (value === 0) continue
    const label = CATEGORY_SHORT[key] ?? key
    parts.push({ label, value })
  }
  return parts
}

export function formatDeltaTotal(delta: Record<string, number> | undefined): number {
  if (!delta) return 0
  return Object.values(delta).reduce((sum, v) => sum + v, 0)
}
