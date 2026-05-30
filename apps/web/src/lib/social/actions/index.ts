// Barrel re-export for all social server actions.
// UI components should continue importing from '@/lib/social/actions'.

// Shared types (ActionResult, SafeConnection)
export type { ActionResult, SafeConnection } from './_shared'

// Connection management
export {
  connectSocial,
  disconnectSocial,
  getConnections,
  checkConnectionHealth,
} from './connections'
export type { ConnectionHealth } from './connections'

// Post management (create, update, cancel, delete, retry, list, get, edit published, batch reorder, feed, calendar, queue)
export {
  createSocialPost,
  updateSocialPost,
  cancelSocialPost,
  deleteSocialPost,
  retrySocialDelivery,
  getSocialPost,
  listSocialPosts,
  editPublishedPost,
  reorderQueuePosts,
  listFeedPostsWithDeliveries,
  listCalendarEvents,
  reorderQueue,
  duplicatePost,
  createAutoDraft,
} from './posts'
export type { FeedPostWithDeliveries, CalendarEvent } from './posts'
export type { SocialPostWithPipeline } from '../row-parsers'

// Content helpers (get content metadata, create from CMS content, OG scraping, duplicate detection, AI captions)
export {
  getContentForSocialPost,
  createFromContentAction,
  scrapeOgTags,
  checkDuplicatesAction,
  generateAICaption,
  translateCaption,
  getBestTimes,
} from './content'
export type { AICaptionResult } from './content'

// Template management
export {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDefaultTemplate,
  duplicateTemplate,
} from './templates'

// Site-level social settings (defaults matrix, queue slots)
export {
  getSocialDefaults,
  updateSocialDefaults,
  getQueueSlotConfig,
  saveQueueSlotConfig,
} from './settings'

export type {
  SocialContentType,
  SocialPlatform,
  SocialDefaults,
} from './settings'

// Queue slot action
export { getNextQueueSlotAction } from './queue'

// Legacy functions not yet in a dedicated module
export { retryPostDeliveries, markAsPosted } from './_legacy'

// Story insights (per-slide metrics + drop-off analysis)
export { getStoryInsights } from './story-metrics'

// Fan scoring
export { getTopFans, recordFanInteraction, refreshFanScores } from './fans'
