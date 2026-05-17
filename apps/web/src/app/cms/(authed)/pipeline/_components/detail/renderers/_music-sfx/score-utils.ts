const CIRCUMFERENCE = 94

export function getScoreColor(score: number, max: number): string {
  if (max === 0) return '#6b7280'
  const pct = score / max
  if (pct >= 0.75) return '#10b981'
  if (pct >= 0.50) return '#f59e0b'
  if (pct >= 0.25) return '#f97316'
  return '#6b7280'
}

export function getScoreColorFromPercent(pct: number): string {
  if (pct >= 75) return '#10b981'
  if (pct >= 50) return '#f59e0b'
  if (pct >= 25) return '#f97316'
  return '#6b7280'
}

export function getBreakdownColor(score: number, max: number): string {
  if (max === 0) return '#4b5563'
  if (score === 0) return '#4b5563'
  if (score === max) return '#10b981'
  if (score / max > 0.5) return '#34d399'
  return '#f59e0b'
}

export function computeGaugeDasharray(score: number, max: number): { filled: number; empty: number } {
  if (max === 0) return { filled: 0, empty: CIRCUMFERENCE }
  const ratio = Math.min(score / max, 1)
  const filled = ratio * CIRCUMFERENCE
  return { filled, empty: CIRCUMFERENCE - filled }
}

export function computeScorePercent(score: number, max: number): number {
  if (max === 0) return 0
  return Math.round((score / max) * 100)
}

const CATEGORY_SHORT: Record<string, string> = {
  category: 'cat',
  tags: 'tags',
  mood: 'mood',
  energy: 'energy',
  bpm_in_range: 'bpm',
  duration_in_range: 'dur',
  reuse_scenarios: 'reuse',
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
