import type { JSONContent } from '@tiptap/core'
import type {
  EditorState,
  VersionContent,
  GateResult,
  GateCheck,
  ImageStatsResult,
} from './types'

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
function collectBlogImages(node: JSONContent | null): JSONContent[] {
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
export function imageStats(body: JSONContent, _coverReady: boolean): ImageStatsResult {
  const images = collectBlogImages(body)
  const done = images.filter((img) => img.attrs?.status === 'done').length
  return { done, total: images.length }
}
