import type { JSONContent } from '@tiptap/core'
import { compileJsonContent, type TocEntry } from '@/lib/cms/compile-json'

export interface BlogContentPatch {
  content_json: Record<string, unknown> | null
  content_html: string | null
  content_mdx: string | null
  content_compiled: null
  content_toc: TocEntry[] | null
  reading_time_min: number | null
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

export async function prepareBlogTranslationPatch(
  sections: Record<string, unknown> | null | undefined,
  locale: string,
): Promise<BlogContentPatch | null> {
  const raw = getDraftForLocale(sections, locale)
  if (raw == null) return null

  const { json, mdx } = extractDraftBody(raw)

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
    }
  }

  return null
}
