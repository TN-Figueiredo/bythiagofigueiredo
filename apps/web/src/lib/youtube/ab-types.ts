import type { RestoreStatus } from '@/lib/youtube/ab-restore'
export const VARIANT_LABELS = ['B', 'C', 'D'] as const
export type VariantLabel = (typeof VARIANT_LABELS)[number]

export type AbTestStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived' | 'queued'
export type CompletedReason = 'auto_resolve' | 'manual_winner' | 'manual_archive' | 'manual_no_apply' | 'manual_apply' | 'max_duration' | 'inconclusive'
export type BackfillStatus = 'pending' | 'partial' | 'confirmed' | 'no_data' | 'error'

/** Razões de encerramento em que uma pessoa escolheu o vencedor. Nenhum caminho automático grava estas. */
export const RAZOES_DE_VITORIA_HUMANA = ['manual_winner', 'manual_apply'] as const

/** Vitória só conta quando humana: tem vencedor gravado E o encerramento foi decisão de pessoa. */
export function ehVitoriaHumana(t: { completed_reason: string | null; winner_variant_id: string | null }): boolean {
  return t.winner_variant_id !== null && (RAZOES_DE_VITORIA_HUMANA as readonly string[]).includes(t.completed_reason ?? '')
}
export type TestType = 'thumbnail' | 'title' | 'combo'

export interface AbTestConfig {
  max_duration_days: number
  confidence_threshold: number
  burn_in_days: number
  /** @deprecated ignorada desde 10/2026 (A/B Lab P2) */
  auto_apply_winner?: boolean
  rotation_pattern: 'abba' | 'round_robin' | 'random'
  stability_threshold: number
}

export const AB_TEST_CONFIG_DEFAULTS: AbTestConfig = {
  max_duration_days: 14,
  confidence_threshold: 0.95,
  burn_in_days: 2,
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
  drift_acknowledged_at: string | null
  applied_by: string | null
  /** Retrato da restauração (jsonb cru; leitura tolerante por `paraRestoreStatus`). */
  restore_status?: unknown
  /** Contador de reivindicações de saída (CAS do diálogo de pausar/encerrar). */
  restore_seq?: number
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
  metadata: VariantMetadata
  sort_order: number
  created_at: string
  source_variant_id: string | null
}

export const DRIFT_STATUS_NOTE = 'Thumbnail alterado externamente' as const

export interface AppliedMetadata {
  thumbnail_set?: boolean
  title_set?: string | null
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

export interface ReferenciaDoTeste {
  refVideoId: string | null
  refTroca: string | null
  tipo: 'thumbnail' | 'title'
}

export interface AbTestCreateInput {
  site_id: string
  youtube_video_id: string
  name: string
  test_type?: TestType
  config?: Partial<AbTestConfig>
  /** Vídeo do concorrente de onde o assistente foi aberto (aviso A5 3). Só ids; sem título nem URL de imagem. */
  referencia?: ReferenciaDoTeste
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
  /** "LxA" em texto (ex.: "1280x720"); nulo = original de antes da T4 ou sem thumbnail guardada. */
  dimensions?: string | null
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
  metadata?: Partial<VariantMetadata>
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

/** Contagem de uma variante para a estatística. Nulo = não medido: nunca vira 0. */
export interface ContagemDaVariante {
  variant_id: string
  total_impressions: number | null
  total_clicks: number | null
}

export type ResultadoZ =
  | { estado: 'nao_medido' }
  | { estado: 'sem_volume' }
  | { estado: 'calculado'; z: number; p: number }

export type ResultadoBayes = { estado: 'nao_medido' } | ({ estado: 'calculado' } & BayesianResult)

export interface AbTestSiteSettings {
  default_duration_days: number
  default_confidence: number
  /** @deprecated ignorada desde 10/2026 (A/B Lab P2) */
  default_auto_apply?: boolean
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
  latestPolls?: AbTestPollRow[]
  /** Id do vídeo no YouTube (`youtube_videos.youtube_video_id`), do join; nulo = vídeo não achado. */
  youtubeId?: string | null
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

export interface FullChartVariant extends ChartVariant {
  /** nulo = não medido (S8-F2: toda variante até a F3) */
  ctr: number | null
  impressions: number | null
  clicks: number | null
  /** nulo = não calculado; nunca 0 por padrão */
  pBest: number | null
  linkClicks?: number
  linkCtr?: number
  retention?: number
}

/* --- Dashboard view types (Phase 3) --- */

export interface DashboardStats {
  activeTests: number
  /** % de vitórias humanas entre os testes que contam; null quando nenhum conta. */
  winRate: number | null
  /** Total de testes concluídos raiz (sem filho de playoff), contem ou não para o win rate. */
  completedTests: number
  /** Denominador do win rate: só os concluídos por pessoa ou limite de duração. */
  winRateBase: number
  testsWon: number
}

export interface AbTestCardView {
  id: string
  name: string
  type: TestType
  status: AbTestStatus
  dayOf: number
  /** Duração prevista em dias (config.max_duration_days); ausente = padrão. */
  durationDays?: number
  confidence: number | null
  lift: number | null
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
  /** T10: só nos pausados por teste do YouTube (`status_note = NOTA_TESTE_YOUTUBE`); preenchido pela página (servidor). */
  pausaYoutube?: { aberto: boolean; ate: string | null }
}

export interface AbTestDraftVariant {
  label: string
  isOriginal: boolean
  thumbUrl: string | null
  titleText: string
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
  impressions?: number | null
  confidence?: number
}

export interface LearningsTag {
  tag: string
  wins: number
  total?: number
  confidence?: number
  /** null = nenhuma vitória com lift medido (nunca 0). */
  avgLift: number | null
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
  /** `nao_medido`: o gate não tem base (dado nulo); nunca é aprovação nem 0. */
  estado?: 'nao_medido'
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
  /** Per-variant title. null = use the parent video's original title. */
  titleText: string | null
}

export interface VariantDbEntry {
  id: string
  label: DisplayLabel
  is_original: boolean
  blob_url: string | null
  /** Título da variante; nulo = o do vídeo (original). */
  title_text?: string | null
  /** "LxA" em texto; só a original importa (aviso de baixa resolução). */
  dimensions?: string | null
}

export interface AbTestBaseView {
  id: string
  videoTitle: string
  flag: TestType
  status: AbTestStatus
  variants: FullChartVariant[]
  variantThumbs: VariantThumb[]
  /** DB row IDs for each variant — used by action dialogs (pause/end/archive). */
  variantDb: VariantDbEntry[]
  confTrend: number[]
  daily: Record<DisplayLabel, number[]>
  abbaSeq: DisplayLabel[]
  cycles: { total: number; done: number }
  /** Dia corrido do teste (mesma conta da lista e do cartão); ciclos são outra grandeza (`cycles`). */
  dayOf: number
  durationDays: number
  confidenceTarget: number
  totalRounds: number
  hasPlayoff: boolean
  gates: GateResult[]
  activeNow: DisplayLabel | null
  createdAt: string
  /** Retrato da restauração já validado; nulo = mundo antigo ou ilegível (a página distingue pelo jsonb cru). */
  restoreStatus: RestoreStatus | null
  /** Id do vídeo no YouTube (link do Studio); nulo = sem link. */
  youtubeVideoId: string | null
  /** Variante do último ciclo fechado (a que estava no ar quando o teste saiu) e quando entrou. */
  noArAntes: { label: DisplayLabel; desde: string | null } | null
  /** Variante do ciclo aberto (no ar agora) e quando entrou; nulo = nenhum ciclo aberto. */
  noArAgora?: { label: DisplayLabel; desde: string | null } | null
  /** `restore_seq` no momento da leitura: a tela devolve como `seqVisto` ao pausar/encerrar (recusa se mudou em outra aba). */
  restoreSeq: number
}

export interface AbTestActiveView extends AbTestBaseView {
  status: 'active' | 'paused'
  outcome?: never
  confirmedData: {
    confidence: number | null
    leader: DisplayLabel
    leaderColor: string
    lift: number | null
  }
  liveData?: {
    confidence: number | null
    leader: DisplayLabel
    leaderColor: string
    lift: number | null
  }
  pollData?: { viewsDelta: number; likesDelta: number; polledAt: string }
  outlier?: { multiplier: number; badge: 'blue' | 'purple' | 'red' } | null
  daysRemaining?: { days: number; model: 'exponential' | 'linear' } | null
  statusNote: string | null
  /** T10: só no pausado por teste do YouTube; preenchido pela página (servidor). */
  pausaYoutube?: { aberto: boolean; ate: string | null }
  driftAcknowledgedAt: string | null
  variantDb: VariantDbEntry[]
  graceExpiresAt?: string | null
  winnerAppliedAt?: string | null
}

export interface AbTestWinnerView extends AbTestBaseView {
  status: 'completed'
  outcome: 'winner'
  winnerLabel: DisplayLabel
  winnerColor: string
  lift: number | null
  confidence: number | null
  resultMeta: {
    ctrBefore: number | null
    ctrAfter: number | null
    totalImpressions: number | null
    abbaCycles: number
    monthlyExtraClicks: number | null
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
  finalists: Array<{ label: DisplayLabel; color: string; ctr: number | null; thumbnailUrl: string | null }>
  confidenceReached: number | null
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
