import { z } from 'zod'

// ---------------------------------------------------------------------------
// Provider enum
// ---------------------------------------------------------------------------
export const PROVIDERS = ['youtube', 'facebook', 'instagram', 'bluesky'] as const
export type Provider = (typeof PROVIDERS)[number]

// ---------------------------------------------------------------------------
// Post types
// ---------------------------------------------------------------------------
export const POST_TYPES = ['link', 'video', 'image', 'text'] as const
export type PostType = (typeof POST_TYPES)[number]

// ---------------------------------------------------------------------------
// Status enums
// ---------------------------------------------------------------------------
export const POST_STATUSES = [
  'draft',
  'scheduled',
  'publishing',
  'completed',
  'partial_failure',
  'failed',
  'cancelled',
] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export const DELIVERY_STATUSES = [
  'pending',
  'publishing',
  'published',
  'failed',
  'retrying',
  'skipped',
] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const ERROR_TYPES = ['permanent', 'transient', 'auth'] as const
export type ErrorType = (typeof ERROR_TYPES)[number]

// ---------------------------------------------------------------------------
// Zod schema for post content
// ---------------------------------------------------------------------------
export const SocialPostContentSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  url: z.string().url().optional(),
  hashtags: z.array(z.string()).optional(),
  media_urls: z.array(z.string().url()).optional(),
  video_id: z.string().optional(),
})
export type SocialPostContent = z.infer<typeof SocialPostContentSchema>

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------
export interface SocialConnection {
  id: string
  site_id: string
  provider: Provider
  account_id: string
  account_name: string | null
  access_token_enc: string
  refresh_token_enc: string | null
  page_token_enc: string | null
  token_expires_at: string | null
  scopes: string[]
  metadata: Record<string, unknown>
  connected_at: string
  revoked_at: string | null
  updated_at: string
}

export interface SocialPost {
  id: string
  site_id: string
  created_by: string
  type: PostType
  status: PostStatus
  scheduled_at: string | null
  user_timezone: string
  published_at: string | null
  content: SocialPostContent
  template_id: string | null
  idempotency_key: string
  created_at: string
  updated_at: string
}

export interface SocialDelivery {
  id: string
  post_id: string
  connection_id: string
  provider: Provider
  status: DeliveryStatus
  platform_post_id: string | null
  platform_url: string | null
  content_override: Record<string, unknown> | null
  attempt: number
  max_attempts: number
  last_error: string | null
  error_type: ErrorType | null
  published_at: string | null
  created_at: string
  format?: 'link_share' | 'image_post' | 'story' | 'reel' | 'link_card' | 'video_share'
}

export interface YouTubeQuotaUsage {
  date: string
  site_id: string
  units_used: number
  operations: Array<{ op: string; units: number; at: string }>
  updated_at: string
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------
export interface PlatformResult {
  id: string
  url?: string
}

export interface ISocialProvider {
  readonly provider: Provider
  publish(
    post: SocialPost,
    connection: SocialConnection,
    delivery: SocialDelivery,
  ): Promise<PlatformResult>
  deletePost(platformPostId: string, connection: SocialConnection): Promise<void>
  validateConnection(connection: SocialConnection): Promise<boolean>
  refreshToken?(
    connection: SocialConnection,
  ): Promise<{ access_token: string; expires_at?: Date } | null>
}

// ---------------------------------------------------------------------------
// Platform limits for content adapter
// ---------------------------------------------------------------------------
export const PLATFORM_LIMITS = {
  youtube: { title: 100, description: 5000, tags: 500 },
  facebook: { text: 63_206 },
  instagram: { caption: 2200, hashtags: 30 },
  bluesky: { text: 300 },
} as const

// ---------------------------------------------------------------------------
// Default templates
// ---------------------------------------------------------------------------
export const DEFAULT_TEMPLATES: Record<string, string> = {
  'video-launch': '\u{1F3AC} {title} — {description}\n\n{url}\n\n{hashtags}',
  'blog-post': '\u{1F4DD} {title}\n\n{description}\n\n{url}',
  'link-share': '{title}\n{url}',
}

// ---------------------------------------------------------------------------
// YouTube quota costs
// ---------------------------------------------------------------------------
export const YOUTUBE_QUOTA_COSTS = {
  'videos.insert': 1600,
  'videos.update': 50,
  'thumbnails.set': 50,
  'videos.list': 1,
  'search.list': 100,
} as const
export type YouTubeOperation = keyof typeof YOUTUBE_QUOTA_COSTS
export const YOUTUBE_DAILY_QUOTA = 10_000

// ---------------------------------------------------------------------------
// Retry config
// ---------------------------------------------------------------------------
export const RETRY_DELAYS = [5_000, 30_000, 120_000] as const
