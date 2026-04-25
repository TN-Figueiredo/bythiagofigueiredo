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
import { buildDetailGraph, parseDateOrNull } from '@/lib/blog/build-detail-graph'
import { getRelatedPosts } from '@/lib/blog/related-posts'
import { parseMdxFrontmatter } from '@/lib/seo/frontmatter'
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
  NewsletterCta,
  PostToc,
  HighlightsSidebar,
  AUTHOR_THIAGO,
  MOCK_ENGAGEMENT,
  MOCK_COMMENTS,
  type TocEntry,
} from '@/components/blog'
import { BlogArticleClient } from './blog-article-client'

export const revalidate = 3600

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export default async function BlogDetailPage({ params }: Props) {
  const { locale, slug } = await params
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

  const publishedAt = post.published_at ?? (full ?? post).published_at

  const category = (post as unknown as { category?: string | null }).category ?? null

  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
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

  const pageUrl = `https://${host}/blog/${locale}/${encodeURIComponent(slug)}`

  return (
    <>
      {detailGraph && <JsonLdScript graph={detailGraph} />}

      <ScrollProvider sections={toc}>
        {/* Hero — centered, above 3-col grid */}
        <div className="max-w-[1280px] mx-auto px-10 pt-8">
          <div className="blog-detail-hero">
            <Link href={`/blog/${locale}`} className="inline-block text-sm text-pb-accent no-underline mb-6">
              ← voltar ao arquivo
            </Link>

            <div className="flex items-center gap-3 mb-4 text-[13px] text-pb-muted flex-wrap">
              {category && (
                <span className="border-[1.5px] border-pb-accent text-pb-accent px-2.5 py-0.5 rounded font-jetbrains text-[11px] uppercase tracking-wider font-medium">
                  {category}
                </span>
              )}
              {formattedDate && <time dateTime={publishedAt!}>{formattedDate}</time>}
              <span>·</span>
              <span>{tx.reading_time_min} min leitura</span>
              {formattedUpdated && (
                <>
                  <span>·</span>
                  <span>atualizado em {formattedUpdated}</span>
                </>
              )}
            </div>

            <SeriesBanner
              title={postExtras?.series_title}
              part={postExtras?.series_part}
              total={postExtras?.series_total}
            />

            <h1 className="font-fraunces font-bold text-pb-ink mb-4" style={{ fontSize: 'clamp(36px, 5.5vw, 64px)', lineHeight: 1.08 }}>
              {tx.title}
            </h1>

            {tx.excerpt && (
              <p className="text-lg italic text-pb-muted leading-relaxed mb-6" style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}>
                {tx.excerpt}
              </p>
            )}

            <AuthorRow author={AUTHOR_THIAGO} engagement={MOCK_ENGAGEMENT} locale={locale} url={pageUrl} />

            <CoverImage src={post.cover_image_url ?? null} alt={tx.title} />
          </div>
        </div>

        {/* 3-Column Grid */}
        <div className="blog-detail-grid">
          <PostToc sections={toc} url={pageUrl} />

          <main id="main-content">
            <article lang={locale}>
              <BlogArticleClient
                sections={toc}
                readingTimeMin={tx.reading_time_min}
                slug={slug}
                locale={locale}
                keyPoints={postExtras?.key_points}
              >
                <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
              </BlogArticleClient>
            </article>
          </main>

          <aside className="blog-sidebar blog-detail-sidebar">
            <PostKeyPoints points={postExtras?.key_points} />
            <PostPullQuote
              quote={postExtras?.pull_quote}
              attribution={postExtras?.pull_quote_attribution}
            />
            <HighlightsSidebar slug={slug} locale={locale} />
          </aside>
        </div>

        {/* Post Footer — centered 760px */}
        <div className="blog-detail-footer px-10">
          <AuthorCard author={AUTHOR_THIAGO} locale={locale} />
          <PostTags tags={postExtras?.tags} locale={locale} />
          <PostComments comments={MOCK_COMMENTS} />
          <SeriesNav
            nextSlug={postExtras?.series_next_slug}
            nextTitle={postExtras?.series_next_title}
            nextExcerpt={postExtras?.series_next_excerpt}
            locale={locale}
          />
          <NewsletterCta category={category ?? null} locale={locale} />
          <PostFootnotes footnotes={[]} />
          <PostColophon text={postExtras?.colophon} />
        </div>
      </ScrollProvider>

      <RelatedPostsGrid posts={related} locale={locale} category={category ?? null} />
    </>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params
  const ctx = await tryGetSiteContext()
  if (!ctx) return {}
  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) return {}
  const { translations, full } = loaded
  const tx = translations.find((tr) => tr.locale === locale)
  if (!tx) return {}

  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  let config: SiteSeoConfig
  try {
    config = await getSiteSeoConfig(ctx.siteId, host)
  } catch {
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
