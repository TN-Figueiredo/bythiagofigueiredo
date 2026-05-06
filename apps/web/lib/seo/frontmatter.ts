import matter from 'gray-matter'
import { z } from 'zod'
import { SeoExtrasSchema, SeoExtrasValidationError, type SeoExtras } from './jsonld/extras-schema'

export { SeoExtrasValidationError } from './jsonld/extras-schema'

// ---------------------------------------------------------------------------
// PostExtras schema (moved here from components/blog/post-extras-schema.ts)
// ---------------------------------------------------------------------------
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
  hero_illustration: z.string().optional(),
}).refine(
  (data) => {
    if (data.series_part !== undefined && !data.series_title) return false
    if (data.series_total !== undefined && !data.series_title) return false
    return true
  },
  { message: 'series_part and series_total require series_title' },
).refine(
  (d) => !d.series_part || !d.series_total || d.series_part <= d.series_total,
  { message: 'series_part must be <= series_total' },
)

export type PostExtras = z.infer<typeof PostExtrasSchema>

export interface ParsedMdx {
  content: string
  seoExtras: SeoExtras | null
  postExtras: PostExtras | null
  raw: Record<string, unknown>
}

export function parseMdxFrontmatter(source: string): ParsedMdx {
  const { content, data } = matter(source)
  let seoExtras: SeoExtras | null = null
  if (data.seo_extras !== undefined) {
    const parsed = SeoExtrasSchema.safeParse(data.seo_extras)
    if (!parsed.success) {
      throw new SeoExtrasValidationError(parsed.error.issues)
    }
    seoExtras = parsed.data
  }
  const postExtrasParsed = PostExtrasSchema.safeParse(data)
  const postExtras = postExtrasParsed.success ? postExtrasParsed.data : null
  return { content, seoExtras, postExtras, raw: data }
}
