import { z } from 'zod'

const YoutubeBlock = z.object({
  kind: z.literal('youtube'),
  videoId: z.string().min(1),
  title: z.string().optional(),
})

const TestimonialBlock = z.object({
  kind: z.literal('testimonial'),
  author: z.string(),
  quote: z.string(),
  avatarUrl: z.string().url().optional(),
})

const WhoAmIBlock = z.object({
  kind: z.literal('whoAmI'),
  headline: z.string(),
  bio_md: z.string(),
  avatarUrl: z.string().url().optional(),
})

const WhatsappCta = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('joinChannel'), label: z.string(), url: z.string().url() }),
  z.object({
    kind: z.literal('startChatWithText'),
    label: z.string(),
    phone: z.string(),
    text: z.string(),
  }),
])

const WhatsappCtasBlock = z.object({
  kind: z.literal('whatsappCtas'),
  ctas: z.array(WhatsappCta).min(1).max(2),
})

export const ExtrasBlock = z.discriminatedUnion('kind', [
  YoutubeBlock,
  TestimonialBlock,
  WhoAmIBlock,
  WhatsappCtasBlock,
])

export const ExtrasSchema = z.array(ExtrasBlock)
export type ExtrasBlockT = z.infer<typeof ExtrasBlock>

export function parseExtras(input: unknown): ExtrasBlockT[] {
  const r = ExtrasSchema.safeParse(input)
  return r.success ? r.data : []
}
