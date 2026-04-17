import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { compileMdx, MdxRunner } from '@tn-figueiredo/cms'
import { postRepo } from '../../../../../lib/cms/repositories'
import { getSiteContext, tryGetSiteContext } from '../../../../../lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { blogRegistry } from '../../../../../lib/cms/registry'
import { LocaleSwitcher } from '../../../../components/locale-switcher'
import { getSiteSeoConfig, type SiteSeoConfig } from '@/lib/seo/config'
import { generateBlogPostMetadata } from '@/lib/seo/page-metadata'
import {
  buildBlogPostingNode,
  buildBreadcrumbNode,
  buildFaqNode,
  buildHowToNode,
  buildVideoNode,
} from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import type { JsonLdNode } from '@/lib/seo/jsonld/types'
import { SeoExtrasSchema, type SeoExtras } from '@/lib/seo/jsonld/extras-schema'

export const revalidate = 3600

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

/**
 * Fetch translations for a post by slug + compute cross-locale slug map.
 * `getBySlug` only returns the matching translation (inner join), so we
 * follow up with `getById` to enumerate all available translations — this
 * drives both the hreflang alternates and the locale switcher links.
 */
async function loadPostWithLocales(siteId: string, locale: string, slug: string) {
  const post = await postRepo().getBySlug({ siteId, locale, slug })
  if (!post) return null
  const full = await postRepo().getById(post.id)
  const translations = full?.translations ?? post.translations
  // Sprint 5b audit R2 — enrich translations with seo_extras via direct
  // supabase query. @tn-figueiredo/cms PostTranslation type doesn't expose
  // the column (schema added in PR-A migration 02 but package types not
  // bumped). This unblocks C-maximalist FAQ/HowTo/Video rich results.
  // Swap to `tx.seo_extras` direct access once cms@0.3.0 ships the field.
  const extrasByLocale = await loadSeoExtrasByLocale(post.id)
  return { post, translations, full, extrasByLocale }
}

async function loadSeoExtrasByLocale(postId: string): Promise<Map<string, SeoExtras | null>> {
  try {
    const supabase = getSupabaseServiceClient()
    const { data, error } = await supabase
      .from('blog_translations')
      .select('locale, seo_extras')
      .eq('post_id', postId)
    if (error || !data) return new Map()
    const map = new Map<string, SeoExtras | null>()
    for (const row of data) {
      const raw = (row as { locale: string; seo_extras: unknown }).seo_extras
      if (raw == null) {
        map.set((row as { locale: string }).locale, null)
        continue
      }
      const parsed = SeoExtrasSchema.safeParse(raw)
      map.set((row as { locale: string }).locale, parsed.success ? parsed.data : null)
    }
    return map
  } catch {
    // Supabase env vars missing (unit tests) or transient DB failure —
    // graceful degrade: page still renders without extras rich results.
    // Production env always has the vars; the catch is test-safety only.
    return new Map()
  }
}

// Sprint 5b PR-C C.4 — adapt @tn-figueiredo/cms PostTranslation rows to the
// TranslationInput shape expected by the SEO factories + builders.
// PostTranslation does not currently expose `cover_image_url` (it lives on
// Post) nor `seo_extras` (schema added in PR-A migration 02 but cms package
// types not bumped). We propagate the post-level cover image to every
// translation and plumb seo_extras via `loadSeoExtrasByLocale` direct
// query (audit R2 fix). Swap to `tx.seo_extras`/`tx.cover_image_url` once
// cms@0.3.0 ships the fields.
type TxIn = {
  locale: string
  slug: string
  title: string
  excerpt: string | null
  cover_image_url: string | null
  seo_extras: SeoExtras | null
}
function toTranslationInputs(
  postCover: string | null,
  translations: Array<{
    locale: string
    slug: string
    title: string
    excerpt: string | null
  }>,
  extrasByLocale: Map<string, SeoExtras | null>,
): TxIn[] {
  return translations.map((t) => ({
    locale: t.locale,
    slug: t.slug,
    title: t.title,
    excerpt: t.excerpt,
    cover_image_url: postCover,
    seo_extras: extrasByLocale.get(t.locale) ?? null,
  }))
}

// Sprint 5b PR-C C.4 (R2 audit fix) — derive optional structured-data
// nodes from blog_translations.seo_extras jsonb. Emits FAQ/HowTo/Video
// rich-result schemas when MDX frontmatter populated the column.
function buildExtraNodesFromSeoExtras(extras: SeoExtras | null): JsonLdNode[] {
  if (!extras) return []
  const nodes: JsonLdNode[] = []
  if (extras.faq && extras.faq.length > 0) nodes.push(buildFaqNode(extras.faq))
  if (extras.howTo) nodes.push(buildHowToNode(extras.howTo))
  if (extras.video) nodes.push(buildVideoNode(extras.video))
  return nodes
}

export default async function BlogDetailPage({ params }: Props) {
  const { locale, slug } = await params
  const ctx = await getSiteContext()

  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) notFound()
  const { translations, full, extrasByLocale } = loaded
  const tx = translations.find((t) => t.locale === locale)
  if (!tx) notFound()

  // Pre-compiled output from admin save (fast path).
  // NULL → runtime compile fallback (slower, used for legacy posts from Sprint 1 seed).
  let compiledSource = tx.content_compiled
  if (!compiledSource) {
    const compiled = await compileMdx(tx.content_mdx, blogRegistry)
    compiledSource = compiled.compiledSource
  }

  const availableLocales = translations.map((t) => t.locale)
  const slugByLocale = new Map(translations.map((t) => [t.locale, t.slug] as const))

  // Sprint 5b PR-C C.4 — JSON-LD: BlogPosting + breadcrumb + extras (FAQ /
  // HowTo / Video) when seo_extras is populated. Root WebSite + Person/Org
  // nodes come from the public layout; composeGraph dedups by @id so a
  // duplicate WebSite node mounted here would be harmless either way.
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  const config = await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
  const detailGraph = buildDetailGraph(config, full ?? loaded.post, tx, translations, locale, slug, extrasByLocale)

  return (
    <>
      {detailGraph && <JsonLdScript graph={detailGraph} />}
      <main>
        <article>
          <header>
            <LocaleSwitcher
              available={availableLocales}
              current={locale}
              hrefFor={(loc) =>
                `/blog/${loc}/${encodeURIComponent(slugByLocale.get(loc) ?? slug)}`
              }
            />
            <h1>{tx.title}</h1>
            {tx.excerpt && <p>{tx.excerpt}</p>}
            <p>{tx.reading_time_min} min de leitura</p>
          </header>
          <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
        </article>
        {tx.content_toc.length > 0 && (
          <aside aria-label="Sumário">
            <ul>
              {tx.content_toc.map((entry) => (
                <li key={entry.slug} style={{ marginLeft: entry.depth * 8 }}>
                  <a href={`#${entry.slug}`}>{entry.text}</a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </main>
    </>
  )
}

// Sprint 5b PR-C C.4 — defensive Date parser: returns null on invalid /
// missing inputs so we can downgrade gracefully (skip the BlogPosting node
// instead of throwing) when the row has not-yet-set timestamps. Production
// rows always have created_at / updated_at via DB defaults, but unit tests
// (and migration backfills) may have empty strings.
function parseDateOrNull(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

function buildDetailGraph(
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

// Sprint 5b PR-C C.4 — replace the artisan generateMetadata with
// generateBlogPostMetadata(config, post, translations). The factory handles
// hreflang for every translation + x-default + canonical + OG image
// (per-translation seo_extras > cover_image_url > dynamic OG endpoint >
// site default), so the page no longer hardcodes any of that.
export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params
  const ctx = await tryGetSiteContext()
  if (!ctx) return {}
  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) return {}
  const { translations, full } = loaded
  const tx = translations.find((t) => t.locale === locale)
  if (!tx) return {}

  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  let config: SiteSeoConfig
  try {
    config = await getSiteSeoConfig(ctx.siteId, host)
  } catch {
    // Fallback to a minimal canonical-only response when SEO config can't
    // resolve; this keeps the page indexable without rich OG / hreflang.
    return {
      title: tx.title,
      description: tx.excerpt ?? undefined,
      alternates: { canonical: `/blog/${locale}/${encodeURIComponent(slug)}` },
    }
  }

  const post = full ?? loaded.post
  const txInputs = toTranslationInputs(post.cover_image_url, translations, loaded.extrasByLocale)
  const updatedAt = parseDateOrNull(post.updated_at)
  const publishedAt = parseDateOrNull(post.published_at) ?? updatedAt
  if (!publishedAt || !updatedAt) {
    // Same fallback as buildDetailGraph: missing timestamps means we can't
    // emit the OG article publishedTime/modifiedTime. Return a minimal
    // canonical-only Metadata so the page is still indexable.
    return {
      title: tx.title,
      description: tx.excerpt ?? undefined,
      alternates: { canonical: `/blog/${locale}/${encodeURIComponent(slug)}` },
    }
  }
  const postInput = {
    id: post.id,
    translation: {
      title: tx.title,
      slug: tx.slug,
      excerpt: tx.excerpt,
      reading_time_min: tx.reading_time_min ?? 0,
    },
    updated_at: updatedAt,
    published_at: publishedAt,
  }
  return generateBlogPostMetadata(config, postInput, txInputs)
}
