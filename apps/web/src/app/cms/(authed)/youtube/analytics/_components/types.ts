import type { Axis, Grade, TrendDirection } from '@/lib/youtube/scoring-types'

export interface VideoGradeRow {
  videoId: string
  title: string
  thumbnailUrl: string
  grade: Grade
  score: number
  axes: Array<{ axis: Axis; normalized: number }>
  trend: { direction: TrendDirection; velocity: number }
  optimizationState: string | null
  retentionCurve: number[] | null
  avgViewPercentage: number
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
