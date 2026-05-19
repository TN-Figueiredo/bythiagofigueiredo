import { z } from 'zod'
import { CardCompositionSchema } from '@tn-figueiredo/links/qr'
import type { TemplateContext } from './konva-renderer'

// ---------------------------------------------------------------------------
// Story slide — a CardComposition with story-specific constraints
// ---------------------------------------------------------------------------

export const StorySlideSchema = CardCompositionSchema

export const StorySlidesSchema = z.array(StorySlideSchema).min(1).max(10)

export type StorySlide = z.infer<typeof StorySlideSchema>

// ---------------------------------------------------------------------------
// Fan interaction tracking
// ---------------------------------------------------------------------------

export const FanInteractionSchema = z.object({
  site_id: z.string().uuid(),
  visitor_hash: z.string().min(1),
  platform: z.enum(['instagram', 'facebook', 'bluesky', 'link_click', 'newsletter']),
  interaction_type: z.enum([
    'story_view', 'story_reply', 'story_publish', 'like', 'comment', 'share',
    'link_click', 'subscribe',
  ]),
  post_id: z.string().uuid().optional(),
  link_id: z.string().uuid().optional(),
  raw: z.record(z.unknown()).optional(),
})

export type FanInteraction = z.infer<typeof FanInteractionSchema>

// ---------------------------------------------------------------------------
// Fan scoring
// ---------------------------------------------------------------------------

export interface FanScore {
  site_id: string
  visitor_hash: string
  total_interactions: number
  platform_count: number
  active_days: number
  last_seen: string
  first_seen: string
  score: number
  email?: string
}

// ---------------------------------------------------------------------------
// Story insights / analytics
// ---------------------------------------------------------------------------

export interface SlideMetrics {
  slide_index: number
  impressions: number
  reach: number
  replies: number
}

export interface StoryInsights {
  post_id: string
  aggregate: {
    impressions: number
    reach: number
    replies: number
    link_clicks: number
  }
  per_slide: SlideMetrics[]
  drop_off: Array<{
    from_slide: number
    to_slide: number
    reach_drop: number
    drop_percentage: number
  }>
}

// ---------------------------------------------------------------------------
// Template context mapping
// ---------------------------------------------------------------------------

export interface SocialPostData {
  title: string
  description?: string
  coverImageUrl?: string
  logoUrl?: string
  shortUrl?: string
  /** BCP-47 locale of the source content (e.g. 'pt-BR'). Stored for future localised generation. */
  sourceLocale?: string
  /** Visual template style selected in the options step. Stored for future use. */
  templateStyle?: string
}

export function postDataToTemplateContext(data: SocialPostData): TemplateContext {
  return {
    title: data.title,
    description: data.description,
    cover_image: data.coverImageUrl,
    logo: data.logoUrl,
    short_url: data.shortUrl,
  }
}
