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
} from './types.js'

export { SOURCE_COLORS, SOURCE_LABELS } from './types.js'

export type { QrCardBuilderProps } from './components/qr-card-builder/index.js'
export type { QrTemplate } from './components/qr-card-builder/template-browser.js'
export type { QrTemplateData, QrCardDesign } from './components/qr-card-builder/qr-templates.js'
