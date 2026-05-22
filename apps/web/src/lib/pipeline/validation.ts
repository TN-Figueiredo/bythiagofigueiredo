import type { Format } from './schemas'
import { FORMAT_METADATA_SCHEMAS } from './schemas'

/** Minimum VVS score required to publish a pipeline item */
export const VVS_PUBLISH_THRESHOLD = 80

export interface ValidationScore {
  overall: number
  breakdown: {
    has_title: boolean
    has_hook: boolean
    has_synopsis: boolean
    has_body: boolean
    has_tags: boolean
    checklist_pct: number
    metadata_complete: boolean
    has_slug?: boolean
    has_excerpt?: boolean
    has_seo?: boolean
    has_cover?: boolean
  }
  computed_at: string
}

interface ValidationInput {
  title_pt: string | null
  title_en: string | null
  hook: string | null
  synopsis: string | null
  body_content: string | null
  tags: string[]
  production_checklist: Array<{ label: string; done: boolean }>
  format_metadata: Record<string, unknown>
  format: Format
  sections?: Record<string, { rev: number; content: unknown; source: string; edited: boolean; updated_at: string }> | null
  language?: string
}

interface CoreWeights {
  has_title: number
  has_hook: number
  has_synopsis: number
  has_body: number
  has_tags: number
  checklist_pct: number
  metadata_complete: number
}

interface BlogWeights extends CoreWeights {
  has_slug: number
  has_excerpt: number
  has_seo: number
  has_cover: number
}

const WEIGHTS_DEFAULT: CoreWeights = {
  has_title: 20,
  has_hook: 15,
  has_synopsis: 10,
  has_body: 20,
  has_tags: 10,
  checklist_pct: 15,
  metadata_complete: 10,
}

const WEIGHTS_BLOG: BlogWeights = {
  has_title: 12,
  has_hook: 10,
  has_synopsis: 8,
  has_body: 15,
  has_tags: 10,
  checklist_pct: 15,
  metadata_complete: 10,
  has_slug: 5,
  has_excerpt: 5,
  has_seo: 5,
  has_cover: 5,
}

function extractSectionField(
  sections: ValidationInput['sections'],
  key: string,
  field: string,
): unknown {
  if (!sections) return null
  const section = sections[key]
  if (!section?.content || typeof section.content !== 'object') return null
  return (section.content as Record<string, unknown>)[field] ?? null
}

function hasSectionStringField(
  sections: ValidationInput['sections'],
  key: string,
  field: string,
): boolean {
  const val = extractSectionField(sections, key, field)
  return typeof val === 'string' && val.trim().length > 0
}

export function computeValidationScore(input: ValidationInput): ValidationScore {
  const lang = input.language
  const has_title = lang === 'both'
    ? Boolean(input.title_pt) && Boolean(input.title_en)
    : lang === 'en'
      ? Boolean(input.title_en)
      : Boolean(input.title_pt)
  const has_hook = Boolean(input.hook?.trim())
  const has_synopsis = Boolean(input.synopsis?.trim())
  const has_body = Boolean(input.body_content?.trim())
  const has_tags = input.tags.length > 0

  const doneCount = input.production_checklist.filter((c) => c.done).length
  const totalCount = input.production_checklist.length
  const checklist_pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const schema = FORMAT_METADATA_SCHEMAS[input.format]
  const metaResult = schema.safeParse(input.format_metadata)
  const hasMetaValues = Object.values(input.format_metadata).some((v) => v !== undefined && v !== null && v !== '')
  const metadata_complete = metaResult.success && hasMetaValues

  const isBlogPost = input.format === 'blog_post'
  const WEIGHTS: CoreWeights = isBlogPost ? WEIGHTS_BLOG : WEIGHTS_DEFAULT

  const breakdown: ValidationScore['breakdown'] = {
    has_title,
    has_hook,
    has_synopsis,
    has_body,
    has_tags,
    checklist_pct,
    metadata_complete,
  }

  let overall =
    (has_title ? WEIGHTS.has_title : 0) +
    (has_hook ? WEIGHTS.has_hook : 0) +
    (has_synopsis ? WEIGHTS.has_synopsis : 0) +
    (has_body ? WEIGHTS.has_body : 0) +
    (has_tags ? WEIGHTS.has_tags : 0) +
    (checklist_pct / 100) * WEIGHTS.checklist_pct +
    (metadata_complete ? WEIGHTS.metadata_complete : 0)

  if (isBlogPost) {
    const blogWeights = WEIGHTS_BLOG

    // For 'both': require BOTH locales to be filled
    // For 'en': check EN sections
    // Default (pt-br/undefined): check PT sections
    const has_slug = lang === 'both'
      ? hasSectionStringField(input.sections, 'draft_pt', 'slug') && hasSectionStringField(input.sections, 'draft_en', 'slug')
      : hasSectionStringField(input.sections, lang === 'en' ? 'draft_en' : 'draft_pt', 'slug')

    const has_excerpt = lang === 'both'
      ? hasSectionStringField(input.sections, 'draft_pt', 'excerpt') && hasSectionStringField(input.sections, 'draft_en', 'excerpt')
      : hasSectionStringField(input.sections, lang === 'en' ? 'draft_en' : 'draft_pt', 'excerpt')

    const checkSeo = (seoKey: string): boolean => {
      const meta = extractSectionField(input.sections, seoKey, 'meta_title')
      const desc = extractSectionField(input.sections, seoKey, 'meta_description')
      return typeof meta === 'string' && meta.trim().length > 0 &&
        typeof desc === 'string' && desc.trim().length > 0
    }
    const has_seo = lang === 'both'
      ? checkSeo('seo_pt') && checkSeo('seo_en')
      : checkSeo(lang === 'en' ? 'seo_en' : 'seo_pt')

    // Cover is shared across locales — no change needed
    const coverVal = extractSectionField(input.sections, 'images_shared', 'cover')
    const has_cover =
      coverVal !== null &&
      typeof coverVal === 'object' &&
      typeof (coverVal as Record<string, unknown>)['image_url'] === 'string' &&
      ((coverVal as Record<string, unknown>)['image_url'] as string).trim().length > 0

    breakdown.has_slug = has_slug
    breakdown.has_excerpt = has_excerpt
    breakdown.has_seo = has_seo
    breakdown.has_cover = has_cover

    overall +=
      (has_slug ? blogWeights.has_slug : 0) +
      (has_excerpt ? blogWeights.has_excerpt : 0) +
      (has_seo ? blogWeights.has_seo : 0) +
      (has_cover ? blogWeights.has_cover : 0)
  }

  return { overall: Math.round(overall), breakdown, computed_at: new Date().toISOString() }
}
