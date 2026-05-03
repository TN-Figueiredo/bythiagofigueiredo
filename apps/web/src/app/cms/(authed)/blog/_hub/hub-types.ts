export type BlogTabId = 'overview' | 'editorial' | 'schedule' | 'analytics'

export interface BlogTag {
  id: string
  name: string
  slug: string
  color: string
  colorDark: string | null
  badge: string | null
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
  locales: string[]
  readingTimeMin: number | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  scheduledFor: string | null
  slotDate: string | null
  snippet: string | null
}

export interface OverviewTabData {
  kpis: {
    totalPosts: number
    totalPostsTrend: number
    published: number
    publishedTrend: number
    avgReadingTime: number
    avgReadingTimeTrend: number
    draftBacklog: number
    draftBacklogTrend: number
  }
  sparklines: Record<'totalPosts' | 'published' | 'avgReadingTime' | 'draftBacklog', number[]>
  tagBreakdown: Array<{ tagId: string | null; tagName: string; tagColor: string; count: number }>
  recentPublications: Array<{
    id: string
    title: string
    tagName: string | null
    tagColor: string | null
    locales: string[]
    publishedAt: string
    readingTimeMin: number | null
  }>
  velocitySparkline: number[]
}

export interface EditorialTabData {
  velocity: {
    throughput: number
    avgIdeaToPublished: number
    movedThisWeek: number
    bottleneck: { column: string; avgDays: number } | null
  }
  posts: PostCard[]
}

export interface ScheduleSlot {
  date: string
  posts: Array<{ id: string; displayId: string; title: string; tagName: string | null; tagColor: string | null; status: string; locale: string }>
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
