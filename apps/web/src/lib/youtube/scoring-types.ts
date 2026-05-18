export type Axis = 'ctr' | 'retention' | 'reach' | 'engagement' | 'growth' | 'sub_impact'
export type Grade = 'A' | 'B' | 'C' | 'D'
export type VideoLifecycle = 'fresh' | 'maturing' | 'established' | 'evergreen'
export type TrendDirection = 'up' | 'down' | 'flat'
export type ChannelTier = 'nano' | 'micro' | 'small' | 'medium' | 'large'

export interface AxisWeights {
  ctr: number
  retention: number
  reach: number
  engagement: number
  growth: number
  sub_impact: number
}

export interface AxisScore {
  axis: Axis
  raw: number
  normalized: number
  weight: number
  weighted: number
}

export interface VideoScore {
  videoId: string
  overall: number
  grade: Grade
  axes: AxisScore[]
  evergreenBonus: number
  lifecycle: VideoLifecycle
  ageDays: number
}

export interface VideoScoreInput {
  videoId: string
  publishedAt: string
  ctr: number
  avgViewPercentage: number
  impressions: number
  trafficSources: TrafficSources | null
  engagementRate: number
  dailyViews: DailyViewPoint[]
  subscribersGained: number
  viewCount: number
}

export interface TrafficSources {
  browse: number
  search: number
  suggested: number
  external: number
  direct: number
  notifications: number
  playlists: number
}

export interface DailyViewPoint {
  date: string
  views: number
}

export interface ChannelBaseline {
  medianCtr: number
  medianRetention: number
  medianReach: number
  medianEngagement: number
  medianGrowth: number
  medianSubImpact: number
  channelDailyMean: number
  subscriberCount: number
  medianViewCount: number
}

export interface TrendData {
  direction: TrendDirection
  velocity: number
  streak: number
  label: string | null
}

export interface OutlierResult {
  videoId: string
  axis: Axis
  modifiedZ: number
  direction: 'positive' | 'negative'
}

export const AXIS_LABELS: Record<Axis, string> = {
  ctr: 'CTR',
  retention: 'Retenção',
  reach: 'Alcance',
  engagement: 'Engajamento',
  growth: 'Crescimento',
  sub_impact: 'Impacto em Subs',
}

export const GRADE_THRESHOLDS = { A: 85, B: 65, C: 40 } as const
export const SIGMOID_K: Record<Axis, number> = {
  ctr: 1.8,
  retention: 2.0,
  reach: 1.2,
  engagement: 1.5,
  growth: 2.5,
  sub_impact: 2.2,
}
export const LOG_TRANSFORM_AXES: Axis[] = ['growth']
