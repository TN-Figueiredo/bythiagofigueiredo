import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import { compileMdx, MdxRunner, extractToc } from '@tn-figueiredo/cms'
import { getSiteContext, tryGetSiteContext } from '@/lib/cms/site-context'
import { blogRegistry } from '@/lib/cms/registry'
import { getSiteSeoConfig, type SiteSeoConfig } from '@/lib/seo/config'
import { generateBlogPostMetadata } from '@/lib/seo/page-metadata'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { loadPostWithLocales, toTranslationInputs } from '@/lib/blog/load-post'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { buildDetailGraph, parseDateOrNull } from '@/lib/blog/build-detail-graph'
import { getRelatedPosts } from '@/lib/blog/related-posts'
import { parseMdxFrontmatter } from '@/lib/seo/frontmatter'
import { localePath } from '@/lib/i18n/locale-path'
import {
  ScrollProvider,
  PostKeyPoints,
  PostPullQuote,
  PostColophon,
  PostTags,
  AuthorRow,
  AuthorCard,
  SeriesBanner,
  SeriesNav,
  CoverImage,
  PostComments,
  RelatedPostsGrid,
  PostFootnotes,
  PostToc,
  BackToTop,
  HighlightsSidebar,
  AUTHOR_THIAGO,
  MOCK_COMMENTS,
  type TocEntry,
  MarginaliaAd,
  AnchorAd,
  BookmarkAd,
  CodaAd,
  DoormanAd,
} from '@/components/blog'
import { loadAdCreatives } from '@/lib/ads/resolve'
import { BlogArticleClient } from './blog-article-client'

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

export default async function BlogDetailPage({ params }: Props) {
  const { slug } = await params
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const ctx = await getSiteContext()

  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) notFound()
  const { post, translations, full, extrasByLocale } = loaded
  const tx = translations.find((tr) => tr.locale === locale)
  if (!tx) notFound()

  const { postExtras } = parseMdxFrontmatter(tx.content_mdx)

  let compiledSource = tx.content_compiled
  let toc: TocEntry[] = []
  if (!compiledSource) {
    const compiled = await compileMdx(tx.content_mdx, blogRegistry)
    compiledSource = compiled.compiledSource
    toc = (compiled.toc ?? []).map((h) => ({ slug: h.slug, text: h.text, depth: h.depth as 2 | 3 }))
  } else {
    const rawToc = extractToc(tx.content_mdx)
    toc = rawToc.map((h) => ({ slug: h.slug, text: h.text, depth: h.depth as 2 | 3 }))
  }

  const footnotes = Array.from(tx.content_mdx.matchAll(/^\[\^(\d+)\]:\s*(.+)$/gm)).map((m) => ({
    id: m[1]!,
    content: m[2]!,
  }))

  const publishedAt = post.published_at ?? (full ?? post).published_at

  const { data: postMeta } = await getSupabaseServiceClient()
    .from('blog_posts')
    .select('category, view_count')
    .eq('id', post.id)
    .single()
  const category = postMeta?.category ?? null

  const host = h.get('host') ?? ctx.primaryDomain ?? ''
  const [related, config] = await Promise.all([
    getRelatedPosts(ctx.siteId, locale, post.id, category),
    getSiteSeoConfig(ctx.siteId, host).catch(() => null),
  ])

  const detailGraph = buildDetailGraph(config, full ?? post, tx, translations, locale, slug, extrasByLocale)

  const formattedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : 'en', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  const updatedAt = (full ?? post).updated_at
  const showUpdated = updatedAt && publishedAt && new Date(updatedAt) > new Date(publishedAt)
  const formattedUpdated = showUpdated
    ? new Date(updatedAt).toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : 'en', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  const pageUrl = `https://${host}${localePath(`/blog/${encodeURIComponent(slug)}`, locale)}`

  const adLocale = locale as 'en' | 'pt-BR'
  let creatives: Awaited<ReturnType<typeof loadAdCreatives>> = {}
  try {
    creatives = await loadAdCreatives(adLocale)
  } catch {
    // Ads must never crash the blog page
  }

  const categoryColors: Record<string, string> = {
    code: '#D65B1F',
    tech: '#D65B1F',
    vida: '#8A4A8F',
    viagem: '#2F6B22',
    crescimento: '#5B6E2B',
    negocio: '#B87333',
  }
  const catColor = category ? categoryColors[category] ?? 'var(--pb-accent)' : 'var(--pb-accent)'

  return (
    <>
      {detailGraph && <JsonLdScript graph={detailGraph} />}

      <ScrollProvider sections={toc}>
        <div className="max-w-[1280px] mx-auto px-7 pt-7">
          <Link
            href={localePath('/blog', locale)}
            className="inline-block no-underline mb-6"
            style={{
              fontFamily: 'var(--font-caveat), cursive',
              fontSize: 18,
              color: 'var(--pb-accent)',
              transform: 'rotate(-1deg)',
            }}
          >
            ← {locale === 'pt-BR' ? 'voltar ao arquivo' : 'back to archive'}
          </Link>
        </div>

        {creatives.banner_top && <DoormanAd creative={creatives.banner_top} locale={adLocale} />}

        <div className="max-w-[1280px] mx-auto px-10">
          <div className="blog-detail-hero">
            <div
              className="flex items-center gap-3.5 mb-6 font-jetbrains flex-wrap"
              style={{ fontSize: 12, fontWeight: 400, color: '#958a75', lineHeight: 1.4, letterSpacing: '0.72px' }}
            >
              {category && (
                <span
                  className="px-2.5 py-1 text-[11px] uppercase tracking-[0.08em] font-semibold"
                  style={{
                    color: catColor,
                    border: `1px solid ${catColor}`,
                    background: 'rgba(0,0,0,0.2)',
                  }}
                >
                  {category}
                </span>
              )}
              {formattedDate && <time dateTime={publishedAt!}>{formattedDate}</time>}
              <span>·</span>
              <span>{tx.reading_time_min} min leitura</span>
              {formattedUpdated && (
                <>
                  <span>·</span>
                  <span className="italic">atualizado em {formattedUpdated}</span>
                </>
              )}
            </div>

            <SeriesBanner
              title={postExtras?.series_title}
              part={postExtras?.series_part}
              total={postExtras?.series_total}
            />

            <h1
              className="font-fraunces mb-5"
              style={{ fontSize: 'clamp(36px, 5.5vw, 64px)', fontWeight: 500, color: '#efe6d2', lineHeight: 1.08, letterSpacing: '-1.28px' }}
            >
              {tx.title}
            </h1>

            {tx.excerpt && (
              <p className="text-lg italic text-pb-muted leading-relaxed mb-6" style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}>
                {tx.excerpt}
              </p>
            )}

            <AuthorRow author={AUTHOR_THIAGO} engagement={{ views: postMeta?.view_count ?? 0, likes: 0, bookmarked: false }} locale={locale} url={pageUrl} />

            <CoverImage
              src={post.cover_image_url ?? null}
              alt={tx.title}
              heroIllustration={postExtras?.hero_illustration}
            />
          </div>
        </div>

        <div className="blog-detail-grid">
          <div className="blog-sidebar blog-detail-sidebar">
            <PostToc sections={toc} url={pageUrl} />
            <div className="blog-ad-slot">
              {creatives.rail_left && <MarginaliaAd creative={creatives.rail_left} locale={adLocale} />}
            </div>
            <BackToTop />
          </div>

          <main id="main-content">
            <article lang={locale}>
              <BlogArticleClient
                sections={toc}
                readingTimeMin={tx.reading_time_min}
                slug={slug}
                locale={locale}
                siteId={ctx.siteId}
                postId={post.id}
                keyPoints={postExtras?.key_points}
                mobileInlineAd={
                  creatives.rail_right ? <AnchorAd creative={creatives.rail_right} locale={adLocale} /> : null
                }
                midContentAd={
                  creatives.inline_mid ? (
                    <div className="blog-ad-slot">
                      <BookmarkAd creative={creatives.inline_mid} locale={adLocale} />
                    </div>
                  ) : null
                }
              >
                <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
              </BlogArticleClient>

              <div className="blog-detail-footer">
                <AuthorCard author={AUTHOR_THIAGO} locale={locale} />
                <PostTags tags={postExtras?.tags} locale={locale} />
                <SeriesNav
                  nextSlug={postExtras?.series_next_slug}
                  nextTitle={postExtras?.series_next_title}
                  nextExcerpt={postExtras?.series_next_excerpt}
                  locale={locale}
                />
                <PostFootnotes footnotes={footnotes} />
                <PostColophon text={postExtras?.colophon} />
                <div className="blog-ad-slot">
                  {creatives.block_bottom && <CodaAd creative={creatives.block_bottom} locale={adLocale} />}
                </div>
              </div>
            </article>
          </main>

          <aside className="blog-sidebar blog-detail-sidebar">
            <PostKeyPoints points={postExtras?.key_points} />
            <PostPullQuote
              quote={postExtras?.pull_quote}
              attribution={postExtras?.pull_quote_attribution}
            />
            <div className="blog-ad-slot">
              {creatives.rail_right && <AnchorAd creative={creatives.rail_right} locale={adLocale} />}
            </div>
            <HighlightsSidebar slug={slug} locale={locale} />
          </aside>
        </div>
      </ScrollProvider>

      <RelatedPostsGrid posts={related} locale={locale} category={category ?? null} />
      <div className="max-w-[920px] mx-auto px-7">
        <PostComments comments={MOCK_COMMENTS} />
      </div>
    </>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const ctx = await tryGetSiteContext()
  if (!ctx) return {}
  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) return {}
  const { translations, full } = loaded
  const tx = translations.find((tr) => tr.locale === locale)
  if (!tx) return {}

  const host = h.get('host') ?? ctx.primaryDomain ?? ''
  let config: SiteSeoConfig
  try {
    config = await getSiteSeoConfig(ctx.siteId, host)
  } catch {
    return {
      title: tx.title,
      description: tx.excerpt ?? undefined,
      alternates: { canonical: localePath(`/blog/${encodeURIComponent(slug)}`, locale) },
    }
  }

  const post = full ?? loaded.post
  const txInputs = toTranslationInputs(post.cover_image_url, translations, loaded.extrasByLocale)
  const updatedAt = parseDateOrNull(post.updated_at)
  const publishedAt = parseDateOrNull(post.published_at) ?? updatedAt
  if (!publishedAt || !updatedAt) {
    return {
      title: tx.title,
      description: tx.excerpt ?? undefined,
      alternates: { canonical: localePath(`/blog/${encodeURIComponent(slug)}`, locale) },
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
