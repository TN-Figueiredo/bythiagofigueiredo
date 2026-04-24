import type { SiteSeoConfig } from '@/lib/seo/config'
import {
  buildBlogPostingNode,
  buildBreadcrumbNode,
  buildFaqNode,
  buildHowToNode,
  buildVideoNode,
} from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import type { JsonLdNode } from '@/lib/seo/jsonld/types'
import type { SeoExtras } from '@/lib/seo/jsonld/extras-schema'
import { toTranslationInputs } from '@/lib/blog/load-post'

// Sprint 5b PR-C C.4 — defensive Date parser: returns null on invalid /
// missing inputs so we can downgrade gracefully (skip the BlogPosting node
// instead of throwing) when the row has not-yet-set timestamps. Production
// rows always have created_at / updated_at via DB defaults, but unit tests
// (and migration backfills) may have empty strings.
export function parseDateOrNull(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

// Sprint 5b PR-C C.4 (R2 audit fix) — derive optional structured-data
// nodes from blog_translations.seo_extras jsonb. Emits FAQ/HowTo/Video
// rich-result schemas when MDX frontmatter populated the column.
export function buildExtraNodesFromSeoExtras(extras: SeoExtras | null): JsonLdNode[] {
  if (!extras) return []
  const nodes: JsonLdNode[] = []
  if (extras.faq && extras.faq.length > 0) nodes.push(buildFaqNode(extras.faq))
  if (extras.howTo) nodes.push(buildHowToNode(extras.howTo))
  if (extras.video) nodes.push(buildVideoNode(extras.video))
  return nodes
}

export function buildDetailGraph(
  config: SiteSeoConfig | null,
  post: { id: string; cover_image_url: string | null; published_at: string | null; updated_at: string },
  tx: { locale: string; slug: string; title: string; excerpt: string | null },
  translations: Array<{ locale: string; slug: string; title: string; excerpt: string | null }>,
  locale: string,
  slug: string,
  extrasByLocale: Map<string, SeoExtras | null>,
) {
  if (!config) return null
  const txInputs = toTranslationInputs(post.cover_image_url, translations, extrasByLocale)
  const crumbs = buildBreadcrumbNode([
    { name: 'Home', url: config.siteUrl },
    { name: 'Blog', url: `${config.siteUrl}/blog/${locale}` },
    {
      name: tx.title,
      url: `${config.siteUrl}/blog/${locale}/${encodeURIComponent(slug)}`,
    },
  ])
  // Audit R2: seo_extras now populated via loadSeoExtrasByLocale direct query.
  // Gated by NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED env flag.
  const extrasDisabled = process.env.NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED === 'false'
  const activeTxIn = txInputs.find((t) => t.locale === locale)
  const extras = extrasDisabled ? [] : buildExtraNodesFromSeoExtras(activeTxIn?.seo_extras ?? null)

  const updatedAt = parseDateOrNull(post.updated_at)
  const publishedAt = parseDateOrNull(post.published_at) ?? updatedAt
  if (!publishedAt || !updatedAt) {
    // Skip BlogPosting node when timestamps are absent / invalid; still emit
    // the breadcrumb + extras so the page has at least minimal structured data.
    return composeGraph([crumbs, ...extras])
  }

  const postInput = {
    id: post.id,
    translation: {
      title: tx.title,
      slug: tx.slug,
      excerpt: tx.excerpt,
      // reading_time_min isn't used by the BlogPosting builder, but the type
      // requires it; pass 0 if missing on the row passed in.
      reading_time_min: 0,
    },
    updated_at: updatedAt,
    published_at: publishedAt,
  }
  const blogNode = buildBlogPostingNode(config, postInput, txInputs)
  return composeGraph([blogNode, crumbs, ...extras])
}
