export const CONTENT_TRACKING_ENABLED =
  process.env.CONTENT_TRACKING_ENABLED !== 'false'

export const READ_INDICATORS_ENABLED =
  process.env.NEXT_PUBLIC_READ_INDICATORS_ENABLED !== 'false'

export const VIEW_DELAY_MS = 3_000
export const READ_COMPLETE_THRESHOLD = 95
export const DEDUP_WINDOW_MS = 30 * 60_000
export const COLD_START_THRESHOLD = 10
export const CLEANUP_MAX_AGE_DAYS = 365

export const RATE_LIMIT_WINDOW_MS = 60_000
export const RATE_LIMIT_MAX = 30
