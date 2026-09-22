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
  /** Effective weight after unavailable axes were dropped and the rest renormalized. */
  weight: number
  normalized: number
  weighted: number
}

export interface VideoScore {
  videoId: string
  overall: number
  grade: Grade
  /**
   * Only the axes that could actually be measured. An axis with no usable
   * input is ABSENT from this array — it is never present with a zero, which
   * would turn missing data into the claim "this video scores 0 here".
   * Consumers distinguish the two by `find()` returning `undefined`.
   */
  axes: AxisScore[]
  /** Axes deliberately left out of `axes`, and why. */
  unavailableAxes: UnavailableAxis[]
  evergreenBonus: number
  lifecycle: VideoLifecycle
  ageDays: number
}

export interface UnavailableAxis {
  axis: Axis
  reason: string
}

export interface VideoScoreInput {
  videoId: string
  publishedAt: string
  ctr: number
  avgViewPercentage: number
  impressions: number
  trafficSources: TrafficSources | null
  engagementRate: number
  /**
   * Rows of `youtube_video_analytics` for this video: each one the TOTAL over
   * the rolling sync window as of its date, NOT that date's count. Named
   * `windowViews` precisely so that summing them cannot type-check.
   */
  rollingViews: RollingViewPoint[]
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

/** A TRUE per-day view count. Nothing in this codebase can produce one yet. */
export interface DailyViewPoint {
  date: string
  views: number
}

/**
 * One `youtube_video_analytics` row: the total over the rolling sync window as
 * of `date`. Consecutive points are overlapping windows, not a time series of
 * daily counts, so they must not be summed and must not be differenced.
 */
export interface RollingViewPoint {
  date: string
  windowViews: number
}

export interface ChannelBaseline {
  medianCtr: number
  medianRetention: number
  medianReach: number
  medianEngagement: number
  medianSubImpact: number
  /**
   * Mean, across videos with data, of the video's CURRENT rolling-window view
   * total. Same unit as a single video's window total, so the two are
   * comparable. Replaces `channelDailyMean`, which divided a summed-and-thus-
   * inflated channel total by the number of sync dates and then compared that
   * channel-wide figure against a SINGLE video's mean — an error of scale on
   * top of the error of aggregation.
   */
  channelMeanWindowViews: number
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
