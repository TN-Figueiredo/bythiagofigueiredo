export type TabId = 'overview' | 'editorial' | 'schedule' | 'automations' | 'audience'

export interface NewsletterType {
  id: string
  name: string
  color: string
  sortOrder: number
  cadencePaused: boolean
  badge: string | null
  subscriberCount: number
}

export interface NewsletterHubSharedData {
  types: NewsletterType[]
  tabBadges: {
    editorial: number
    automations: number
    schedule: number
  }
  siteTimezone: string
  siteName: string
  defaultLocale: string
}

export interface ActivityEvent {
  id: string
  type: 'welcome' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'system'
  description: string
  emailMasked?: string
  timestamp: string
}

export interface OverviewTabData {
  kpis: {
    totalSubscribers: number
    subscribersTrend: number
    editionsSent: number
    editionsThisMonth: number
    avgOpenRate: number
    openRateTrend: number
    avgClickRate: number
    clickRateTrend: number
    bounceRate: number
    bounceTrend: number
  }
  sparklines: Record<'subscribers' | 'editions' | 'openRate' | 'clickRate' | 'bounceRate', number[]>
  healthScore: number
  healthDimensions: Record<'deliverability' | 'engagement' | 'growth' | 'compliance', { score: number; label: string }>
  subscriberGrowth: Array<{ date: string; count: number }>
  funnel: { sent: number; delivered: number; opened: number; clicked: number }
  editionsByType: Array<{ typeId: string; typeName: string; typeColor: string; count: number }>
  openRateTrend: Array<{ date: string; rates: Record<string, number> }>
  publicationPerformance: Array<{
    typeId: string; typeName: string; typeColor: string
    subscribers: number; editionsSent: number; openRate: number; clickRate: number
    sparkline: number[]; paused: boolean
  }>
  topEditions: Array<{ id: string; subject: string; typeId: string; typeName: string; typeColor: string; dateSent: string; opens: number; clicks: number }>
  activityFeed: ActivityEvent[]
  deliverability: { spf: boolean; dkim: boolean; dmarc: boolean; bounceRate: number; complaintRate: number; provider: string }
}

export interface EditionCard {
  id: string
  displayId: string
  subject: string
  preheader: string | null
  status: 'idea' | 'draft' | 'ready' | 'review' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled' | 'archived'
  typeId: string | null
  typeName: string | null
  typeColor: string | null
  createdAt: string
  sentAt: string | null
  ideaCreatedAt: string | null
  reviewEnteredAt: string | null
  slotDate: string | null
  wordCount: number | null
  charCount: number | null
  imageCount: number | null
  readingTimeMin: number | null
  progressPercent: number | null
  ideaNotes: string | null
  snippet: string | null
  stats: { opens: number; clicks: number; bounceRate: number } | null
}

export interface EditorialTabData {
  velocity: { throughput: number; avgIdeaToSent: number; movedThisWeek: number; bottleneck: { column: string; avgDays: number } | null }
  editions: EditionCard[]
  wipLimit: number
}

export type CadenceSlotState = 'empty_future' | 'filled' | 'sending' | 'sent' | 'failed' | 'missed' | 'cancelled'

export interface ScheduleSlot {
  date: string
  cadenceSlots: Array<{
    typeId: string
    typeName: string
    typeColor: string
    state: CadenceSlotState
    editionId?: string
    editionSubject?: string
    editionDisplayId?: string
  }>
  specialEditions: Array<{
    id: string
    displayId: string
    subject: string
    typeColor: string
    typeName: string | null
    status: string
  }>
}

export interface CadenceConfig {
  typeId: string; typeName: string; typeColor: string
  cadence: string; cadenceDays: number; dayOfWeek: string; time: string; nextDate: string
  cadenceStartDate: string | null
  paused: boolean; subscribers: number; editionsSent: number; openRate: number
  conflicts: string[]
}

export interface ReadyEdition {
  id: string
  displayId: string
  subject: string
  typeColor: string | null
  typeName: string | null
  typeId: string | null
  editionKind: 'cadence' | 'special'
}

export interface ScheduleTabData {
  healthStrip: { fillRate: number; next7Days: number; missed: number; failed: number; activeTypes: number; totalTypes: number }
  calendarSlots: ScheduleSlot[]
  cadenceConfigs: CadenceConfig[]
  sendWindow: { time: string; timezone: string; bestTimeInsight: string }
  readyEditions: ReadyEdition[]
}

export interface WorkflowData {
  id: string; name: string; type: 'welcome' | 're_engagement' | 'bounce_handler'
  enabled: boolean; stats: Record<string, number>
  pipelineCounts?: Record<string, number>
  incident?: { date: string; description: string }
}

export interface CronJobData {
  name: string; expression: string; frequency: string
  lgpd: boolean; lastRuns: Array<{ date: string; success: boolean }>
}

export interface AutomationsTabData {
  healthStrip: { workflowsActive: number; cronsHealthy: number; eventsToday: number; successRate: number; lastIncidentDaysAgo: number | null }
  workflows: WorkflowData[]
  cronJobs: CronJobData[]
  activityFeed: ActivityEvent[]
}

export interface SubscriberRow {
  id: string
  emailMasked: string
  name: string | null
  initials: string
  types: Array<{ id: string; name: string; color: string }>
  subscribedAt: string
  opens30d: number
  clicks30d: number
  engagementScore: number
  status: 'active' | 'at_risk' | 'bounced' | 'unsubscribed' | 'anonymized'
}

export interface AudienceTabData {
  healthStrip: { uniqueSubscribers: number; confirmedSubscribers: number; pendingSubscribers: number; totalSubscriptions: number; netGrowth30d: number; churnRate: number; avgOpenRate: number; lgpdConsent: number }
  growth: Array<{ date: string; newSubs: number; unsubs: number }>
  distribution: Array<{ typeId: string; typeName: string; typeColor: string; count: number; share: number }>
  engagementByType: Array<{ typeId: string; typeName: string; typeColor: string; subscribers: number; openRate: number; clickRate: number; bounceRate: number; sparkline: number[]; paused: boolean }>
  subscribers: { rows: SubscriberRow[]; total: number; page: number }
  locale: Record<string, number>
  lgpdConsent: { newsletter: number; analytics: number; anonymized: number; version: string }
  recentActivity: ActivityEvent[]
}
