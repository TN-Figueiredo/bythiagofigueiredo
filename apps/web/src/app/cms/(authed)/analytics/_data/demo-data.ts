/**
 * Placeholder / demo data for the analytics dashboard.
 *
 * ALL constants and helpers in this file are hardcoded stand-ins.
 * They will be replaced with real DB queries once the analytics
 * backend is wired up.  Keeping them in a single file makes
 * the boundary between "real UI" and "fake data" explicit.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EngagementDataPoint {
  label: string
  values: [number, number, number]  // [pageViews, opens, clicks]
}

export interface EngagementSeries {
  data: EngagementDataPoint[]
  todayIndex: number
}

export interface AudienceSegment {
  label: string
  value: number
  color: string
}

export interface FunnelStep {
  label: string
  value: number
  percentage: number
  color: string
}

export interface TopPost {
  title: string
  views: number
  locale: string
}

export interface TopCampaign {
  title: string
  submissions: number
  convRate: number
}

export interface DemoCampaign {
  title: string
  status: string
  submissions: number
  convRate: number
  locales: { locale: string; submissions: number }[]
  updatedAt: string
}

export interface CampaignKpi {
  label: string
  value: string
}

// ---------------------------------------------------------------------------
// Overview tab data
// ---------------------------------------------------------------------------

export function buildEngagementSeries(period: string): EngagementSeries {
  const counts =
    period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 12
  const labels: string[] = []
  const pageViews: number[] = []
  const opens: number[] = []
  const clicks: number[] = []

  for (let i = 0; i < counts; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (counts - 1 - i))
    labels.push(
      period === '12m'
        ? d.toLocaleDateString('en', { month: 'short' })
        : `${d.getMonth() + 1}/${d.getDate()}`,
    )
    pageViews.push(Math.floor(400 + Math.random() * 600 + Math.sin(i / 4) * 200))
    opens.push(Math.floor(100 + Math.random() * 150 + Math.cos(i / 3) * 60))
    clicks.push(Math.floor(20 + Math.random() * 50 + Math.sin(i / 5) * 20))
  }

  return {
    data: labels.map((label, i) => ({
      label,
      values: [pageViews[i] ?? 0, opens[i] ?? 0, clicks[i] ?? 0],
    })),
    todayIndex: counts - 1,
  }
}

export const AUDIENCE_SEGMENTS: AudienceSegment[] = [
  { label: 'Direct', value: 342, color: '#6366f1' },
  { label: 'Organic Search', value: 218, color: '#22c55e' },
  { label: 'Newsletter', value: 156, color: '#f59e0b' },
  { label: 'Social', value: 89, color: '#06b6d4' },
  { label: 'Referral', value: 47, color: '#a855f7' },
]

export const FUNNEL_STEPS: FunnelStep[] = [
  { label: 'Sent', value: 4820, percentage: 100, color: '#6366f1' },
  { label: 'Delivered', value: 4731, percentage: 98, color: '#22c55e' },
  { label: 'Opened', value: 2104, percentage: 44, color: '#f59e0b' },
  { label: 'Clicked', value: 618, percentage: 13, color: '#06b6d4' },
  { label: 'Bounced', value: 89, percentage: 2, color: '#ef4444' },
]

export const TOP_POSTS: TopPost[] = [
  { title: 'Building a multi-tenant CMS with Next.js 15', views: 2341, locale: 'en' },
  { title: 'LGPD compliance deep-dive: the 3-phase model', views: 1876, locale: 'pt-BR' },
  { title: 'SEO hardening with schema.org JSON-LD', views: 1203, locale: 'en' },
  { title: 'React 19 actions & progressive enhancement', views: 987, locale: 'en' },
  { title: 'Newsletter engine: Resend + RFC 8058', views: 754, locale: 'pt-BR' },
]

export const TOP_CAMPAIGNS: TopCampaign[] = [
  { title: 'Sprint 5 Launch Pack', submissions: 312, convRate: 8.4 },
  { title: 'Developer Newsletter Q1', submissions: 198, convRate: 6.2 },
  { title: 'LGPD Compliance Kit', submissions: 143, convRate: 5.1 },
]

// ---------------------------------------------------------------------------
// Campaigns tab data
// ---------------------------------------------------------------------------

export const LOCALE_FLAG: Record<string, string> = {
  'pt-BR': '\u{1F1E7}\u{1F1F7}',
  en: '\u{1F1FA}\u{1F1F8}',
}

export const CAMPAIGNS: DemoCampaign[] = [
  {
    title: 'Sprint 5 Launch Pack',
    status: 'active',
    submissions: 312,
    convRate: 8.4,
    locales: [
      { locale: 'pt-BR', submissions: 187 },
      { locale: 'en', submissions: 125 },
    ],
    updatedAt: '2026-04-22',
  },
  {
    title: 'Developer Newsletter Q1',
    status: 'active',
    submissions: 198,
    convRate: 6.2,
    locales: [
      { locale: 'pt-BR', submissions: 98 },
      { locale: 'en', submissions: 100 },
    ],
    updatedAt: '2026-04-18',
  },
  {
    title: 'LGPD Compliance Kit',
    status: 'active',
    submissions: 143,
    convRate: 5.1,
    locales: [
      { locale: 'pt-BR', submissions: 143 },
    ],
    updatedAt: '2026-04-15',
  },
  {
    title: 'CMS Architecture Deep-Dive',
    status: 'draft',
    submissions: 0,
    convRate: 0,
    locales: [
      { locale: 'en', submissions: 0 },
    ],
    updatedAt: '2026-04-20',
  },
  {
    title: 'Newsletter Engine Webinar',
    status: 'archived',
    submissions: 87,
    convRate: 3.9,
    locales: [
      { locale: 'pt-BR', submissions: 52 },
      { locale: 'en', submissions: 35 },
    ],
    updatedAt: '2026-03-30',
  },
]

export const CAMPAIGN_KPIS: CampaignKpi[] = [
  { label: 'Total Submissions', value: '2,214' },
  { label: 'Avg Download Rate', value: '8.6%' },
  { label: 'Avg per Campaign', value: '554' },
  { label: 'Active Campaigns', value: '4' },
]
