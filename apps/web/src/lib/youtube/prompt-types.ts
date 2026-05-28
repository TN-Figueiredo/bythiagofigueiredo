import type { Axis, Grade, VideoLifecycle, TrendDirection, ChannelTier } from './scoring-types'

export type ContextPreset = 'content-calendar' | 'channel-health' | 'video-optimizer'

export const PROMPT_VERSIONS = {
  'content-calendar': 'yt-cc-v9',
  'channel-health': 'yt-ch-v9',
  'video-optimizer': 'yt-vo-v9',
} as const satisfies Record<ContextPreset, string>

export const STALENESS_THRESHOLDS = { warn: 24, critical: 48 } as const

export const EXAMPLE_PROMPTS: Record<ContextPreset, string[]> = {
  'content-calendar': [
    'Qual nicho devo explorar no próximo vídeo?',
    'Melhor dia e hora para publicar?',
    'Que tópicos estão dando mais retenção?',
  ],
  'channel-health': [
    'O que está segurando o crescimento do canal?',
    'Quais vídeos devo otimizar primeiro?',
    'Compare meu CTR com o benchmark do canal',
  ],
  'video-optimizer': [
    'Por que a retenção deste vídeo está baixa?',
    'Sugira uma nova thumbnail para melhorar CTR',
    'O que posso melhorar no título?',
  ],
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`)
}

export interface PromptChannelInfo {
  name: string
  subscribers: number
  videoCount: number
  tier: ChannelTier
}

export interface ContentCalendarData {
  channel: PromptChannelInfo
  searchTerms: { term: string; views: number; estimatedMinutesWatched: number }[]
  topPerformingCategories: { categorySlug: string; categoryName: string; avgViews: number; avgRetention: number; videoCount: number }[]
  demographics: { topAge: string; topCountry: string; topDevice: string }
  outlierSuccesses: OutlierRow[]
  bestPerformingDay: string | null
  bestPerformingHour: number | null
  recentUploads: { title: string; publishedAt: string; categorySlug: string }[]
  snapshotAt: string
  snapshotAgeHours: number
  truncated?: boolean
}

export interface ChannelHealthData {
  channel: PromptChannelInfo
  healthScore: {
    overall: number
    axes: { axis: Axis; score: number; grade: Grade; benchmark: number; weight: number }[]
  } | null
  topVideos: VideoGradeRow[]
  bottomVideos: VideoGradeRow[]
  gradeDistribution: Record<Grade, number>
  demographics: { topAge: string; topCountry: string; topDevice: string }
  searchTerms: { term: string; views: number; estimatedMinutesWatched: number }[]
  outliers: { positive: OutlierRow[]; negative: OutlierRow[] }
  abTestResults: AbTestResultRow[]
  cyclesSummary: { active: number; resolved: number; exhausted: number }
  totalVideos: number
  showingTopN: number
  snapshotAt: string
  snapshotAgeHours: number
  truncated?: boolean
}

export interface VideoOptimizerData {
  channel: PromptChannelInfo
  grade: {
    score: number
    grade: Grade
    axes: { axis: Axis; score: number; channelMedian: number; status: 'above' | 'below' }[]
    trend: TrendDirection
    streak: number
  }
  retentionCurve: number[]
  trafficSources: { browse: number; search: number; suggested: number; other: number }
  optimizationState: string
  cycleNumber: number
  maxCycles: number
  cooldownUntil: string | null
  previousDiagnosis: string | null
  channelBaseline: { medianCtr: number; medianRetention: number }
  snapshotAt: string
  snapshotAgeHours: number
  truncated?: boolean
}

export interface VideoGradeRow {
  id: string
  youtubeVideoId: string
  title: string
  score: number
  grade: Grade
  retention: number
  trend: TrendDirection
  lifecycleStage?: VideoLifecycle
}

export interface OutlierRow {
  title: string
  modifiedZ: number
  views: number
  axis?: Axis
}

export interface AbTestResultRow {
  videoTitle: string
  testType: string
  winner: string
  confidence: number
}

export interface PromptVideoInfo {
  id: string
  youtubeVideoId: string
  title: string
  thumbnailUrl: string | null
  duration: string
  publishedAt: string
  ageDays: number
  lifecycleStage: VideoLifecycle
  viewCount: number
  thumbnailTags?: string[]
  titlePattern?: string
}

export type BuildYoutubePromptOptions =
  | { preset: 'content-calendar'; data: ContentCalendarData; instructions: string }
  | { preset: 'channel-health'; data: ChannelHealthData; instructions: string }
  | { preset: 'video-optimizer'; data: VideoOptimizerData; video: PromptVideoInfo; instructions: string }

