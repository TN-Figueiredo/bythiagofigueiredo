// Server-safe barrel — types and re-exports only (no "use client" directive)
export type {
  LinkSummary,
  DashboardKpis,
  DashboardActivity,
  DateRange,
  AnalyticsMetrics,
  DeviceData,
  ReferrerData,
  GeoDataItem,
  HourlyData,
  Insight,
  AlertRule,
  QrConfig,
  SourceId,
  LinkDisplay,
  LinktreeDisplay,
  AnalyticsDisplay,
} from './types'

export { SOURCE_COLORS, SOURCE_LABELS } from './types'

export type { QrCardBuilderProps } from './components/qr-card-builder/index'
export type { QrTemplate } from './components/qr-card-builder/template-browser'
export type { QrTemplateData, QrCardDesign } from './components/qr-card-builder/qr-templates'
