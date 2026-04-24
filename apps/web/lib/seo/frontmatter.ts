import matter from 'gray-matter'
import { SeoExtrasSchema, SeoExtrasValidationError, type SeoExtras } from './jsonld/extras-schema'
import { PostExtrasSchema, type PostExtras } from '@/components/blog/post-extras-schema'

export { SeoExtrasValidationError } from './jsonld/extras-schema'

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
