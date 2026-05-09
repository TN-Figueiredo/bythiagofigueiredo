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
import { ptBR } from '@/components/blog/_i18n/pt-BR'
import { en } from '@/components/blog/_i18n/en'
import {
  ScrollProvider,
  PostKeyPoints,
  PostPullQuote,
  PostColophon,
  PostNotes,
  PostTags,
  AuthorRow,
  AuthorCard,
  SeriesBanner,
  SeriesNav,
  CoverImage,
  RelatedPostsGrid,
  PostFootnotes,
  PostToc,
  BackToTop,
  HighlightsSidebar,
  type TocEntry,
  MarginaliaAd,
  AnchorAd,
  BookmarkAd,
  CodaAd,
  DoormanAd,
  type AuthorData,
} from '@/components/blog'

async function fetchPostAuthor(siteId: string, authorId: string | null, locale: string): Promise<AuthorData> {
  const sb = getSupabaseServiceClient()
  const fallback: AuthorData = { name: 'Author', role: '', avatarUrl: null, initials: '?', bio: '', links: [] }

  const query = authorId
    ? sb.from('authors').select('id, display_name, avatar_url, bio, social_links').eq('id', authorId).single()
    : sb.from('authors').select('id, display_name, avatar_url, bio, social_links').eq('site_id', siteId).eq('is_default', true).single()

  const { data: author } = await query
  if (!author) return fallback

  const { data: txRows } = await sb
    .from('author_about_translations')
    .select('locale, subtitle, bio')
    .eq('author_id', author.id as string)

  const tx = (txRows ?? []).find((t: { locale: string }) => t.locale === locale) ?? (txRows ?? [])[0]

  const name = (author.display_name as string) ?? 'Author'
  const parts = name.split(' ')
  const initials = parts.length >= 2 ? `${parts[0]![0]}${parts[parts.length - 1]![0]}` : name.slice(0, 2)

  const socialLinks = (author.social_links as Record<string, string>) ?? {}
  const links = Object.entries(socialLinks)
    .filter(([, v]) => !!v)
    .map(([k, v]) => ({ label: k.charAt(0).toUpperCase() + k.slice(1), href: v }))

  return {
    name,
    role: (tx as { subtitle?: string } | undefined)?.subtitle ?? (author.bio as string) ?? '',
    avatarUrl: (author.avatar_url as string) ?? null,
    initials: initials.toUpperCase(),
    bio: (tx as { bio?: string } | undefined)?.bio ?? (author.bio as string) ?? '',
    links,
  }
}

import { loadAdCreatives } from '@/lib/ads/resolve'
import { slugify } from '@/lib/blog/slugify'
import { BlogArticleClient } from './blog-article-client'

function extractTocFromHtml(html: string): TocEntry[] {
  const entries: TocEntry[] = []
  const re = /<h([23])(\s[^>]*)?>(([\s\S]*?))<\/h\1>/gi
  let match
  while ((match = re.exec(html)) !== null) {
    const depth = Number(match[1]) as 2 | 3
    const attrs = match[2] ?? ''
    const text = match[3]!.replace(/<[^>]+>/g, '').trim()
    if (!text) continue
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/)
    const slug = idMatch ? idMatch[1]! : slugify(text)
    entries.push({ slug, text, depth })
  }
  return entries
}

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
  const t = locale === 'pt-BR' ? ptBR : en

  let compiledSource = tx.content_compiled
  let toc: TocEntry[] = []
  if (!compiledSource) {
    const compiled = await compileMdx(tx.content_mdx, blogRegistry)
    compiledSource = compiled.compiledSource
    toc = (compiled.toc ?? []).map((h) => ({ slug: h.slug, text: h.text, depth: h.depth as 2 | 3 }))
  } else {
    const rawToc = extractToc(tx.content_mdx)
    toc = rawToc.map((h) => ({ slug: h.slug, text: h.text, depth: h.depth as 2 | 3 }))
    if (toc.length === 0) {
      toc = extractTocFromHtml(tx.content_mdx)
    }
  }

  const footnotes = Array.from(tx.content_mdx.matchAll(/^\[\^(\d+)\]:\s*(.+)$/gm)).map((m) => ({
    id: m[1]!,
    content: m[2]!,
  }))

  const publishedAt = post.published_at ?? (full ?? post).published_at

  const supabase = getSupabaseServiceClient()

  const { data: postMeta } = await supabase
    .from('blog_posts')
    .select('category, view_count, author_id')
    .eq('id', post.id)
    .single()
  const category = postMeta?.category ?? null

  const [txStructured, hashtagResult, prevPostResult] = await Promise.all([
    supabase
      .from('blog_translations')
      .select('key_points, pull_quote, notes, colophon, content_html')
      .eq('post_id', post.id)
      .eq('locale', locale)
      .maybeSingle(),
    supabase
      .from('post_hashtags')
      .select('hashtags(id, name, slug)')
      .eq('post_id', post.id),
    supabase
      .from('blog_posts')
      .select('previous_post_id, continues_in_next')
      .eq('id', post.id)
      .maybeSingle(),
  ])

  const txExtra = txStructured.data ?? {}
  const postHashtags = (hashtagResult.data ?? []).map((r: { hashtags: unknown }) => r.hashtags).filter(Boolean) as Array<{ id: string; name: string; slug: string }>
  const postSeries = prevPostResult.data ?? { previous_post_id: null, continues_in_next: false }

  // Fetch previous post title/slug for series chain
  let previousPost: { title: string; slug: string; locale: string } | null = null
  if (postSeries.previous_post_id) {
    const { data: prevTx } = await supabase
      .from('blog_translations')
      .select('title, slug')
      .eq('post_id', postSeries.previous_post_id)
      .eq('locale', locale)
      .maybeSingle()
    if (prevTx) previousPost = { ...prevTx, locale }
  }

  // Fetch next post (any post that points back to this one)
  let nextPost: { title: string; slug: string; locale: string; excerpt?: string } | null = null
  const { data: nextData } = await supabase
    .from('blog_posts')
    .select('id')
    .eq('previous_post_id', post.id)
    .limit(1)
    .maybeSingle()
  if (nextData) {
    const { data: nextTx } = await supabase
      .from('blog_translations')
      .select('title, slug, excerpt')
      .eq('post_id', nextData.id)
      .eq('locale', locale)
      .maybeSingle()
    if (nextTx) nextPost = { ...nextTx, locale, excerpt: nextTx.excerpt ?? undefined }
  }

  const host = h.get('host') ?? ctx.primaryDomain ?? ''
  const [related, config, authorData] = await Promise.all([
    getRelatedPosts(ctx.siteId, locale, post.id, category),
    getSiteSeoConfig(ctx.siteId, host).catch(() => null),
    fetchPostAuthor(ctx.siteId, (postMeta?.author_id as string) ?? null, locale),
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
            ← {t.backToArchive}
          </Link>
        </div>

        {creatives['post:top:banner'] && <DoormanAd creative={creatives['post:top:banner']} locale={adLocale} />}

        <div className="max-w-[1280px] mx-auto px-4 sm:px-10">
          <div className="blog-detail-hero">
            <div
              className="flex items-center gap-3.5 mb-6 font-jetbrains flex-wrap"
              style={{ fontSize: 12, fontWeight: 400, color: 'var(--pb-muted)', lineHeight: 1.4, letterSpacing: '0.72px' }}
            >
              {category && (
                <span
                  className="px-2.5 py-1 text-[11px] uppercase tracking-[0.08em] font-semibold"
                  style={{
                    color: catColor,
                    border: `1px solid ${catColor}`,
                    background: 'color-mix(in srgb, var(--pb-bg) 80%, transparent)',
                  }}
                >
                  {category}
                </span>
              )}
              {formattedDate && <time dateTime={publishedAt!}>{formattedDate}</time>}
              <span>·</span>
              <span>{tx.reading_time_min} {t.minRead}</span>
              {formattedUpdated && (
                <>
                  <span>·</span>
                  <span className="italic">{t.updatedAt} {formattedUpdated}</span>
                </>
              )}
            </div>

            <SeriesBanner previousPost={previousPost} t={t} />

            <h1
              className="font-fraunces mb-5"
              style={{ fontSize: 'clamp(36px, 5.5vw, 64px)', fontWeight: 500, color: 'var(--pb-ink)', lineHeight: 1.08, letterSpacing: '-1.28px' }}
            >
              {tx.title}
            </h1>

            {tx.excerpt && (
              <p className="text-lg italic text-pb-muted leading-relaxed mb-6" style={{ fontFamily: 'var(--font-source-serif), Georgia, serif' }}>
                {tx.excerpt}
              </p>
            )}

            <AuthorRow author={authorData} engagement={{ views: postMeta?.view_count ?? 0, likes: 0, bookmarked: false }} locale={locale} url={pageUrl} />

            <CoverImage
              src={post.cover_image_url ?? null}
              alt={tx.title}
              heroIllustration={postExtras?.hero_illustration}
            />
          </div>
        </div>

        <div className="blog-detail-grid">
          <div className="blog-sidebar blog-detail-sidebar">
            <PostToc sections={toc} url={pageUrl} locale={locale} />
            <div className="blog-ad-slot">
              {creatives['post:rail:anchor-left'] && <MarginaliaAd creative={creatives['post:rail:anchor-left']} locale={adLocale} />}
            </div>
            <BackToTop locale={locale} />
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
                keyPoints={(txExtra as { key_points?: string[] }).key_points ?? undefined}
                mobileInlineAd={
                  creatives['post:rail:anchor'] ? <AnchorAd creative={creatives['post:rail:anchor']} locale={adLocale} /> : null
                }
                midContentAd={
                  creatives['post:body:bookmark'] ? (
                    <div className="blog-ad-slot">
                      <BookmarkAd creative={creatives['post:body:bookmark']} locale={adLocale} />
                    </div>
                  ) : null
                }
              >
                <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
              </BlogArticleClient>

              <div className="blog-detail-footer">
                <AuthorCard author={authorData} locale={locale} />
                <PostTags hashtags={postHashtags} locale={locale} t={t} />
                <SeriesNav
                  previousPost={previousPost}
                  nextPost={nextPost}
                  continuesInNext={postSeries.continues_in_next ?? false}
                  t={t}
                  locale={locale}
                />
                <PostFootnotes footnotes={footnotes} />
                <PostNotes notes={(txExtra as { notes?: string[] }).notes ?? []} t={t} />
                <PostColophon text={(txExtra as { colophon?: string }).colophon ?? undefined} t={t} />
                <div className="blog-ad-slot">
                  {creatives['post:footer:coda'] && <CodaAd creative={creatives['post:footer:coda']} locale={adLocale} />}
                </div>
              </div>
            </article>
          </main>

          <aside className="blog-sidebar blog-detail-sidebar">
            <PostKeyPoints points={(txExtra as { key_points?: string[] }).key_points ?? []} t={t} />
            <PostPullQuote
              quote={(txExtra as { pull_quote?: string }).pull_quote ?? undefined}
              attribution={postExtras?.pull_quote_attribution}
            />
            <div className="blog-ad-slot">
              {creatives['post:rail:anchor'] && <AnchorAd creative={creatives['post:rail:anchor']} locale={adLocale} />}
            </div>
            <HighlightsSidebar slug={slug} locale={locale} />
          </aside>
        </div>
      </ScrollProvider>

      <RelatedPostsGrid posts={related} locale={locale} category={category ?? null} />
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
