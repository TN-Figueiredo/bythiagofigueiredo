import { z } from 'zod'
import { VARIANT_LABELS } from './ab-types'

export const TestTypeSchema = z.enum(['thumbnail', 'title', 'description', 'combo'])

export const VariantMetadataSchema = z.object({
  thumbnail_tags: z.array(z.string().max(50)).max(10).optional(),
  title_pattern: z.string().max(200).optional(),
  emotional_triggers: z.array(z.string().max(50)).max(10).optional(),
  visual_description: z.string().max(2000).optional(),
  ai_image_prompt: z.string().max(1000).optional(),
  creative_direction: z.string().max(2000).optional(),
  rationale: z.string().max(1000).optional(),
})

export const VariantPayloadSchema = z.object({
  label: z.enum(VARIANT_LABELS),
  title_text: z.string().max(200).nullable().optional(),
  description_text: z.string().max(5000).nullable().optional(),
  metadata: VariantMetadataSchema.nullable().optional(),
})

export const BatchVariantUpsertSchema = z.object({
  variants: z.array(VariantPayloadSchema).min(1).max(3),
})
