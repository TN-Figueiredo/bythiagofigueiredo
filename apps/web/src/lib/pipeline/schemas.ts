import { z } from 'zod'
import { PLAYLIST_STATUSES, EDGE_TYPES } from '@/lib/playlists/types'

export const FORMATS = ['video', 'blog_post', 'newsletter', 'course', 'campaign'] as const
export type Format = (typeof FORMATS)[number]

export const LANGUAGES = ['pt-br', 'en', 'both'] as const
export type Language = (typeof LANGUAGES)[number]

// Format-specific metadata schemas
export const VideoMetadataSchema = z.object({
  playlist_letter: z.string().max(2).optional(),
  episode_number: z.number().int().positive().optional(),
  duration_estimate_min: z.number().positive().optional(),
  duration_range: z.string().max(40).optional(),          // NEW — "14–17 min"
  thumbnail_concept: z.string().optional(),
  recording_location: z.string().optional(),
  recorded_at: z.string().max(40).optional(),             // NEW — "23 abr 2026" | "—"
  equipment_notes: z.string().optional(),
  pillar: z.enum(['viagem', 'ia', 'codigo', 'games', 'nas']).optional(), // NEW
}).strict()

export const BlogPostMetadataSchema = z.object({
  word_count_target: z.number().int().positive().optional(),
  seo_keyword: z.string().optional(),
  cover_image_concept: z.string().optional(),
  series_position: z.number().int().positive().optional(),
  slug: z.string().max(200).optional(),
  depth: z.string().max(50).optional(),
  text_playlist: z.string().max(100).optional(),
}).strict()

export const NewsletterMetadataSchema = z.object({
  edition_number: z.number().int().positive().optional(),
  newsletter_type_id: z.string().uuid().optional(),
  cadence: z.enum(['weekly', 'biweekly', 'monthly', 'one-off']).optional(),
  target_send_date: z.string().datetime().optional(),
}).strict()

export const CourseMetadataSchema = z.object({
  module_count: z.number().int().positive().optional(),
  lesson_count: z.number().int().positive().optional(),
  estimated_hours: z.number().positive().optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  platform: z.enum(['self-hosted', 'hotmart', 'youtube', 'udemy', 'other']).optional(),
  product_type: z.enum(['mini_course', 'course', 'masterclass', 'workshop']).optional(),
  tier: z.enum(['free', 'lead_magnet', 'tripwire', 'core', 'premium']).optional(),
  pricing_model: z.enum(['free', 'one_time', 'subscription', 'cohort', 'pwyw']).optional(),
  price_cents: z.number().int().nonnegative().optional(),
  currency: z.string().min(3).max(3).optional(),
  compare_at_price_cents: z.number().int().nonnegative().optional(),
  funnel_stage: z.enum(['tofu', 'mofu', 'bofu']).optional(),
  topic_clusters: z.array(z.string().min(1)).optional(),
  upsell_ref: z.string().uuid().optional(),
  downsell_ref: z.string().uuid().optional(),
  prerequisite_courses: z.array(z.string().uuid()).optional(),
  launch_type: z.enum(['seed', 'internal', 'jv', 'evergreen']).optional(),
  playlist_id: z.string().uuid().optional(),
}).strict()

export const CampaignMetadataSchema = z.object({
  campaign_type: z.enum(['email', 'social', 'cross-platform']).optional(),
  target_audience: z.string().optional(),
  budget: z.number().positive().optional(),
  kpi_target: z.string().optional(),
}).strict()

export const FORMAT_METADATA_SCHEMAS: Record<Format, z.ZodType> = {
  video: VideoMetadataSchema,
  blog_post: BlogPostMetadataSchema,
  newsletter: NewsletterMetadataSchema,
  course: CourseMetadataSchema,
  campaign: CampaignMetadataSchema,
}

export const BLOG_CATEGORIES = ['stories', 'building', 'money', 'bts'] as const
export type BlogCategory = (typeof BLOG_CATEGORIES)[number]

// Pipeline item schemas
export const PipelineItemCreateSchema = z.object({
  code: z.string().min(1).max(100).optional(),
  title_pt: z.string().max(500).optional(),
  title_en: z.string().max(500).optional(),
  format: z.enum(FORMATS),
  stage: z.string().optional(),
  language: z.enum(LANGUAGES).default('pt-br'),
  priority: z.number().int().min(0).max(5).default(0),
  parent_id: z.string().uuid().optional(),
  hook: z.string().max(300).optional(),
  synopsis: z.string().max(2000).optional(),
  body_content: z.string().max(500_000).optional(),
  format_metadata: z.record(z.unknown()).default({}),
  production_checklist: z.array(z.object({
    label: z.string(),
    done: z.boolean().default(false),
    toggled_at: z.string().datetime().optional(),
  })).optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  assigned_to: z.string().uuid().optional(),
}).refine(
  (d) => d.title_pt || d.title_en,
  { message: 'At least one title (title_pt or title_en) is required' },
)

export const PipelineItemUpdateSchema = z.object({
  title_pt: z.string().max(500).optional(),
  title_en: z.string().max(500).optional(),
  stage: z.string().optional(),
  language: z.enum(LANGUAGES).optional(),
  priority: z.number().int().min(0).max(5).optional(),
  hook: z.string().max(300).optional(),
  synopsis: z.string().max(2000).optional(),
  body_content: z.string().max(500_000).optional(),
  format_metadata: z.record(z.unknown()).optional(),
  production_checklist: z.array(z.object({
    label: z.string(),
    done: z.boolean().default(false),
    toggled_at: z.string().datetime().optional(),
  })).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  youtube_video_id: z.string().uuid().nullable().optional(),
  blog_post_id: z.string().uuid().nullable().optional(),
  newsletter_edition_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  category: z.enum(BLOG_CATEGORIES).nullable().optional(),
  cover_image_url: z.string().url().max(2000).nullable().optional(),
  social_config: z.object({ enabled: z.boolean() }).passthrough().nullable().optional(),
})

import { REFERENCE_GROUP_IDS } from '@/lib/pipeline/reference-groups'

export const ReferenceContentUpsertSchema = z.object({
  title: z.string().min(1).max(200),
  content_md: z.string().max(200_000).optional(),
  content_compact: z.record(z.unknown()).optional(),
  ref_group: z.enum(REFERENCE_GROUP_IDS).optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
})

export const ChecklistToggleSchema = z.object({
  index: z.number().int().min(0),
  done: z.boolean(),
})

export const GraduateSchema = z.object({
  target: z.enum(['blog_post', 'newsletter', 'campaign', 'course']),
  data: z.record(z.unknown()).optional(),
})

export const BulkOperationSchema = z.object({
  operations: z.array(z.discriminatedUnion('op', [
    z.object({ op: z.literal('advance'), id: z.string().uuid() }),
    z.object({ op: z.literal('retreat'), id: z.string().uuid() }),
    z.object({ op: z.literal('archive'), id: z.string().uuid() }),
    z.object({ op: z.literal('restore'), id: z.string().uuid() }),
    z.object({ op: z.literal('update'), id: z.string().uuid(), data: PipelineItemUpdateSchema, version: z.number().int() }),
    z.object({ op: z.literal('tag'), id: z.string().uuid(), data: z.object({ add: z.array(z.string()).default([]), remove: z.array(z.string()).default([]) }) }),
  ])).min(1).max(50),
})

// -- Playlist schemas for Cowork API --

export const PipelineCreatePlaylistSchema = z.object({
  name_en: z.string().min(1).max(200),
  name_pt: z.string().max(200).default(''),
  description_en: z.string().max(1000).optional(),
  description_pt: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  status: z.enum(PLAYLIST_STATUSES).default('draft'),
})

export const PipelineUpdatePlaylistSchema = z.object({
  name_en: z.string().min(1).max(200).optional(),
  name_pt: z.string().max(200).optional(),
  description_en: z.string().max(1000).nullable().optional(),
  description_pt: z.string().max(1000).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  status: z.enum(PLAYLIST_STATUSES).optional(),
  cover_image_url: z.string().url().nullable().optional(),
  notes: z.any().nullable().optional(),
})

export const PipelineAddItemSchema = z.object({
  blog_post_id: z.string().uuid().optional(),
  newsletter_edition_id: z.string().uuid().optional(),
  pipeline_id: z.string().uuid().optional(),
  sort_order: z.number().int().min(0).optional(),
  position_x: z.number().optional(),
  position_y: z.number().optional(),
}).refine(
  d => [d.blog_post_id, d.newsletter_edition_id, d.pipeline_id].filter(Boolean).length === 1,
  { message: 'Exactly one content reference is required' },
)

export const PipelineBulkAddItemsSchema = z.object({
  items: z.array(z.object({
    blog_post_id: z.string().uuid().optional(),
    newsletter_edition_id: z.string().uuid().optional(),
    pipeline_id: z.string().uuid().optional(),
    sort_order: z.number().int().min(0).optional(),
    position_x: z.number().optional(),
    position_y: z.number().optional(),
  })).min(1).max(50),
})

export const PipelineCreateEdgeSchema = z.object({
  source_item_id: z.string().uuid(),
  target_item_id: z.string().uuid(),
  edge_type: z.enum(EDGE_TYPES),
  label: z.string().max(100).optional(),
})

export const PipelineBulkCreateEdgesSchema = z.object({
  edges: z.array(PipelineCreateEdgeSchema).min(1).max(100),
})

export const PipelineReorderSchema = z.object({
  item_ids: z.array(z.string().uuid()).min(1),
})
