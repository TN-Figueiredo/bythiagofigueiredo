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

export interface QrConfig {
  foregroundColor: string
  backgroundColor: string
  logoDataUrl: string | null
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H'
  size: number
  format: 'svg' | 'png'
}
