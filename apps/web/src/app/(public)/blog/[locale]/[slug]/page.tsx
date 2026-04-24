import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import { compileMdx, MdxRunner } from '@tn-figueiredo/cms'
import { getSiteContext, tryGetSiteContext } from '@/lib/cms/site-context'
import { blogRegistry } from '@/lib/cms/registry'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { getSiteSeoConfig, type SiteSeoConfig } from '@/lib/seo/config'
import { generateBlogPostMetadata } from '@/lib/seo/page-metadata'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { loadPostWithLocales, toTranslationInputs } from '@/lib/blog/load-post'
import { buildDetailGraph, parseDateOrNull } from '@/lib/blog/build-detail-graph'
import { getRelatedPosts } from '@/lib/blog/related-posts'
import { getAdjacentPosts } from '@/lib/blog/adjacent-posts'
import { VisualBreadcrumbs } from '../../../components/visual-breadcrumbs'
import { BlogArticleClient } from './blog-article-client'
import enStrings from '@/locales/en.json'
import ptBrStrings from '@/locales/pt-BR.json'

export const revalidate = 3600

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

function getStrings(locale: string) {
  return locale === 'pt-BR' ? ptBrStrings : enStrings
}

export default async function BlogDetailPage({ params }: Props) {
  const { locale, slug } = await params
  const ctx = await getSiteContext()
  const t = getStrings(locale)

  const loaded = await loadPostWithLocales(ctx.siteId, locale, slug)
  if (!loaded) notFound()
  const { post, translations, full, extrasByLocale } = loaded
  const tx = translations.find((tr) => tr.locale === locale)
  if (!tx) notFound()

  // Pre-compiled output from admin save (fast path).
  // NULL -> runtime compile fallback (slower, used for legacy posts from Sprint 1 seed).
  let compiledSource = tx.content_compiled
  if (!compiledSource) {
    const compiled = await compileMdx(tx.content_mdx, blogRegistry)
    compiledSource = compiled.compiledSource
  }

  const availableLocales = translations.map((tr) => tr.locale)
  const slugByLocale = new Map(translations.map((tr) => [tr.locale, tr.slug] as const))
  const publishedAt = post.published_at ?? (full ?? post).published_at

  // Parallel fetches: related posts, adjacent posts, SEO config
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  const [related, adjacent, config] = await Promise.all([
    getRelatedPosts(ctx.siteId, locale, post.id, null),
    publishedAt ? getAdjacentPosts(ctx.siteId, locale, publishedAt) : Promise.resolve({ prev: null, next: null }),
    getSiteSeoConfig(ctx.siteId, host).catch(() => null),
  ])

  const detailGraph = buildDetailGraph(config, full ?? post, tx, translations, locale, slug, extrasByLocale)

  const formattedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <>
      {detailGraph && <JsonLdScript graph={detailGraph} />}
      <main id="main-content" style={{ maxWidth: 780, margin: '0 auto', padding: '32px 28px 64px' }}>
        <VisualBreadcrumbs
          items={[
            { label: t['blog.breadcrumb.home'], href: '/' },
            { label: t['blog.breadcrumb.blog'], href: `/blog/${locale}` },
            { label: tx.title },
          ]}
        />

        <article lang={locale}>
          <header>
            <LocaleSwitcher
              available={availableLocales}
              current={locale}
              hrefFor={(loc) =>
                `/blog/${loc}/${encodeURIComponent(slugByLocale.get(loc) ?? slug)}`
              }
            />
            <h1 className="font-fraunces text-3xl md:text-4xl font-bold mt-4 mb-3">{tx.title}</h1>
            {tx.excerpt && <p className="text-lg text-pb-muted mb-3">{tx.excerpt}</p>}
            <p className="text-sm text-pb-muted mb-6">
              {formattedDate && <time dateTime={publishedAt!}>{formattedDate}</time>}
              {formattedDate && ' · '}
              {t['blog.detail.readingTime'].replace('{min}', String(tx.reading_time_min))}
            </p>
          </header>

          <BlogArticleClient>
            <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
          </BlogArticleClient>
        </article>

        {/* Adjacent post navigation */}
        {(adjacent.prev || adjacent.next) && (
          <nav aria-label="Post navigation" className="flex justify-between mt-12 pt-6 border-t border-pb-faint">
            {adjacent.prev ? (
              <Link href={`/blog/${locale}/${encodeURIComponent(adjacent.prev.slug)}`} className="hover:text-pb-accent transition-colors">
                &larr; {t['blog.detail.prev']}: {adjacent.prev.title}
              </Link>
            ) : <span />}
            {adjacent.next ? (
              <Link href={`/blog/${locale}/${encodeURIComponent(adjacent.next.slug)}`} className="hover:text-pb-accent transition-colors text-right">
                {t['blog.detail.next']}: {adjacent.next.title} &rarr;
              </Link>
            ) : <span />}
          </nav>
        )}

        {/* Related posts */}
        {related.length > 0 && (
          <section aria-label={t['blog.detail.related']} className="mt-12 pt-6 border-t border-pb-faint">
            <h2 className="font-fraunces text-xl font-bold mb-4">{t['blog.detail.related']}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((r) => (
                <li key={r.id}>
                  <Link href={`/blog/${locale}/${encodeURIComponent(r.slug)}`} className="block p-4 rounded-lg hover:bg-pb-surface transition-colors">
                    <h3 className="font-semibold mb-1">{r.title}</h3>
                    {r.excerpt && <p className="text-sm text-pb-muted line-clamp-2">{r.excerpt}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
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
