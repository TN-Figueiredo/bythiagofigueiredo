// ---------------------------------------------------------------------------
// Domain types for @tn-figueiredo/links
// ---------------------------------------------------------------------------

/** Status of a tracked link */
export type LinkStatus = 'active' | 'expired' | 'deleted' | 'paused'

/** Device type classification */
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown'

/** Referrer classification */
export type ReferrerCategory =
  | 'direct'
  | 'google'
  | 'social'
  | 'newsletter'
  | 'email'
  | 'qr'
  | 'other'

/** Alert types for link monitoring */
export type LinkAlertType =
  | 'click_spike'
  | 'click_limit_reached'
  | 'link_expired'
  | 'bot_spike'
  | 'error_rate_high'

// ---------------------------------------------------------------------------
// Core domain entities
// ---------------------------------------------------------------------------

/** A tracked short link */
export interface TrackedLink {
  id: string
  siteId: string
  code: string
  slug: string | null
  destinationUrl: string
  title: string | null
  tags: string[]
  status: LinkStatus
  expiresAt: Date | null
  passwordHash: string | null
  clickLimit: number | null
  totalClicks: number
  uniqueClicks: number
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
  utmId: string | null
  launchedAt: Date | null
  activatesAt: Date | null
  customParams: Record<string, string>
  healthStatus: 'unchecked' | 'healthy' | 'unhealthy' | 'timeout' | 'dns_error'
  healthCheckedAt: Date | null
  passClickIds: boolean
  qrCodeUrl: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

/** A single click event */
export interface LinkClick {
  id: string
  linkId: string
  visitorId: string
  ip: string | null
  userAgent: string | null
  referrer: string | null
  referrerCategory: ReferrerCategory
  country: string | null
  region: string | null
  city: string | null
  deviceType: DeviceType
  browser: string | null
  os: string | null
  isBot: boolean
  botName: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
  utmId: string | null
  adClickIds: Record<string, string> | null
  clickedAt: Date
}

/** Daily aggregated metric for a link */
export interface DailyMetric {
  linkId: string
  date: string // YYYY-MM-DD
  clicks: number
  uniqueVisitors: number
  bots: number
  topCountry: string | null
  topReferrer: ReferrerCategory | null
  topDevice: DeviceType | null
}

/** Aggregated metrics over a period */
export interface AggregatedMetrics {
  totalClicks: number
  uniqueVisitors: number
  totalBots: number
  byCountry: Record<string, number>
  byReferrer: Record<ReferrerCategory, number>
  byDevice: Record<DeviceType, number>
  byBrowser: Record<string, number>
  byOs: Record<string, number>
  dailyBreakdown: DailyMetric[]
}

/** Delta between two metric periods */
export interface MetricsDelta {
  clicks: number
  clicksPercent: number
  uniqueVisitors: number
  uniqueVisitorsPercent: number
  bots: number
  botsPercent: number
}

/** 7x24 heatmap matrix (Mon-Sun x 0-23h) */
export interface HeatmapMatrix {
  /** [dayOfWeek (0=Mon..6=Sun)][hour (0..23)] = click count */
  matrix: number[][]
  max: number
  total: number
}

/** Heatmap result with metadata */
export interface HeatmapResult {
  heatmap: HeatmapMatrix
  period: { from: Date; to: Date }
  timezone: string
}

/** Prediction result from linear regression */
export interface PredictionResult {
  forecastDays: number
  predictedClicks: number[]
  slope: number
  intercept: number
  confidence: number // 0-1, R² × dataSufficiency
  dates: string[] // YYYY-MM-DD
}

/** Period comparison */
export interface PeriodComparison {
  current: AggregatedMetrics
  previous: AggregatedMetrics
  delta: MetricsDelta
}

// ---------------------------------------------------------------------------
// QR types
// ---------------------------------------------------------------------------

/** Named aspect ratio presets */
export type QrAspectRatioName = 'square' | 'landscape' | 'portrait' | 'wide' | 'story'

/** QR aspect ratio dimensions */
export interface QrAspectRatio {
  name: QrAspectRatioName
  width: number
  height: number
}

/** Options for QR SVG generation */
export interface QrGenerateOptions {
  url: string
  size?: number // QR module size in px (default 512)
  margin?: number // quiet zone modules (default 2)
  darkColor?: string // default '#000000'
  lightColor?: string // default '#ffffff'
  errorCorrection?: 'L' | 'M' | 'Q' | 'H' // default 'M'
}

/** Options for composed QR (QR + aspect ratio canvas) */
export interface QrComposeOptions extends QrGenerateOptions {
  aspectRatio?: QrAspectRatioName // default 'square'
  backgroundColor?: string // default '#ffffff'
  logoBase64?: string // optional center logo
  logoSize?: number // logo size as fraction of QR size (default 0.2)
  padding?: number // padding around QR in px (default 32)
}

/** Result of QR composition */
export interface QrComposedResult {
  svg: string
  width: number
  height: number
  qrSize: number
}

// ---------------------------------------------------------------------------
// Alert types
// ---------------------------------------------------------------------------

/** Alert context for notifications */
export interface AlertContext {
  linkId: string
  linkCode: string
  destinationUrl: string
  siteId: string
}

/** A link alert event */
export interface LinkAlert {
  type: LinkAlertType
  context: AlertContext
  message: string
  value: number // the metric value that triggered the alert
  threshold: number // the threshold that was exceeded
  occurredAt: Date
}

// ---------------------------------------------------------------------------
// Input / Filter types
// ---------------------------------------------------------------------------

/** UTM parameters */
export interface UtmParams {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  utmId?: string
}

/** Device info parsed from user agent */
export interface DeviceInfo {
  deviceType: DeviceType
  browser: string
  os: string
}

/** Geo info from IP resolution */
export interface GeoInfo {
  country: string | null
  region: string | null
  city: string | null
}

/** Input for creating a link */
export interface CreateLinkInput {
  siteId: string
  destinationUrl: string
  code?: string // custom code, auto-generated if omitted
  slug?: string // custom slug
  title?: string
  tags?: string[]
  expiresAt?: Date
  password?: string
  clickLimit?: number
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  utmId?: string
  createdBy?: string
}

/** Input for updating a link */
export interface UpdateLinkInput {
  destinationUrl?: string
  slug?: string | null
  title?: string | null
  tags?: string[]
  status?: LinkStatus
  expiresAt?: Date | null
  password?: string | null
  clickLimit?: number | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmTerm?: string | null
  utmContent?: string | null
  utmId?: string | null
  qrCodeUrl?: string | null
}

/** Filters for listing links */
export interface LinkFilters {
  siteId: string
  status?: LinkStatus
  tags?: string[]
  search?: string // search in code, slug, title, destination URL
  createdBy?: string
  limit?: number
  offset?: number
}

/** Filters for listing clicks */
export interface ClickFilters {
  linkId: string
  from?: Date
  to?: Date
  referrerCategory?: ReferrerCategory
  deviceType?: DeviceType
  country?: string
  isBot?: boolean
  limit?: number
  offset?: number
}

/** Paginated result wrapper */
export interface PaginatedResult<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

/** Input for recording a click */
export interface RecordClickInput {
  linkId: string
  ip: string
  userAgent: string
  referrer: string | null
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  utmId?: string
  adClickIds?: Record<string, string>
}

/** Result of redirect resolution */
export interface RedirectResult {
  url: string
  statusCode: 301 | 302 | 307 | 308
  link: TrackedLink
}

/** Failure reason when redirect cannot be resolved */
export interface RedirectGuardFailure {
  reason: 'not_found' | 'deleted' | 'expired' | 'click_limit' | 'password_required' | 'paused' | 'not_yet_active'
  link?: TrackedLink
}
