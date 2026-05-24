export type BlogTabId = 'editorial' | 'schedule' | 'analytics'

export interface BlogTag {
  id: string
  name: string
  slug: string
  color: string
  colorDark: string | null
  badge: string | null
  nameTranslations: Record<string, string> | null
  sortOrder: number
  postCount: number
}

export interface BlogHubSharedData {
  tags: BlogTag[]
  tabBadges: { editorial: number }
  siteTimezone: string
  siteName: string
  defaultLocale: string
  supportedLocales: string[]
}

export interface PostCard {
  id: string
  displayId: string
  title: string
  status: 'idea' | 'draft' | 'pending_review' | 'ready' | 'queued' | 'scheduled' | 'published' | 'archived'
  tagId: string | null
  tagName: string | null
  tagColor: string | null
  tagNameTranslations: Record<string, string> | null
  locales: string[]
  readingTimeMin: number | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  scheduledFor: string | null
  slotDate: string | null
  snippet: string | null
  coverImageUrl: string | null
  excerpt: string | null
}

export interface EditorialTabData {
  velocity: {
    throughput: number
    avgIdeaToPublished: number
    movedThisWeek: number
    bottleneck: { column: string; avgDays: number } | null
    totalPosts: number
    publishedCount: number
  }
  posts: PostCard[]
}

export interface ScheduleSlot {
  date: string
  posts: Array<{ id: string; displayId: string; title: string; tagName: string | null; tagColor: string | null; tagNameTranslations: Record<string, string> | null; status: string; locale: string }>
  emptySlots: Array<{ locale: string }>
}

export interface BlogCadenceConfig {
  locale: string
  cadenceDays: number
  preferredSendTime: string
  cadenceStartDate: string | null
  cadencePaused: boolean
  lastPublishedAt: string | null
}

export interface ReadyPost {
  id: string
  displayId: string
  title: string
  tagName: string | null
  tagColor: string | null
  tagNameTranslations: Record<string, string> | null
  locales: string[]
}

export interface ScheduleTabData {
  healthStrip: {
    fillRate: number
    next7Days: number
    avgReadingTime: number
    activeLocales: number
    totalLocales: number
  }
  calendarSlots: ScheduleSlot[]
  cadenceConfigs: BlogCadenceConfig[]
  readyPosts: ReadyPost[]
}

export type LaneId = 'idea' | 'draft' | 'ready' | 'scheduled' | 'published'

export interface PipelinePlaylistRef {
  id: string
  name: string
  slug: string
}

export interface PipelineCardItem {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  format: string
  stage: 'idea' | 'draft' | 'ready' | 'scheduled' | 'published' | 'archived'
  language: string
  priority: number
  hook: string | null
  body_content: string | null
  tags: string[]
  production_checklist: Array<{ label: string; done: boolean }>
  updated_at: string
  created_at: string
  blog_post_id: string | null
  cover_image_url: string | null
  validation_score: number
  dependencies: Array<{ dependency_type: string; depends_on_pipeline: { code: string } }>
  sort_order: number
  version: number
  is_archived: boolean
  playlists: PipelinePlaylistRef[]
}

export interface UnifiedLanes {
  idea: PipelineCardItem[]
  draft: PipelineCardItem[]
  ready: PipelineCardItem[]
  scheduled: PipelineCardItem[]
  published: PipelineCardItem[]
}

export interface LaneDef {
  id: LaneId
  label: string
  color: string
  dataSource: 'pipeline'
}
