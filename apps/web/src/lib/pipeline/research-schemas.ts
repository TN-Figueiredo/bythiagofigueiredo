import { z } from 'zod'

export const RESEARCH_STATUS = ['new', 'reviewed', 'starred', 'archived'] as const
export type ResearchStatus = (typeof RESEARCH_STATUS)[number]

const SourceSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(200),
  accessed_at: z.string().datetime().optional(),
})

export const ResearchItemCreateSchema = z.object({
  title: z.string().min(1).max(500),
  topic_slug: z.string().min(1).max(200),
  content_md: z.string().min(1).max(500_000),
  summary: z.string().max(2000).optional(),
  sources: z.array(SourceSchema).max(50).default([]),
})

export type ResearchItemCreateInput = z.infer<typeof ResearchItemCreateSchema>

export const ResearchItemUpdateSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    content_json: z.record(z.unknown()).optional(),
    content_md: z.string().max(500_000).optional(),
    summary: z.string().max(2000).nullable().optional(),
    sources: z
      .array(
        z.object({
          url: z.string().url().max(2000),
          title: z.string().max(200),
        })
      )
      .max(50)
      .optional(),
    status: z.enum(RESEARCH_STATUS).optional(),
    topic_id: z.string().uuid().optional(),
  })
  .refine((d) => !(d.content_json && d.content_md), {
    message: 'content_json and content_md are mutually exclusive',
  })

export type ResearchItemUpdateInput = z.infer<typeof ResearchItemUpdateSchema>

export const ResearchImportSchema = z.object({
  items: z.array(ResearchItemCreateSchema).min(1).max(50),
})

export const ResearchTopicCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  parent_id: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#a78bfa'),
  icon: z.string().max(10).default('📁'),
})

export type ResearchTopicCreateInput = z.infer<typeof ResearchTopicCreateSchema>

export const ResearchTopicUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  parent_id: z.string().uuid().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .optional(),
  icon: z.string().max(10).optional(),
  sort_order: z.number().int().optional(),
})

export type ResearchTopicUpdateInput = z.infer<typeof ResearchTopicUpdateSchema>

export const ResearchLinkSchema = z.object({
  pipeline_item_id: z.string().uuid(),
  note: z.string().max(500).optional(),
})

export type ResearchLinkInput = z.infer<typeof ResearchLinkSchema>
