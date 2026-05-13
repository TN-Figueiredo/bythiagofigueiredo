import { z } from 'zod'

export const FORMATS = ['video', 'blog_post', 'newsletter', 'course', 'campaign'] as const
export type Format = (typeof FORMATS)[number]

export const LANGUAGES = ['pt-br', 'en', 'both'] as const
export type Language = (typeof LANGUAGES)[number]

export const COLLECTION_TYPES = ['playlist', 'category', 'series', 'arc', 'launch'] as const
export type CollectionType = (typeof COLLECTION_TYPES)[number]

// Format-specific metadata schemas
export const VideoMetadataSchema = z.object({
  playlist_letter: z.string().max(2).optional(),
  episode_number: z.number().int().positive().optional(),
  duration_estimate_min: z.number().positive().optional(),
  thumbnail_concept: z.string().optional(),
  recording_location: z.string().optional(),
  equipment_notes: z.string().optional(),
}).strict()

export const BlogPostMetadataSchema = z.object({
  word_count_target: z.number().int().positive().optional(),
  seo_keyword: z.string().optional(),
  cover_image_concept: z.string().optional(),
  series_position: z.number().int().positive().optional(),
}).strict()

export const NewsletterMetadataSchema = z.object({
  edition_number: z.number().int().positive().optional(),
  newsletter_type_id: z.string().uuid().optional(),
  cadence: z.enum(['weekly', 'biweekly', 'monthly', 'one-off']).optional(),
  target_send_date: z.string().datetime().optional(),
}).strict()

export const CourseMetadataSchema = z.object({
  module_count: z.number().int().positive().optional(),
  platform: z.enum(['self-hosted', 'youtube', 'udemy', 'other']).optional(),
  price_model: z.enum(['free', 'paid', 'freemium']).optional(),
  prerequisite_courses: z.array(z.string()).optional(),
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
})

export const CollectionCreateSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(COLLECTION_TYPES),
  parent_id: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({}),
  position: z.number().int().default(0),
})

export const CollectionUpdateSchema = CollectionCreateSchema.partial().omit({ type: true })

export const ReferenceContentUpsertSchema = z.object({
  title: z.string().min(1).max(200),
  content_md: z.string().max(200_000).optional(),
  content_compact: z.record(z.unknown()).optional(),
})

export const ChecklistToggleSchema = z.object({
  index: z.number().int().min(0),
  done: z.boolean(),
})

export const GraduateSchema = z.object({
  target: z.enum(['blog_post', 'newsletter', 'campaign']),
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
    z.object({ op: z.literal('move_collection'), id: z.string().uuid(), data: z.object({ collection_id: z.string().uuid(), position: z.number().int() }) }),
  ])).min(1).max(50),
})
