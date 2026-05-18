
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '--'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export const SOURCE_TYPE_CONFIG: Record<string, { label: string; dotColor: string; badgeBg: string; badgeColor: string }> = {
  pessoal: { label: 'Pessoal', dotColor: '#22c55e', badgeBg: 'rgba(34,197,94,0.12)', badgeColor: '#22c55e' },
  generico: { label: 'Generico', dotColor: '#3b82f6', badgeBg: 'rgba(59,130,246,0.12)', badgeColor: '#3b82f6' },
}

export function sourceTypeConfig(sourceType: string | null | undefined) {
  if (!sourceType) return SOURCE_TYPE_CONFIG['pessoal']!
  return SOURCE_TYPE_CONFIG[sourceType] ?? SOURCE_TYPE_CONFIG['pessoal']!
}

interface CategoryStyle {
  badgeBg: string
  badgeColor: string
  hoverAccent: string
  dotColor: string
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  travel:    { badgeBg: 'rgba(14,165,233,0.12)', badgeColor: '#38bdf8', hoverAccent: '#0ea5e9', dotColor: '#38bdf8' },
  urban:     { badgeBg: 'rgba(107,114,128,0.12)', badgeColor: '#9ca3af', hoverAccent: '#6b7280', dotColor: '#9ca3af' },
  nature:    { badgeBg: 'rgba(16,185,129,0.12)', badgeColor: '#34d399', hoverAccent: '#10b981', dotColor: '#34d399' },
  tech:      { badgeBg: 'rgba(99,102,241,0.12)', badgeColor: '#818cf8', hoverAccent: '#6366f1', dotColor: '#818cf8' },
  food:      { badgeBg: 'rgba(245,158,11,0.12)', badgeColor: '#fbbf24', hoverAccent: '#f59e0b', dotColor: '#fbbf24' },
  lifestyle: { badgeBg: 'rgba(168,85,247,0.12)', badgeColor: '#c084fc', hoverAccent: '#a855f7', dotColor: '#c084fc' },
  abstract:  { badgeBg: 'rgba(236,72,153,0.12)', badgeColor: '#f472b6', hoverAccent: '#ec4899', dotColor: '#f472b6' },
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

export const RESOLUTION_ORDER: Record<string, number> = { '4k': 4, '1080p': 3, '720p': 2, '480p': 1 }

export function resolutionLabel(res: string | null | undefined): string {
  if (!res) return '--'
  if (res === '4k') return '4K'
  return res.toUpperCase()
}

export function similarityScore(a: {
  category?: string | null
  tags?: string[]
  resolution?: string | null
  duration_seconds?: number | null
  source_type?: string | null
  location?: string | null
}, b: typeof a): number {
  let score = 0
  if (a.category && a.category === b.category) score += 30
  const sharedTags = (a.tags ?? []).filter(t => (b.tags ?? []).includes(t))
  score += Math.min(sharedTags.length * 5, 30)
  if (a.resolution && a.resolution === b.resolution) score += 15
  if (a.source_type && a.source_type === b.source_type) score += 10
  if (a.duration_seconds != null && b.duration_seconds != null && Math.abs(a.duration_seconds - b.duration_seconds) <= 3) score += 10
  if (a.location && b.location && a.location.toLowerCase() === b.location.toLowerCase()) score += 15
  return Math.min(score, 100)
}
