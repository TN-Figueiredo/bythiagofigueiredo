import type { Axis, Grade, TrendDirection, UnavailableAxis } from '@/lib/youtube/scoring-types'

export interface VideoGradeRow {
  videoId: string
  title: string
  thumbnailUrl: string
  grade: Grade
  score: number
  /** Only the axes that were measured. A missing axis is NOT a zero — see `unavailableAxes`. */
  axes: Array<{ axis: Axis; normalized: number }>
  /** Axes this video could not be scored on, with the reason. Rendered as "indisponível". */
  unavailableAxes: UnavailableAxis[]
  trend: { direction: TrendDirection; velocity: number }
  optimizationState: string | null
  retentionCurve: number[] | null
  /** `null` = never measured (the analytics sync does not request it), not 0%. */
  avgViewPercentage: number | null
  diagnosis: string | null
  recommendation: string | null
  trafficSources: Record<string, number> | null
}

export interface OutlierVideo {
  videoId: string
  title: string
  score: number
  modifiedZ: number
  direction: 'positive' | 'negative'
  axis: Axis
  patterns?: string[]
}
