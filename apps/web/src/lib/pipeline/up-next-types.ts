import type { Stage } from './up-next-constants'
import type { SyncScheduleEntry } from '@/lib/youtube/types'
import type { BufferDepthResult } from './scan-buffer-depth'

export interface PipelineItemWithSlot {
  id: string
  title: string
  stage: Stage
  priority: number
  format: 'video' | 'blog_post' | 'newsletter' | 'course' | 'campaign'
  language: 'pt-br' | 'en' | 'both'
  duration_target: number | null
  scheduled_at: string | null
  youtube_channel_id: string | null
  playlist_id: string | null
  playlist_name: string | null
  playlist_position: number | null
  playlist_total: number | null
  channel_label: string | null
}

export interface SyncScheduleWithChannel {
  channel_id: string
  channel_name: string
  locale: 'pt' | 'en'
  schedule: SyncScheduleEntry
}

export interface BlogCadenceRow {
  site_id: string
  cadence_days: number | null
  cadence_start_date: string | null
  cadence_paused: boolean
  last_published_at: string | null
  locale: string | null
}

export interface NewsletterEditionRow {
  id: string
  subject: string
  status: 'idea' | 'draft' | 'ready' | 'queued' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled'
  scheduled_at: string | null
}

export interface PlaylistSummary {
  id: string
  name: string
  total_items: number
  done_items: number
  in_progress_items: number
  next_item_title: string | null
  next_item_stage: Stage | null
}

export interface TodayAction {
  id: string
  itemTitle: string
  actionLabel: string
  format: 'video' | 'blog_post' | 'newsletter' | 'course' | 'campaign'
  language: 'pt-br' | 'en' | 'both'
  effort: 'deep' | 'medium' | 'quick'
  effortEstimate: string
  effortMinutes: number
  urgency: 'overdue' | 'today' | 'tomorrow' | 'this_week'
  priority: number
  stage: Stage
  deadline: { label: string; date: string }
  playlistContext: { name: string; position: number; total: number } | null
  channelLabel: string | null
  pubDate: string | null
  batchItems?: string[]
  isPhantom?: boolean
  urgencyScore?: number
}

export interface TodayActionsInput {
  pipelineItems: PipelineItemWithSlot[]
  blogCadence: BlogCadenceRow | null
  newsletterEditions: NewsletterEditionRow[]
  syncSchedules: SyncScheduleWithChannel[]
  siteTimezone: string
  now: Date
  maxCards: number
  doneToday: number
}

export interface TodayActionsResult {
  actions: TodayAction[]
  overflow: number
  doneToday: number
  totalSurfaced: number
  totalEffortMinutes: number
}

export interface WeekSlot {
  day: string
  dayLabel: string
  hour: string | null
  format: 'video' | 'blog_post' | 'newsletter'
  channelLocale: 'pt' | 'en' | null
  channelId: string | null
  isRestDay: boolean
  assignedItem: { id: string; title: string; stage: Stage } | null
  effortMinutes: number
}

export interface StreakInput {
  publishHistory: string[]
  syncSchedules: SyncScheduleWithChannel[]
  blogCadence: BlogCadenceRow | null
  siteTimezone: string
  now: Date
}

export interface StreakResult {
  currentStreak: number
  isActive: boolean
}

export type SlotCandidate = Pick<PipelineItemWithSlot,
  'id' | 'title' | 'stage' | 'format' | 'language'
  | 'playlist_id' | 'playlist_name' | 'playlist_position' | 'playlist_total'
>

export interface UpNextApiResponse {
  today: TodayActionsResult
  todayDate: string
  weekSlots: WeekSlot[]
  streak: StreakResult
  stageCounts: Record<string, number>
  playlists: PlaylistSummary[]
  candidates: SlotCandidate[]
  nextWeekEmpty: number
  backlogCount: number
  suggestion: { text: string; href: string } | null
  bufferDepth: BufferDepthResult | null
  errors: {
    today: string | null
    weekSlots: string | null
    streak: string | null
    playlists: string | null
  }
}
