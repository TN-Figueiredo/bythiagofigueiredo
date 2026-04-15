import { z } from 'zod'

export const ContentStatusZ = z.enum(['draft', 'scheduled', 'published', 'archived'])

export const TocEntryZ = z.object({
  depth: z.number().int().min(1).max(6),
  text: z.string(),
  slug: z.string(),
})

export const PostTranslationZ = z.object({
  id: z.string(),
  post_id: z.string(),
  locale: z.string(),
  title: z.string(),
  slug: z.string(),
  excerpt: z.string().nullable(),
  content_mdx: z.string(),
  content_compiled: z.string().nullable(),
  content_toc: z.array(TocEntryZ),
  reading_time_min: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const PostZ = z.object({
  id: z.string(),
  site_id: z.string(),
  author_id: z.string(),
  status: ContentStatusZ,
  published_at: z.string().nullable(),
  scheduled_for: z.string().nullable(),
  cover_image_url: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  translations: z.array(PostTranslationZ),
})

export const CreatePostInputZ = z.object({
  site_id: z.string().uuid(),
  author_id: z.string().uuid(),
  initial_translation: z.object({
    locale: z.string().min(2),
    title: z.string().min(1),
    slug: z.string().min(1),
    content_mdx: z.string(),
    excerpt: z.string().nullable().optional(),
  }),
})
