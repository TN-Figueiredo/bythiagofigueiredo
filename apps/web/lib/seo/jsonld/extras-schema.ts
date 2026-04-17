import { z } from 'zod'

export const FaqEntrySchema = z.object({
  q: z.string().min(1).max(500),
  a: z.string().min(1).max(2000),
})

export const HowToStepSchema = z.object({
  name: z.string().min(1).max(200),
  text: z.string().min(1).max(1000),
  imageUrl: z.string().url().optional(),
})

export const VideoObjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  thumbnailUrl: z.string().url(),
  uploadDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration: z.string().regex(/^PT(\d+H)?(\d+M)?(\d+S)?$/).optional(),
  embedUrl: z.string().url().optional(),
})

export const SeoExtrasSchema = z.object({
  faq: z.array(FaqEntrySchema).min(1).max(20).optional(),
  howTo: z.object({
    name: z.string().min(1).max(200),
    steps: z.array(HowToStepSchema).min(2).max(20),
  }).optional(),
  video: VideoObjectSchema.optional(),
  og_image_url: z.string().url().refine((u) => u.startsWith('https://'), 'must be https').optional(),
}).strict()

export type FaqEntry = z.infer<typeof FaqEntrySchema>
export type HowToStep = z.infer<typeof HowToStepSchema>
export type VideoObjectExtra = z.infer<typeof VideoObjectSchema>
export type SeoExtras = z.infer<typeof SeoExtrasSchema>

export class SeoExtrasValidationError extends Error {
  constructor(public issues: z.ZodIssue[]) {
    super(`SeoExtras validation failed: ${issues.map((i) => i.message).join(', ')}`)
    this.name = 'SeoExtrasValidationError'
  }
}
