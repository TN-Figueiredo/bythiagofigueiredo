import { z } from 'zod'

export const PostExtrasSchema = z.object({
  key_points: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  pull_quote: z.string().optional(),
  pull_quote_attribution: z.string().optional(),
  series_title: z.string().optional(),
  series_part: z.number().int().positive().optional(),
  series_total: z.number().int().positive().optional(),
  series_next_slug: z.string().optional(),
  series_next_title: z.string().optional(),
  series_next_excerpt: z.string().optional(),
  colophon: z.string().optional(),
}).refine(
  (data) => {
    if (data.series_part !== undefined && !data.series_title) return false
    if (data.series_total !== undefined && !data.series_title) return false
    return true
  },
  { message: 'series_part and series_total require series_title' },
)

export type PostExtras = z.infer<typeof PostExtrasSchema>
