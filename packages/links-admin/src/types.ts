// ---------------------------------------------------------------------------
// Component prop types for @tn-figueiredo/links-admin
// ---------------------------------------------------------------------------

export interface LinkSummary {
  id: string
  code: string
  slug: string | null
  title: string | null
  destination_url: string
  source_type: string
  tags: string[]
  active: boolean
  redirect_type: number
  expires_at: string | null
  total_clicks: number
  unique_visitors: number
  last_clicked_at: string | null
  created_at: string
  updated_at: string
}

export interface DashboardKpis {
  totalLinks: number
  totalClicks: number
  activeLinks: number
  topPerformer: { code: string; clicks: number } | null
}

export interface DateRange {
  from: Date
  to: Date
}

export interface AnalyticsMetrics {
  totalClicks: number
  uniqueVisitors: number
  conversionRate: number | null
  topCountry: string | null
  dailyClicks: Array<{ date: string; clicks: number; unique: number }>
}

export interface DeviceData {
  device: Array<{ name: string; count: number }>
  browser: Array<{ name: string; count: number }>
  os: Array<{ name: string; count: number }>
}

export interface ReferrerData {
  items: Array<{ domain: string; count: number }>
}

export interface GeoDataItem {
  country: string
  count: number
}

export interface HourlyData {
  matrix: number[][] // 7 rows (days) x 24 cols (hours)
}

export interface Insight {
  id: string
  severity: 'info' | 'positive' | 'warning'
  title: string
  description: string
  confidence: number // 0-1
}

export interface AlertRule {
  id: string
  metric: 'clicks' | 'unique_visitors' | 'bounce_rate'
  condition: 'gt' | 'lt' | 'eq'
  threshold: number
  window: '1h' | '6h' | '24h' | '7d'
  channel: 'email' | 'webhook'
  webhookUrl?: string
  active: boolean
}

export interface DashboardActivity {
  dailyClicks: Array<{ date: string; clicks: number; unique: number }>
  hourlyHeatmap: number[][] // 7 rows (Mon=0..Sun=6) x 24 cols (hours)
  sourceBreakdown: Array<{ source: string; clicks: number }>
}

export interface QrConfig {
  foregroundColor: string
  backgroundColor: string
  logoDataUrl: string | null
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'
  size: number
  format: 'svg' | 'png'
}

export type SourceId = 'newsletter' | 'social' | 'blog' | 'qr' | 'campaign' | 'manual'

export const SOURCE_COLORS: Record<SourceId, string> = {
  newsletter: '#A77CE8',
  social: '#3FA9C0',
  blog: '#46B17E',
  qr: '#E0A23C',
  campaign: '#5B7FD6',
  manual: '#8A8F98',
} as const

export const SOURCE_LABELS: Record<SourceId, string> = {
  newsletter: 'Newsletter',
  social: 'Social',
  blog: 'Blog',
  qr: 'QR',
  campaign: 'Campanha',
  manual: 'Manual',
} as const

export interface LinkDisplay {
  id: string
  title: string
  slug: string
  source: SourceId
  badge: string
  dest: string
  status: 'active' | 'paused' | 'expired'
  clicks: number
  last30: number
  unique: number
  scans: number
  topCountry: string
  ctr: number
  created: string
  health: 'ok' | 'warn' | 'broken'
  redirect: 301 | 302
  clickIds: boolean
  spark: number[]
}

export interface LinktreeDisplay {
  url: string
  pageviews: number
  last30: number
  unique: number
  engagement: number
  topCountry: string
  spark: number[]
  blocks: Array<{
    id: string
    label: string
    section: string
    clicks: number
    ctr: number
  }>
  sharedLinks: Array<{
    id: string
    icon: string
    labelPt: string
    labelEn: string
    url: string
  }>
}

export interface AnalyticsDisplay {
  totalClicks: number
  prevClicks: number
  unique: number
  prevUnique: number
  ctr: number
  prevCtr: number
  qrShare: number
  byDay: number[]
  byDayPrev: number[]
  bySource: Array<{ id: SourceId; clicks: number; pct: number }>
  devices: Array<{ k: string; v: number; color: string }>
  browsers: Array<{ k: string; v: number }>
  os: Array<{ k: string; v: number }>
  referrers: Array<{ k: string; v: number }>
  countries: Array<{
    code: string
    name: string
    v: number
    cities: string[]
  }>
  heatmap: number[][]
  topLinks: LinkDisplay[]
  insights: Array<{
    tone: 'up' | 'accent' | 'amber' | 'red'
    icon: string
    text: string
  }>
}
