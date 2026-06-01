export const VARIANT_LABELS = ['B', 'C', 'D'] as const
export type VariantLabel = (typeof VARIANT_LABELS)[number]

export type AbTestStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived' | 'queued'
export type CompletedReason = 'auto_resolve' | 'manual_winner' | 'manual_archive' | 'manual_no_apply' | 'manual_apply' | 'max_duration' | 'inconclusive'
export type BackfillStatus = 'pending' | 'partial' | 'confirmed' | 'no_data' | 'error'
export type TestType = 'thumbnail' | 'title' | 'description' | 'combo'

export interface AbTestConfig {
  max_duration_days: number
  confidence_threshold: number
  burn_in_days: number
  auto_apply_winner: boolean
  rotation_pattern: 'abba' | 'round_robin' | 'random'
  stability_threshold: number
}

export const AB_TEST_CONFIG_DEFAULTS: AbTestConfig = {
  max_duration_days: 14,
  confidence_threshold: 0.95,
  burn_in_days: 2,
  auto_apply_winner: true,
  rotation_pattern: 'abba',
  stability_threshold: 3,
}

export interface AbTestRow {
  id: string
  site_id: string
  youtube_video_id: string
  source_pipeline_id: string | null
  name: string
  status: AbTestStatus
  config: AbTestConfig
  test_type: TestType
  original_thumbnail_url: string
  original_title: string | null
  original_description: string | null
  winner_variant_id: string | null
  started_at: string | null
  paused_at: string | null
  completed_at: string | null
  completed_reason: CompletedReason | null
  confidence_at_completion: number | null
  consecutive_confident_evals: number
  status_note: string | null
  result_metadata: ResultMetadata | null
  created_at: string
  updated_at: string
  parent_test_id: string | null
  round_number: number
  playoff_test_id: string | null
  playoff_start_after: string | null
  last_applied_variant_id: string | null
  queue_start_after: string | null
  grace_expires_at: string | null
  winner_applied_at: string | null
  revert_expires_at: string | null
  applied_by: string | null
}

export interface VariantMetadata {
  thumbnail_tags?: string[]
  title_pattern?: string
  emotional_triggers?: string[]
  visual_description?: string
  ai_image_prompt?: string
  creative_direction?: string
  rationale?: string
  composition?: { face_position?: string; background?: string; product_placement?: string }
  palette?: Array<{ hex: string; role: string; purpose?: string }>
  text_overlay?: { text: string; font?: string; size?: string; position?: string }
  expression?: string
  synergy?: { division?: string; reinforcement?: string }
  score?: { thumbnail: number; title: number; combo: number }
  classification?: 'hero' | 'challenger' | 'safety'
}

export interface AbTestVariantRow {
  id: string
  test_id: string
  label: string
  is_original: boolean
  blob_url: string | null
  blob_key: string | null
  file_size_bytes: number | null
  dimensions: string | null
  title_text: string | null
  description_text: string | null
  metadata: VariantMetadata
  sort_order: number
  created_at: string
  source_variant_id: string | null
}

export interface AppliedMetadata {
  thumbnail_set?: boolean
  title_set?: string | null
  description_set?: string | null
  links_resolved?: Record<string, string>
  youtube_thumbnail_url?: string
}

export interface AbTestCycleRow {
  id: string
  test_id: string
  variant_id: string
  cycle_number: number
  started_at: string
  ended_at: string | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
  estimated_impressions: number | null
  estimated_clicks: number | null
  estimated_ctr: number | null
  backfill_status: BackfillStatus
  backfill_attempts: number
  applied_metadata: AppliedMetadata | null
  created_at: string
}

export interface AbTestWithVariants extends AbTestRow {
  variants: AbTestVariantRow[]
  current_cycle: AbTestCycleRow | null
  total_cycles: number
}

export interface AbTestCreateInput {
  site_id: string
  youtube_video_id: string
  name: string
  test_type?: TestType
  config?: Partial<AbTestConfig>
}

export interface CreateVariantInput {
  test_id: string
  file: File
  label?: string
}

export interface VariantStats {
  variant_id: string
  label: string
  blob_url: string | null
  title_text: string | null
  description_text: string | null
  metadata: VariantMetadata
  is_original: boolean
  total_impressions: number
  total_clicks: number
  avg_ctr: number
  cycles_completed: number
}

export interface CreateTextVariantInput {
  test_id: string
  label?: string
  title_text?: string
  description_text?: string
  metadata?: Partial<VariantMetadata>
  link_destinations?: Record<string, string>
}

export interface AbTestTrackedLinkRow {
  id: string
  ab_test_id: string
  variant_id: string
  link_id: string
  template_name: string
  short_code: string
  created_at: string
}

export interface ResultMetadata {
  ctr_lift_percent: number
  winner_label: string
  total_impressions: number
  estimated_monthly_extra_clicks: number
}

export interface BayesianResult {
  winnerId: string
  confidence: number
  probabilities: Record<string, number>
}

export interface ZTestResult {
  zScore: number
  pValue: number
  significant: boolean
}

export interface EvaluationResult {
  confidence: number
  winnerId: string | null
  bayesian: BayesianResult
  zTest: ZTestResult | null
  gates: { name: string; passed: boolean; detail: string }[]
  shouldResolve: boolean
}

export interface AbTestSiteSettings {
  default_duration_days: number
  default_confidence: number
  default_auto_apply: boolean
  default_burn_in_days: number
  ctr_drop_trigger: {
    enabled: boolean
    threshold_percent: number
    min_days_below: number
  }
  post_publish_trigger: {
    enabled: boolean
    delay_hours: number
    requires_pipeline_thumbs: boolean
  }
  notifications: {
    test_completed: boolean
    test_auto_paused: boolean
    ctr_drop_alert: boolean
    daily_digest: boolean
  }
}

export const AB_SITE_SETTINGS_DEFAULTS: AbTestSiteSettings = {
  default_duration_days: 14,
  default_confidence: 0.95,
  default_auto_apply: true,
  default_burn_in_days: 2,
  ctr_drop_trigger: { enabled: false, threshold_percent: 20, min_days_below: 7 },
  post_publish_trigger: { enabled: false, delay_hours: 48, requires_pipeline_thumbs: true },
  notifications: { test_completed: true, test_auto_paused: true, ctr_drop_alert: false, daily_digest: false },
}

export interface AbTestPollRow {
  variant_id: string
  views: number
  likes: number
  polled_at: string
}

export interface AbTestResults {
  test: AbTestRow
  variants: VariantStats[]
  confidence: number
  is_significant: boolean
  suggested_winner_id: string | null
  timeline: AbTestCycleRow[]
  data_freshness: string
  tracked_links: AbTestTrackedLinkRow[]
  latestPolls?: AbTestPollRow[]
}

/* --- Chart variant hierarchy (Layer 1 redesign) --- */
export type DisplayLabel = 'A' | 'B' | 'C' | 'D'

export interface ChartVariant {
  label: DisplayLabel
  color: string
}

export interface StatsVariant extends ChartVariant {
  ctr: number
  impressions: number
}

export interface RankedVariant extends ChartVariant {
  pBest: number
  pTop2: number
}

export interface FullChartVariant extends StatsVariant, RankedVariant {
  clicks: number
  linkClicks?: number
  linkCtr?: number
  retention?: number
}

/* --- Dashboard view types (Phase 3) --- */

export interface DashboardStats {
  activeTests: number
  avgConfidence: number
  winRate: number
  avgLift: number
  completedTests: number
  testsWon: number
}

export interface AbTestCardView {
  id: string
  name: string
  type: TestType
  status: AbTestStatus
  dayOf: number
  confidence: number
  lift: number
  leader: DisplayLabel
  leaderColor: string
  leaderThumbUrl: string | null
  variants: Array<{ label: DisplayLabel; color: string; thumbUrl: string | null }>
  hasPlayoff: boolean
  roundNumber: number
  createdAt: string
  statusNote: string | null
  cycleStartedAt: string | null
  queueStartAfter: string | null
}

export interface AbTestDraftVariant {
  label: string
  isOriginal: boolean
  thumbUrl: string | null
  titleText: string
  descriptionText: string
}

export interface AbTestDraft {
  id: string
  name: string
  type: TestType
  step: number
  thumbUrl: string | null
  createdAt: string
  createdAgo: string
  videoId: string
  sourcePipelineId: string | null
  variants?: AbTestDraftVariant[]
}

export interface SuggestedVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  ctr: number
  channelMedianCtr: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  reason: string
  suggest: TestType
  impressions?: string
  confidence?: number
}

export interface LearningsTag {
  tag: string
  wins: number
  total?: number
  confidence?: number
  avgLift: number
  kind: 'thumb' | 'title' | 'desc'
  negative?: boolean
}

export interface LearningsData {
  tags: LearningsTag[]
  totalTests: number
  insightText: string
}

export interface ChannelLearningsEntry {
  channelId: string
  channelName: string
  learnings: LearningsData
}

export interface ChannelLearningsData {
  channels: ChannelLearningsEntry[]
  combined: LearningsData
}

export interface EligibleVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  channelHandle: string
  hasActiveTest: boolean
  previousLift: number | null
  sourcePipelineId: string | null
}

/* --- Detail view types (Phase 4) --- */

export interface GateResult {
  name: string
  passed: boolean
  value: string
  hint?: string
}

export interface LiveMonitor {
  liveCtr: number
  sparkline: number[]
  liftVsOriginal: number
  checkpoints: Array<{ label: string; reached: boolean; date?: string }>
}

export interface VariantThumb {
  label: DisplayLabel
  color: string
  thumbUrl: string | null
  isOriginal: boolean
}

export interface AbTestBaseView {
  id: string
  videoTitle: string
  flag: TestType
  status: AbTestStatus
  variants: FullChartVariant[]
  variantThumbs: VariantThumb[]
  confTrend: number[]
  daily: Record<DisplayLabel, number[]>
  abbaSeq: DisplayLabel[]
  cycles: { total: number; done: number }
  durationDays: number
  confidenceTarget: number
  totalRounds: number
  hasPlayoff: boolean
  gates: GateResult[]
  activeNow: DisplayLabel | null
}

export interface AbTestActiveView extends AbTestBaseView {
  status: 'active' | 'paused'
  outcome?: never
  confirmedData: {
    confidence: number
    leader: DisplayLabel
    leaderColor: string
    lift: number
  }
  liveData?: {
    confidence: number
    leader: DisplayLabel
    leaderColor: string
    lift: number
  }
  pollData?: { viewsDelta: number; likesDelta: number; polledAt: string }
  outlier?: { multiplier: number; badge: 'blue' | 'purple' | 'red' } | null
  revenue?: { low: number; high: number; currency: 'BRL'; isDefault: boolean }
  daysRemaining?: { days: number; model: 'exponential' | 'linear' } | null
  graceExpiresAt?: string | null
  winnerAppliedAt?: string | null
}

export interface AbTestWinnerView extends AbTestBaseView {
  status: 'completed'
  outcome: 'winner'
  winnerLabel: DisplayLabel
  winnerColor: string
  lift: number
  confidence: number
  resultMeta: {
    ctrBefore: number
    ctrAfter: number
    totalImpressions: number
    abbaCycles: number
    monthlyExtraClicks: number
  }
  monitor?: LiveMonitor
  learning?: string
  revertExpiresAt?: string | null
  winnerAppliedAt?: string | null
}

export interface AbTestPlayoffView extends AbTestBaseView {
  status: 'completed'
  outcome: 'playoff'
  playoffTestId: string
  startsIn: string
  finalists: Array<{ label: DisplayLabel; color: string; ctr: number; thumbnailUrl: string | null }>
  confidenceReached: number
  reason: string
}

export type AbTestDetailView = AbTestActiveView | AbTestWinnerView | AbTestPlayoffView

// P5: Competitor Observatory
export interface CompetitorChannel {
  id: string
  siteId: string
  channelId: string
  channelName: string
  thumbnailUrl: string | null
  subscriberCount: number | null
  addedAt: string
  lastSyncedAt: string | null
}

export interface CompetitorVideo {
  id: string
  competitorChannelId: string
  videoId: string
  title: string | null
  thumbnailUrl: string | null
  viewCount: number
  publishedAt: string | null
}

export interface CompetitorChange {
  id: string
  videoId: string
  siteId: string
  changeType: 'title' | 'description' | 'thumbnail'
  oldTitle: string | null
  newTitle: string | null
  oldThumbnailUrl: string | null
  newThumbnailUrl: string | null
  viewCountAtChange: number | null
  detectedAt: string
  bookmarked: boolean
}

// P6: Thumbnail Intelligence
export interface ThumbnailLibraryEntry {
  id: string
  siteId: string
  sourceTestId: string | null
  sourceType: 'test_winner' | 'manual_upload' | 'competitor_bookmark'
  blobUrl: string
  title: string | null
  tags: string[]
  videoTitle: string | null
  ctrAtWin: number | null
  liftAtWin: number | null
  createdAt: string
}

export type LongevityStatus = 'holding' | 'fading' | 'growing'

export interface ThumbnailLongevity {
  id: string
  libraryId: string
  checkpointDays: 7 | 30 | 60 | 90
  ctrAtCheckpoint: number | null
  ctrAtWin: number | null
  changePercent: number | null
  status: LongevityStatus
  checkedAt: string
}
