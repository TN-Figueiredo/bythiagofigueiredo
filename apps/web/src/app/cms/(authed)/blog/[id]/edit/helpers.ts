import type { JSONContent } from '@tiptap/core'
import type {
  EditorState,
  VersionContent,
  GateResult,
  GateCheck,
  ImageStatsResult,
  CategoryInfo,
  PostStatus,
  Stage,
} from './types'

/* ------------------------------------------------------------------ */
/*  Shared constants                                                  */
/* ------------------------------------------------------------------ */

export const LANG_LABEL: Record<string, string> = {
  pt: 'PT-BR',
  en: 'EN',
}

/**
 * Maps a post's kanban status to the editor stage it should open on.
 * A ready post lands on Imagens; scheduled/published land on Publicação.
 */
export const STAGE_MAP: Record<PostStatus, Stage> = {
  idea: 'ideia',
  draft: 'rascunho',
  ready: 'imagens',
  pending_review: 'imagens',
  scheduled: 'publicacao',
  published: 'publicacao',
  archived: 'rascunho',
}

/* ------------------------------------------------------------------ */
/*  Internal: recursive JSONContent walkers                           */
/* ------------------------------------------------------------------ */

/** Returns true if the JSONContent tree contains at least one text node with non-empty text. */
function hasTextContent(node: JSONContent | null): boolean {
  if (!node) return false
  if (node.type === 'text' && typeof node.text === 'string' && node.text.trim().length > 0) {
    return true
  }
  if (Array.isArray(node.content)) {
    return node.content.some(hasTextContent)
  }
  return false
}

/** Collects all blogImage nodes from a JSONContent tree. */
export function collectBlogImages(node: JSONContent | null): JSONContent[] {
  if (!node) return []
  const results: JSONContent[] = []
  if (node.type === 'blogImage') {
    results.push(node)
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      results.push(...collectBlogImages(child))
    }
  }
  return results
}

/* ------------------------------------------------------------------ */
/*  Public helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Derives a URL-safe slug from a title string.
 *
 * Steps:
 * 1. lowercase
 * 2. NFD normalize + strip combining diacritical marks
 * 3. remove smart quotes and apostrophes
 * 4. replace non-alphanumeric (except hyphens) with hyphens
 * 5. collapse consecutive hyphens
 * 6. trim leading/trailing hyphens
 * 7. truncate to 60 chars
 */
export function deriveSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .replace(/[''''""“”‘’`]/g, '') // remove smart quotes & apostrophes
    .replace(/[^a-z0-9-]/g, '-') // non-alphanum → hyphen
    .replace(/-{2,}/g, '-') // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '') // trim leading/trailing hyphens
    .slice(0, 60)
}

/** True quando a versão tem corpo de verdade (texto no JSON OU html não-vazio). */
export function bodyHasContent(
  version: Pick<VersionContent, 'body' | 'bodyHtml'> | null | undefined,
): boolean {
  if (!version) return false
  if (hasTextContent(version.body)) return true
  return version.bodyHtml.trim().length > 0
}

/**
 * Returns true when a version is effectively empty:
 * - title is empty/whitespace
 * - excerpt is empty/whitespace
 * - not published
 * - body has no text content
 */
export function isEmptyVersion(version: VersionContent): boolean {
  if (version.title.trim().length > 0) return false
  if (version.excerpt.trim().length > 0) return false
  if (version.published) return false
  if (hasTextContent(version.body)) return false
  // A completed inline image counts as real content worth confirming.
  const images = collectBlogImages(version.body)
  if (images.some((img) => img.attrs?.status === 'done')) return false
  return true
}

/**
 * Checks whether the given editor state meets publish requirements for the specified language.
 *
 * Three gates:
 * - title: non-empty title (stage: rascunho)
 * - content: body has text content (stage: rascunho)
 * - images: cover is ready AND all blogImage nodes have status 'done' (stage: imagens)
 */
export function publishGate(state: EditorState, lang: 'pt' | 'en'): GateResult {
  const version = state.content[lang]

  const titleOk = (version?.title.trim().length ?? 0) > 0

  const contentOk = hasTextContent(version?.body ?? null)

  const blogImages = collectBlogImages(version?.body ?? null)
  const allImagesDone = blogImages.every(
    (img) => img.attrs?.status === 'done',
  )
  const imagesOk = (version?.coverReady ?? false) && allImagesDone

  const checks: GateCheck[] = [
    { key: 'title', ok: titleOk, stage: 'rascunho' },
    { key: 'content', ok: contentOk, stage: 'rascunho' },
    { key: 'images', ok: imagesOk, stage: 'imagens' },
  ]

  return {
    passed: checks.every((c) => c.ok),
    checks,
  }
}

/**
 * Scans body for all blogImage nodes and counts how many have status 'done'.
 * Cover image is NOT included in this count.
 */
export function imageStats(body: JSONContent): ImageStatsResult {
  const images = collectBlogImages(body)
  const done = images.filter((img) => img.attrs?.status === 'done').length
  return { done, total: images.length }
}

/* ------------------------------------------------------------------ */
/*  Category resolution                                               */
/* ------------------------------------------------------------------ */

export function resolveCategory(
  categoryId: string,
  lang: 'pt' | 'en',
  categories: CategoryInfo[],
): { label: string; color: string } | null {
  if (!categoryId) return null
  const cat = categories.find((c) => c.id === categoryId)
  if (!cat) return { label: categoryId, color: 'var(--accent)' }
  return {
    label: lang === 'pt' ? cat.labelPt : cat.labelEn,
    color: cat.colorDark,
  }
}
