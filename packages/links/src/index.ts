// @tn-figueiredo/links — core entry point

// Domain types
export type {
  TrackedLink,
  LinkClick,
  DailyMetric,
  AggregatedMetrics,
  MetricsDelta,
  HeatmapMatrix,
  HeatmapResult,
  PredictionResult,
  PeriodComparison,
  QrAspectRatioName,
  QrAspectRatio,
  QrGenerateOptions,
  QrComposeOptions,
  QrComposedResult,
  LinkAlert,
  AlertContext,
  LinkAlertType,
  LinkStatus,
  DeviceType,
  ReferrerCategory,
  CreateLinkInput,
  UpdateLinkInput,
  LinkFilters,
  ClickFilters,
  PaginatedResult,
  RecordClickInput,
  UtmParams,
  DeviceInfo,
  GeoInfo,
  RedirectResult,
  RedirectGuardFailure,
} from './types.js'

// DI interfaces
export type {
  ILinkRepository,
  IClickRepository,
  ClickRecordData,
  IMetricsRepository,
  UpsertDailyInput,
  IGeoResolver,
  IQrStorage,
  IAlertNotifier,
} from './interfaces/index.js'

// Core utilities
export { CodeGenerator, SAFE_ALPHABET } from './core/code-generator.js'
export { computeVisitorId } from './core/visitor-id.js'
export { isBot, getBotName, BOT_SIGNATURES } from './core/bot-filter.js'
export { parseUtm, buildUtmUrl, extractUtmFromSearchParams, stripUtm } from './core/utm-parser.js'
export { classifyDevice } from './core/device-classifier.js'
export { classifyReferrer } from './core/referrer-classifier.js'

// Core services
export { RedirectResolver } from './core/redirect-resolver.js'
export type { ResolveOptions } from './core/redirect-resolver.js'
export { ClickRecorder } from './core/click-recorder.js'
export type { ClickRecorderDeps } from './core/click-recorder.js'
export { LinkService } from './core/link-service.js'
