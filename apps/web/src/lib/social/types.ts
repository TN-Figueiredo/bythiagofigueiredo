// apps/web/src/lib/social/types.ts
//
// Local types for Social Posts Redesign.
// These live in the web app (NOT in @tn-figueiredo/social) to avoid
// a package publish cycle during development. They extend the existing
// SocialPost/SocialDelivery DB row types from the package.

import type { Provider } from '@tn-figueiredo/social'

// ---------------------------------------------------------------------------
// Content type & origin
// ---------------------------------------------------------------------------

export type ContentType = 'blog' | 'newsletter' | 'campaign' | 'video'

export type Origin = 'manual' | 'auto' | 'publish_modal'

// ---------------------------------------------------------------------------
// Delivery format
// ---------------------------------------------------------------------------

export type DeliveryFormat =
  | 'link_share'
  | 'image_post'
  | 'story'
  | 'reel'
  | 'link_card'
  | 'video_share'

// ---------------------------------------------------------------------------
// Pipeline step tracking
// ---------------------------------------------------------------------------

export type PipelineStepName = 'post_created' | 'short_link' | 'og_scrape' | 'deliver'

export type PipelineStepStatus = 'pending' | 'in_progress' | 'completed' | 'warning' | 'failed'

export interface PipelineStep {
  step: PipelineStepName
  status: PipelineStepStatus
  at: string // ISO 8601
  data?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Social config (stored in blog_posts.social_config, etc.)
// ---------------------------------------------------------------------------

export interface SocialConfig {
  enabled: boolean
  platforms: Provider[]
  captions: Partial<Record<Provider, Partial<Record<'pt' | 'en', string>>>>
  hashtags: string[]
  image_source: 'og_image' | 'cover_image' | 'custom'
  ig_template: 'minimal' | 'card' | 'bold'
  formats: Partial<Record<Provider, DeliveryFormat>>
}

// ---------------------------------------------------------------------------
// Content metadata (extracted from CMS content for social post creation)
// ---------------------------------------------------------------------------

export interface ContentMetadata {
  title: string
  url: string
  image: string | null
  excerpt: string | null
  tags: string[]
  locale: string
}

// ---------------------------------------------------------------------------
// OG scrape result
// ---------------------------------------------------------------------------

export interface OgScrapeResult {
  status: 'ok' | 'timeout' | 'error'
  tags?: number
  latency_ms?: number
  http_status?: number
  error?: string
}

// ---------------------------------------------------------------------------
// Format mapping: content type -> platform -> delivery format
// ---------------------------------------------------------------------------

export const CONTENT_FORMAT_MAP: Record<ContentType, Partial<Record<Provider, DeliveryFormat>>> = {
  blog: { facebook: 'link_share', instagram: 'story', bluesky: 'link_card' },
  newsletter: { facebook: 'link_share', instagram: 'story', bluesky: 'link_card' },
  campaign: { facebook: 'link_share', instagram: 'story', bluesky: 'link_card' },
  video: { facebook: 'video_share', instagram: 'reel', bluesky: 'link_card' },
}
