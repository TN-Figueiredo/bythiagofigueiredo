import { z } from 'zod'
import { CardCompositionSchema } from '@tn-figueiredo/links/qr'

export const ASPECT_RATIOS = ['9:16', '1:1', '16:9', '4:5'] as const
export type TemplateAspectRatio = (typeof ASPECT_RATIOS)[number]

export const CANONICAL_SIZES: Record<TemplateAspectRatio, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1280, height: 720 },
  '4:5': { width: 1080, height: 1350 },
}

export const CONTENT_TYPES = ['blog', 'newsletter', 'video', 'generic'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export const aspectRatioSchema = z.enum(ASPECT_RATIOS)

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  aspectRatio: aspectRatioSchema,
  composition: CardCompositionSchema,
  thumbnailBase64: z.string().optional(),
})

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  composition: CardCompositionSchema.optional(),
  thumbnailBase64: z.string().optional(),
})

export interface SocialTemplate {
  id: string
  site_id: string | null
  name: string
  slug: string | null
  content_type: ContentType | null
  aspect_ratio: TemplateAspectRatio
  composition: z.infer<typeof CardCompositionSchema>
  thumbnail_url: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export type { TemplateContext } from './types'
