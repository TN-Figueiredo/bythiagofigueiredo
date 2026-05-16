export const ENERGY_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#22c55e',
  3: '#eab308',
  4: '#f97316',
  5: '#ef4444',
}

export function energyColor(level: number | null | undefined): string {
  if (level == null) return '#5a6b7f'
  return ENERGY_COLORS[level] ?? '#5a6b7f'
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface CategoryStyle {
  badgeBg: string
  badgeColor: string
  hoverAccent: string
  dotColor: string
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  cinematic: { badgeBg: 'rgba(99,102,241,0.12)', badgeColor: '#818cf8', hoverAccent: '#7c3aed', dotColor: '#818cf8' },
  ambient: { badgeBg: 'rgba(14,165,233,0.12)', badgeColor: '#38bdf8', hoverAccent: '#0ea5e9', dotColor: '#38bdf8' },
  electronic: { badgeBg: 'rgba(168,85,247,0.12)', badgeColor: '#c084fc', hoverAccent: '#a855f7', dotColor: '#c084fc' },
  impact: { badgeBg: 'rgba(239,68,68,0.12)', badgeColor: '#f87171', hoverAccent: '#0ea5e9', dotColor: '#f87171' },
  drop: { badgeBg: 'rgba(245,158,11,0.12)', badgeColor: '#fbbf24', hoverAccent: '#f59e0b', dotColor: '#fbbf24' },
  riser: { badgeBg: 'rgba(16,185,129,0.12)', badgeColor: '#34d399', hoverAccent: '#10b981', dotColor: '#34d399' },
}

const FALLBACK_STYLE: CategoryStyle = {
  badgeBg: 'rgba(107,114,128,0.12)',
  badgeColor: '#9ca3af',
  hoverAccent: '#6b7280',
  dotColor: '#9ca3af',
}

export function categoryConfig(category: string | null | undefined): CategoryStyle {
  if (!category) return FALLBACK_STYLE
  return CATEGORY_STYLES[category.toLowerCase()] ?? FALLBACK_STYLE
}

export function similarityScore(a: {
  category?: string | null
  tags?: string[]
  music_key?: string | null
  bpm?: number | null
  energy?: number | null
  instruments?: string[]
  mood?: string[]
}, b: typeof a): number {
  let score = 0
  if (a.category && a.category === b.category) score += 30
  const sharedTags = (a.tags ?? []).filter(t => (b.tags ?? []).includes(t))
  score += Math.min(sharedTags.length * 5, 30)
  if (a.music_key && a.music_key === b.music_key) score += 15
  if (a.bpm != null && b.bpm != null && Math.abs(a.bpm - b.bpm) <= 10) score += 15
  if (a.energy != null && b.energy != null && Math.abs(a.energy - b.energy) <= 1) score += 10
  const sharedInst = (a.instruments ?? []).filter(i => (b.instruments ?? []).includes(i))
  score += Math.min(sharedInst.length * 3, 15)
  const sharedMood = (a.mood ?? []).filter(m => (b.mood ?? []).includes(m))
  score += Math.min(sharedMood.length * 5, 20)
  return Math.min(score, 100)
}
