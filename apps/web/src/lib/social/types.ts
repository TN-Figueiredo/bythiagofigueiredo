// apps/web/src/lib/social/types.ts
//
// Local types for Social Posts Redesign.
// These live in the web app (NOT in @tn-figueiredo/social) to avoid
// a package publish cycle during development. They extend the existing
// SocialPost/SocialDelivery DB row types from the package.

import type { Provider } from '@tn-figueiredo/social'
import type { z } from 'zod'
import type { socialConfigSchema } from './schemas'

// ---------------------------------------------------------------------------
// Content type & origin
// ---------------------------------------------------------------------------

export type ContentType = 'blog' | 'newsletter' | 'campaign' | 'video'

export type Origin = 'manual' | 'auto' | 'publish_modal' | 'pipeline'

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

export type SocialConfig = z.infer<typeof socialConfigSchema>

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

// ---------------------------------------------------------------------------
// Pipeline format → content type mapping
// ---------------------------------------------------------------------------

export const PIPELINE_FORMAT_TO_CONTENT_TYPE: Record<string, ContentType> = {
  blog_post: 'blog',
  newsletter: 'newsletter',
  campaign: 'campaign',
  video: 'video',
}

// ---------------------------------------------------------------------------
// Default timezone
// ---------------------------------------------------------------------------

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

// ---------------------------------------------------------------------------
// Pipeline snapshot (frozen state at graduation)
// ---------------------------------------------------------------------------

export interface PipelineSnapshot {
  pipeline_id: string
  code: string
  format: string
  stage: string
  language: string
  title_pt: string | null
  title_en: string | null
  hook: string | null
  synopsis: string | null
  tags: string[]
  category: string | null
  cover_image_url: string | null
  sections: Record<string, unknown>
  format_metadata: Record<string, unknown>
  blog_post_id: string | null
  newsletter_edition_id: string | null
  campaign_id: string | null
  youtube_video_id: string | null
  graduated_at: string
  graduated_by: string
  version: number
}

// ---------------------------------------------------------------------------
// Format mapping: content type -> platform -> delivery format
// ---------------------------------------------------------------------------

export const CONTENT_FORMAT_MAP: Record<ContentType, Partial<Record<Provider, DeliveryFormat>>> = {
  blog: { facebook: 'link_share', instagram: 'story', bluesky: 'link_card', youtube: 'link_share' },
  newsletter: { facebook: 'link_share', instagram: 'story', bluesky: 'link_card', youtube: 'link_share' },
  campaign: { facebook: 'link_share', instagram: 'story', bluesky: 'link_card', youtube: 'link_share' },
  video: { facebook: 'video_share', instagram: 'reel', bluesky: 'link_card', youtube: 'video_share' },
}
