/**
 * YouTube Intelligence API — Type Definitions
 *
 * Used by Cowork (Claude) to read channel performance data and write back
 * personalized recommendations via the pipeline API.
 *
 * GET  /api/pipeline/youtube/intelligence?channel_id=xxx → IntelligenceGetResponse
 * PATCH /api/pipeline/youtube/intelligence               → IntelligencePatchPayload
 */

// ════════════════════════════════════════════���══════════════════════════
// GET Response — What Cowork reads
// ═══════════════════════════════════════════════════════════════════════

export interface IntelligenceGetResponse {
  channel: IntelligenceChannel
  metrics_30d: IntelligenceMetrics
  metrics_previous_30d: IntelligenceMetrics
  health_score: IntelligenceHealthScore
  videos: IntelligenceVideo[]
  trends: IntelligenceTrends
  ab_tests: IntelligenceAbTestSummary[]
  traffic_sources: IntelligenceTrafficSources
  content_patterns: IntelligenceContentPatterns
}

export interface IntelligenceChannel {
  id: string
  channel_id: string
  name: string
  handle: string
  locale: 'pt' | 'en'
  subscriber_count: number
  video_count: number
  thumbnail_url: string | null
}

export interface IntelligenceMetrics {
  views: number
  impressions: number
  ctr: number
  estimated_minutes_watched: number
  average_view_duration_seconds: number
  average_view_percentage: number
  subscribers_gained: number
  subscribers_lost: number
  likes: number
  comments: number
  shares: number
}

export interface IntelligenceHealthScore {
  overall: number // 0-100
  breakdown: {
    ctr: { value: number; score: number; grade: HealthGrade }
    retention: { value: number; score: number; grade: HealthGrade }
    growth: { value: number; score: number; grade: HealthGrade }
    engagement: { value: number; score: number; grade: HealthGrade }
    frequency: { value: number; score: number; grade: HealthGrade }
  }
}

export type HealthGrade = 'excellent' | 'good' | 'average' | 'below_average' | 'critical'

export interface IntelligenceVideo {
  video_id: string
  youtube_video_id: string
  title: string
  thumbnail_url: string | null
  published_at: string
  duration_seconds: number
  category_slug: string | null
  tags: string[]

  metrics: IntelligenceVideoMetrics
  grade: VideoGrade
  score: number
  relative_performance: 'exceptional' | 'above_average' | 'average' | 'below_average' | 'underperforming'

  thumbnail_metadata: ThumbnailMetadata
  title_metadata: TitleMetadata
  traffic_sources: VideoTrafficSources
  retention_curve: number[] // normalized 0-100, 10-12 data points
  ab_test_history: VideoAbTestEntry[]
}

export interface IntelligenceVideoMetrics {
  views: number
  impressions: number
  ctr: number
  avg_view_duration_seconds: number
  avg_view_percentage: number
  likes: number
  comments: number
  shares: number
  subscribers_gained: number
  estimated_minutes_watched: number
}

export type VideoGrade = 'A' | 'B' | 'C' | 'D'

export interface ThumbnailMetadata {
  tags: ThumbnailTag[]
  style: string | null
  has_face: boolean
  has_text: boolean
  dominant_colors: string[]
}

export type ThumbnailTag =
  | 'face_close'
  | 'face_medium'
  | 'face_wide'
  | 'no_face'
  | 'text_overlay'
  | 'dark_bg'
  | 'light_bg'
  | 'gradient_bg'
  | 'split_screen'
  | 'before_after'
  | 'emoji'
  | 'arrow'
  | 'circle_highlight'
  | 'screenshot'
  | 'product_shot'

export interface TitleMetadata {
  word_count: number
  char_count: number
  has_number: boolean
  has_question: boolean
  has_brackets: boolean
  has_emoji: boolean
  pattern: TitlePattern
  emotional_trigger: EmotionalTrigger | null
  language: 'pt' | 'en'
}

export type TitlePattern =
  | 'how_to'
  | 'listicle'
  | 'question'
  | 'statement'
  | 'challenge'
  | 'story'
  | 'comparison'
  | 'review'
  | 'news'
  | 'other'

export type EmotionalTrigger =
  | 'curiosity'
  | 'fear'
  | 'urgency'
  | 'surprise'
  | 'aspiration'
  | 'controversy'
  | 'nostalgia'
  | 'empathy'

export interface VideoTrafficSources {
  browse_features: number // percentage
  search: number
  suggested: number
  external: number
  direct: number
  notifications: number
  playlists: number
  other: number
}

export interface VideoAbTestEntry {
  test_id: string
  test_type: 'thumbnail' | 'title' | 'description' | 'combo'
  status: 'active' | 'completed' | 'archived'
  winner_label: string | null
  ctr_lift_percent: number | null
  confidence: number | null
  started_at: string
  completed_at: string | null
}

export interface IntelligenceTrends {
  views_7d_vs_prev: number       // percentage change
  views_30d_vs_prev: number
  views_90d_vs_prev: number
  ctr_7d_vs_prev: number
  ctr_30d_vs_prev: number
  impressions_7d_vs_prev: number
  impressions_30d_vs_prev: number
  subs_net_7d: number
  subs_net_30d: number
  watch_time_30d_vs_prev: number
  best_performing_day: string      // e.g. "tuesday"
  best_performing_hour: number     // 0-23
  daily_views_sparkline: number[]  // 30 data points
  daily_subs_sparkline: number[]   // 30 data points
}

export interface IntelligenceAbTestSummary {
  test_id: string
  video_id: string
  video_title: string
  test_type: 'thumbnail' | 'title' | 'description' | 'combo'
  status: 'active' | 'completed' | 'archived'
  started_at: string
  completed_at: string | null
  winner_label: string | null
  ctr_lift_percent: number | null
  confidence: number | null
  variants_count: number
  total_impressions: number
}

export interface IntelligenceTrafficSources {
  channel_avg: VideoTrafficSources
  top_search_terms: { term: string; views: number; ctr: number }[]
  top_external_sources: { source: string; views: number }[]
  suggested_from: { video_title: string; video_id: string; views: number }[]
}

export interface IntelligenceContentPatterns {
  by_category: CategoryPerformance[]
  by_title_pattern: PatternPerformance[]
  by_thumbnail_style: PatternPerformance[]
  by_day_of_week: DayPerformance[]
  by_duration_bucket: DurationPerformance[]
}

export interface CategoryPerformance {
  category_slug: string
  category_name: string
  video_count: number
  avg_views: number
  avg_ctr: number
  avg_retention: number
  avg_engagement_rate: number
  total_watch_time_minutes: number
}

export interface PatternPerformance {
  pattern: string
  video_count: number
  avg_views: number
  avg_ctr: number
  avg_retention: number
  vs_channel_avg_ctr: number  // percentage difference
}

export interface DayPerformance {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  video_count: number
  avg_views_7d: number
  avg_ctr: number
}

export interface DurationPerformance {
  bucket: 'short' | 'medium' | 'long' | 'extra_long' // <5min, 5-15, 15-30, 30+
  video_count: number
  avg_views: number
  avg_retention: number
  avg_ctr: number
}


// ═══════════════════════════════════════════════════════════════════════
// PATCH Payload — What Cowork writes back
// ═══════════════════════════════════════════════════════════════════════

export interface IntelligencePatchPayload {
  channel_id: string
  analysis_version: number
  analyzed_at: string // ISO datetime

  video_recommendations: VideoRecommendationGroup[]
  channel_insights: ChannelInsights
  coaching: CoachingOutput
  notifications: IntelligenceNotification[]
}

export interface VideoRecommendationGroup {
  video_id: string
  recommendations: VideoRecommendation[]
}

export interface VideoRecommendation {
  id: string                        // format: rec_<random_8_chars>
  action_type: RecommendationActionType
  priority: RecommendationPriority
  confidence: number                // 0.0 - 1.0
  title: string                     // one-liner PT-BR
  reasoning: string                 // 2-3 sentences explaining WHY, with numbers
  suggested_action: string          // specific, actionable next step
  data_points: RecommendationDataPoints
  status: RecommendationStatus
  created_at: string                // ISO datetime
  expires_at?: string               // ISO datetime — recommendation auto-archives after this
}

export type RecommendationActionType =
  | 'thumbnail_redesign'
  | 'title_rewrite'
  | 'description_seo'
  | 'ab_test_thumb'
  | 'ab_test_title'
  | 'retention_fix'
  | 'content_strategy'
  | 'publish_timing'
  | 'series_opportunity'
  | 'chapters_add'
  | 'end_screen_optimize'
  | 'pinned_comment'

export type RecommendationPriority = 'high' | 'medium' | 'low'

export type RecommendationStatus =
  | 'pending'       // newly created, not acted upon
  | 'in_progress'   // user started acting on it
  | 'completed'     // user applied the recommendation
  | 'dismissed'     // user chose to ignore it
  | 'expired'       // auto-archived after expires_at
  | 'superseded'    // replaced by a newer recommendation

export interface RecommendationDataPoints {
  current_ctr?: number
  benchmark_ctr?: number
  current_retention?: number
  benchmark_retention?: number
  pattern_sample_size?: number
  potential_lift_percent?: number
  cliff_position?: number
  cliff_drop_percent?: number
  search_volume?: number
  impressions_wasted?: number
  [key: string]: number | undefined  // extensible for future metrics
}


// ── Channel Insights ──

export interface ChannelInsights {
  patterns_detected: DetectedPattern[]
  strengths: string[]               // max 5, PT-BR sentences
  weaknesses: string[]              // max 5, PT-BR sentences
  opportunities: string[]           // max 5, PT-BR sentences
}

export interface DetectedPattern {
  pattern_id: string                // format: pat_<random_8_chars>
  category: PatternCategory
  finding: string                   // one-liner PT-BR
  confidence: number                // 0.0 - 1.0
  sample_size: number
  data: Record<string, number | string>  // supporting data (avg_ctr, counts, etc.)
}

export type PatternCategory =
  | 'thumbnail_style'
  | 'title_pattern'
  | 'content_type'
  | 'publish_timing'
  | 'duration_sweet_spot'
  | 'traffic_source'
  | 'engagement_driver'
  | 'retention_pattern'
  | 'growth_lever'


// ── Coaching Output ──

export interface CoachingOutput {
  summary: string                   // 2-3 sentences, big picture PT-BR
  priorities: CoachingPriority[]    // max 5, ordered by rank
  next_video_advice: string         // specific advice for the next upload
}

export interface CoachingPriority {
  rank: number                      // 1-5
  action: string                    // what to do
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
  estimated_lift: string            // e.g. "+2.500 views/mês"
  timeline: string                  // e.g. "Esta semana"
}


// ── Notifications ──

export interface IntelligenceNotification {
  trigger: NotificationTrigger
  severity: NotificationSeverity
  video_id: string | null           // null for channel-level notifications
  message: string                   // human-readable PT-BR
  suggested_action: string          // one-liner action
  data?: NotificationData
}

export type NotificationTrigger =
  | 'ctr_drop'                      // CTR dropped >25% over 3+ days
  | 'grade_drop'                    // Video grade dropped from B+ to D
  | 'stagnant_after_test'           // A/B test completed 14+ days ago, no improvement
  | 'optimization_opportunity'      // High impressions, low CTR
  | 'viral_detection'               // Views 5x+ above channel avg in 48h
  | 'retention_cliff'               // >30% drop in 10s on retention curve
  | 'search_surge'                  // Search term grew >200% WoW
  | 'milestone_approaching'         // Subscriber milestone within reach
  | 'ab_test_ready'                 // Enough data for A/B test conclusion

export type NotificationSeverity =
  | 'warning'       // needs attention, something declining
  | 'info'          // informational, no urgent action needed
  | 'success'       // something good happened
  | 'opportunity'   // potential gain if acted upon

export interface NotificationData {
  current_value?: number
  previous_value?: number
  delta_percent?: number
  days_below?: number
  threshold?: number
  video_title?: string
  search_term?: string
  [key: string]: number | string | undefined
}


// ═══════════════════════════════════════════════════════════════════════
// Notification Trigger Rules (for implementation reference)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Trigger rules define when Cowork should generate notifications.
 * These are evaluated during analysis and included in the PATCH payload.
 *
 * | Trigger                  | Condition                                                      | Severity    | Cooldown |
 * |--------------------------|----------------------------------------------------------------|-------------|----------|
 * | ctr_drop                 | CTR dropped >25% vs 30d avg for 3+ consecutive days           | warning     | 7 days   |
 * | grade_drop               | Video had grade B or A, now has grade D                        | warning     | 30 days  |
 * | stagnant_after_test      | A/B test completed >14d ago, CTR still below pre-test level   | info        | 30 days  |
 * | optimization_opportunity | >10k impressions AND CTR < 3% (high potential, low conversion) | info        | 14 days  |
 * | viral_detection          | Views in 48h > 5x channel avg per video                       | success     | 7 days   |
 * | retention_cliff          | >30% drop in a single 10-second segment of retention curve    | warning     | 30 days  |
 * | search_surge             | Search term with relevant video grew >200% WoW                | opportunity | 14 days  |
 * | milestone_approaching    | Subscriber count within 10% of next round milestone           | info        | 30 days  |
 * | ab_test_ready            | Active test has >1000 impressions per variant + 7d data       | info        | 7 days   |
 */

export interface NotificationTriggerRule {
  trigger: NotificationTrigger
  condition: string
  severity: NotificationSeverity
  cooldown_days: number
}

export const NOTIFICATION_TRIGGER_RULES: NotificationTriggerRule[] = [
  { trigger: 'ctr_drop', condition: 'CTR dropped >25% vs 30d avg for 3+ days', severity: 'warning', cooldown_days: 7 },
  { trigger: 'grade_drop', condition: 'Grade dropped from B/A to D', severity: 'warning', cooldown_days: 30 },
  { trigger: 'stagnant_after_test', condition: 'AB test completed >14d, no CTR improvement', severity: 'info', cooldown_days: 30 },
  { trigger: 'optimization_opportunity', condition: '>10k impressions, CTR < 3%', severity: 'info', cooldown_days: 14 },
  { trigger: 'viral_detection', condition: '48h views > 5x channel avg', severity: 'success', cooldown_days: 7 },
  { trigger: 'retention_cliff', condition: '>30% drop in 10s retention segment', severity: 'warning', cooldown_days: 30 },
  { trigger: 'search_surge', condition: 'Search term grew >200% WoW', severity: 'opportunity', cooldown_days: 14 },
  { trigger: 'milestone_approaching', condition: 'Subs within 10% of milestone', severity: 'info', cooldown_days: 30 },
  { trigger: 'ab_test_ready', condition: '>1000 imp/variant + 7d data', severity: 'info', cooldown_days: 7 },
]


// ═══════════════════════════════════════════════════════════════════════
// Benchmarks (for implementation reference)
// ══════════════════════════════════════════════════════��════════════════

export interface NicheBenchmarks {
  niche: string
  avg_ctr: number
  good_ctr: number
  great_ctr: number
  avg_retention_short: number    // videos < 5min
  avg_retention_medium: number   // videos 5-15min
  avg_retention_long: number     // videos 15-30min
  avg_engagement_rate: number
}

export const DEFAULT_BENCHMARKS: NicheBenchmarks = {
  niche: 'tech_education',
  avg_ctr: 4.5,
  good_ctr: 6.0,
  great_ctr: 8.0,
  avg_retention_short: 50,
  avg_retention_medium: 40,
  avg_retention_long: 30,
  avg_engagement_rate: 4.0,
}

export interface ChannelSizeTier {
  name: 'small' | 'medium' | 'large'
  min_subscribers: number
  max_subscribers: number
  ctr_modifier: number
  retention_modifier: number
  growth_modifier: number
  engagement_modifier: number
}

export const CHANNEL_SIZE_TIERS: ChannelSizeTier[] = [
  { name: 'small', min_subscribers: 0, max_subscribers: 10_000, ctr_modifier: 0.8, retention_modifier: 0.85, growth_modifier: 0.7, engagement_modifier: 0.9 },
  { name: 'medium', min_subscribers: 10_000, max_subscribers: 100_000, ctr_modifier: 1.0, retention_modifier: 1.0, growth_modifier: 1.0, engagement_modifier: 1.0 },
  { name: 'large', min_subscribers: 100_000, max_subscribers: Infinity, ctr_modifier: 1.2, retention_modifier: 1.1, growth_modifier: 1.3, engagement_modifier: 1.15 },
]

export function getChannelSizeTier(subscriberCount: number): ChannelSizeTier {
  return CHANNEL_SIZE_TIERS.find(
    t => subscriberCount >= t.min_subscribers && subscriberCount < t.max_subscribers
  ) ?? CHANNEL_SIZE_TIERS[1]
}

/**
 * Grade thresholds based on score (views relative to channel average)
 *
 * A: score >= 2.0 (2x+ channel average)
 * B: score >= 1.2 (20%+ above average)
 * C: score >= 0.7 (within normal range)
 * D: score < 0.7  (30%+ below average)
 */
export const GRADE_THRESHOLDS = {
  A: 2.0,
  B: 1.2,
  C: 0.7,
} as const
