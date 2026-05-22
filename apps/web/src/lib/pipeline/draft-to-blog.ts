import type { JSONContent } from '@tiptap/core'
import { compileJsonContent, type TocEntry } from '@/lib/cms/compile-json'

export interface BlogContentPatch {
  content_json: Record<string, unknown> | null
  content_html: string | null
  content_mdx: string | null
  content_compiled: null
  content_toc: TocEntry[] | null
  reading_time_min: number | null
  title: string | null
  slug: string | null
  excerpt: string | null
  meta_title: string | null
  meta_description: string | null
  og_image_url: string | null
  key_points: string[] | null
  pull_quote: string | null
  notes: string[] | null
  colophon: string | null
  tag_id: string | null
  cover_image_url: string | null
}

function isJSONContent(v: unknown): v is JSONContent {
  return typeof v === 'object' && v !== null && 'type' in v && (v as Record<string, unknown>).type === 'doc'
}

export function extractDraftBody(content: unknown): { json: JSONContent | null; mdx: string | null } {
  if (typeof content === 'string') return { json: null, mdx: content || null }
  if (isJSONContent(content)) return { json: content, mdx: null }
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    const obj = content as Record<string, unknown>
    if ('body' in obj) return extractDraftBody(obj.body)
  }
  return { json: null, mdx: null }
}

export function getDraftForLocale(sections: Record<string, unknown> | null | undefined, locale: string): unknown | null {
  if (!sections || typeof sections !== 'object') return null
  const key = locale === 'en' ? 'draft_en' : 'draft_pt'
  const section = sections[key] as { content?: unknown } | undefined
  return section?.content ?? null
}

function getSectionContent(
  sections: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  if (!sections || typeof sections !== 'object') return null
  const section = sections[key] as { content?: unknown } | undefined
  const content = section?.content
  if (content && typeof content === 'object' && !Array.isArray(content)) {
    return content as Record<string, unknown>
  }
  return null
}

function extractString(obj: Record<string, unknown>, field: string): string | null {
  const val = obj[field]
  return typeof val === 'string' && val.length > 0 ? val : null
}

function extractStringArray(obj: Record<string, unknown>, field: string): string[] | null {
  const val = obj[field]
  if (!Array.isArray(val)) return null
  const result = val.filter((v): v is string => typeof v === 'string')
  return result.length > 0 ? result : null
}

export async function prepareBlogTranslationPatch(
  sections: Record<string, unknown> | null | undefined,
  locale: string,
): Promise<BlogContentPatch | null> {
  const raw = getDraftForLocale(sections, locale)
  if (raw == null) return null

  const { json, mdx } = extractDraftBody(raw)

  // Extract fields from draft and SEO sections
  const draftKey = locale === 'en' ? 'draft_en' : 'draft_pt'
  const seoKey = locale === 'en' ? 'seo_en' : 'seo_pt'
  const draftContent = getSectionContent(sections, draftKey)
  const seoContent = getSectionContent(sections, seoKey)

  const title = draftContent ? extractString(draftContent, 'title') : null
  const slug = draftContent ? extractString(draftContent, 'slug') : null
  const excerpt = draftContent ? extractString(draftContent, 'excerpt') : null
  const key_points = draftContent ? extractStringArray(draftContent, 'key_points') : null
  const pull_quote = draftContent ? extractString(draftContent, 'pull_quote') : null
  const notes = draftContent ? extractStringArray(draftContent, 'notes') : null
  const colophon = draftContent ? extractString(draftContent, 'colophon') : null
  const tag_id = draftContent ? extractString(draftContent, 'tag_id') : null
  // cover_image_url comes from pipeline item (content_pipeline.cover_image_url),
  // canonical source is pipeline item field, not draft section content
  const cover_image_url: string | null = null
  const meta_title = seoContent ? extractString(seoContent, 'meta_title') : null
  const meta_description = seoContent ? extractString(seoContent, 'meta_description') : null
  const og_image_url = seoContent ? extractString(seoContent, 'og_image_url') : null

  if (json) {
    try {
      const compiled = await compileJsonContent(json)
      return {
        content_json: json as Record<string, unknown>,
        content_html: compiled.html,
        content_mdx: null,
        content_compiled: null,
        content_toc: compiled.toc,
        reading_time_min: compiled.readingTimeMin,
        title,
        slug,
        excerpt,
        meta_title,
        meta_description,
        og_image_url,
        key_points,
        pull_quote,
        notes,
        colophon,
        tag_id,
        cover_image_url,
      }
    } catch {
      return null
    }
  }

  if (mdx) {
    return {
      content_json: null,
      content_html: null,
      content_mdx: mdx,
      content_compiled: null,
      content_toc: null,
      reading_time_min: null,
      title,
      slug,
      excerpt,
      meta_title,
      meta_description,
      og_image_url,
      key_points,
      pull_quote,
      notes,
      colophon,
      tag_id,
      cover_image_url,
    }
  }

  return null
}
