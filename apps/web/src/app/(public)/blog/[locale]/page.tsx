import Link from 'next/link'
import Image from 'next/image'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getSiteContext, tryGetSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateBlogIndexMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { VisualBreadcrumbs } from '../../components/visual-breadcrumbs'
import { CategoryFilter } from './category-filter'
import enStrings from '@/locales/en.json'
import ptBrStrings from '@/locales/pt-BR.json'

export const revalidate = 3600

const PER_PAGE = 12

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ page?: string; category?: string }>
}

type BlogListPost = {
  id: string
  published_at: string | null
  cover_image_url: string | null
  category: string | null
  slug: string
  title: string
  excerpt: string | null
  reading_time_min: number
  locale: string
}

async function getBlogPosts(opts: {
  siteId: string
  locale: string
  page: number
  category?: string | null
}): Promise<{ posts: BlogListPost[]; total: number; allCategories: string[] }> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()
  const from = (opts.page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  // Fetch all categories first (unfiltered by page/category) for the filter bar
  const { data: catRows } = await db
    .from('blog_posts')
    .select('category')
    .eq('site_id', opts.siteId)
    .eq('status', 'published')
    .lte('published_at', now)
    .not('category', 'is', null)

  const allCategories = Array.from(
    new Set((catRows ?? []).map((r) => (r as Record<string, unknown>)['category'] as string))
  ).sort()

  // Build the main query
  let q = db
    .from('blog_translations')
    .select(
      `slug, locale, title, excerpt, reading_time_min,
       blog_posts!inner(id, published_at, cover_image_url, category, status, site_id)`,
      { count: 'exact' }
    )
    .eq('locale', opts.locale)
    .eq('blog_posts.site_id', opts.siteId)
    .eq('blog_posts.status', 'published')
    .lte('blog_posts.published_at', now)

  if (opts.category) {
    q = q.eq('blog_posts.category', opts.category)
  }

  const { data, count, error } = await q
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })
    .range(from, to)

  if (error) throw error

  const posts: BlogListPost[] = (data ?? []).map((row: Record<string, unknown>) => {
    const post = row['blog_posts'] as Record<string, unknown>
    return {
      id: post['id'] as string,
      published_at: post['published_at'] as string | null,
      cover_image_url: post['cover_image_url'] as string | null,
      category: post['category'] as string | null,
      slug: row['slug'] as string,
      title: row['title'] as string,
      excerpt: row['excerpt'] as string | null,
      reading_time_min: row['reading_time_min'] as number,
      locale: row['locale'] as string,
    }
  })

  return { posts, total: count ?? 0, allCategories }
}

// NOTE (Sprint 2): UI strings hardcoded as pt-BR intentionally.
// i18n lands in Sprint 3; user currently only has pt-BR + en sites.
export default async function BlogListPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const ctx = await getSiteContext()
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10))
  const category = sp.category ?? null

  const t = (
    locale === 'pt-BR' ? ptBrStrings : enStrings
  ) as Record<string, string>

  const { posts, total, allCategories } = await getBlogPosts({
    siteId: ctx.siteId,
    locale,
    page,
    category,
  })

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  // Derive locales available across the current page of posts. Not exhaustive
  // across the whole site (we don't have a sites.locales column), but good
  // enough to hide the switcher on single-locale sites.
  const availableLocales = Array.from(
    new Set([locale])
  )

  // Sprint 5b PR-C C.4 — breadcrumb JSON-LD (Home -> Blog) on the index. The
  // root WebSite + Person/Org nodes are already mounted by the public layout.
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  const config = await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
  const breadcrumbGraph = config
    ? composeGraph([
        buildBreadcrumbNode([
          { name: 'Home', url: config.siteUrl },
          { name: 'Blog', url: `${config.siteUrl}/blog/${locale}` },
        ]),
      ])
    : null

  function formatDate(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  function buildPageHref(p: number): string {
    const params = new URLSearchParams()
    if (p > 1) params.set('page', String(p))
    if (category) params.set('category', category)
    const qs = params.toString()
    return qs ? `?${qs}` : '?'
  }

  const paginationLabel = (t['blog.pagination.page'] ?? '')
    .replace('{current}', String(page))
    .replace('{total}', String(totalPages))

  return (
    <>
      {breadcrumbGraph && <JsonLdScript graph={breadcrumbGraph} />}
      <main>
        <div className="reader-pinboard" style={{ maxWidth: 780, margin: '0 auto', padding: '32px 28px 64px' }}>
          {/* Breadcrumbs */}
          <VisualBreadcrumbs
            items={[
              { label: t['blog.breadcrumb.home'] ?? '', href: '/' },
              { label: t['blog.breadcrumb.blog'] ?? '' },
            ]}
          />

          {/* Header row: title + locale switcher */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="font-fraunces text-3xl font-bold text-pb-ink">
              {t['blog.title'] ?? 'Blog'}
            </h1>
            <LocaleSwitcher
              available={availableLocales}
              current={locale}
              hrefFor={(loc) => `/blog/${loc}`}
            />
          </div>

          {/* Category filter */}
          {allCategories.length > 0 && (
            <CategoryFilter
              categories={allCategories}
              currentCategory={category}
              allLabel={t['blog.allCategories'] ?? 'All'}
            />
          )}

          {/* Empty state */}
          {posts.length === 0 && (
            <p className="text-pb-muted text-center py-12">
              {t['blog.empty'] ?? 'No posts yet.'}
            </p>
          )}

          {/* Post grid */}
          {posts.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${locale}/${post.slug}`}
                  className="group block rounded-lg border border-pb-faint p-4 hover:border-pb-accent transition-colors"
                  style={{ borderLeft: '4px solid var(--pb-accent)' }}
                >
                  <div className="flex gap-4">
                    {/* Cover image */}
                    {post.cover_image_url && (
                      <div className="hidden sm:block flex-shrink-0 w-28 h-20 rounded overflow-hidden relative">
                        <Image
                          src={post.cover_image_url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="112px"
                        />
                      </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h2 className="font-fraunces font-semibold text-pb-ink group-hover:text-pb-accent transition-colors line-clamp-1">
                        {post.title}
                      </h2>

                      {post.excerpt && (
                        <p className="text-sm text-pb-muted line-clamp-2 mt-1">
                          {post.excerpt}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2">
                        <time
                          dateTime={post.published_at ?? undefined}
                          className="font-mono text-xs text-pb-muted"
                        >
                          {formatDate(post.published_at)}
                        </time>
                        <span className="font-mono text-xs text-pb-muted">
                          {(t['blog.readingTime'] ?? '{min} min read').replace(
                            '{min}',
                            String(post.reading_time_min)
                          )}
                        </span>
                        {post.category && (
                          <span className="font-mono text-xs text-pb-muted capitalize">
                            {post.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Numbered pagination */}
          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-center gap-2 mt-10"
            >
              {/* Previous */}
              {page > 1 ? (
                <Link
                  href={buildPageHref(page - 1)}
                  className="font-mono text-xs px-3 py-1.5 rounded border border-pb-faint text-pb-muted hover:text-pb-ink hover:border-pb-accent transition-colors"
                >
                  {t['blog.pagination.prev'] ?? 'Previous'}
                </Link>
              ) : (
                <span className="font-mono text-xs px-3 py-1.5 rounded border border-pb-faint text-pb-faint cursor-not-allowed">
                  {t['blog.pagination.prev'] ?? 'Previous'}
                </span>
              )}

              {/* Page indicator */}
              <span className="font-mono text-xs text-pb-muted px-2">
                {paginationLabel}
              </span>

              {/* Next */}
              {page < totalPages ? (
                <Link
                  href={buildPageHref(page + 1)}
                  className="font-mono text-xs px-3 py-1.5 rounded border border-pb-faint text-pb-muted hover:text-pb-ink hover:border-pb-accent transition-colors"
                >
                  {t['blog.pagination.next'] ?? 'Next'}
                </Link>
              ) : (
                <span className="font-mono text-xs px-3 py-1.5 rounded border border-pb-faint text-pb-faint cursor-not-allowed">
                  {t['blog.pagination.next'] ?? 'Next'}
                </span>
              )}
            </nav>
          )}
        </div>
      </main>
    </>
  )
}

// Sprint 5b PR-C C.4 — replace the artisan generateMetadata (which emitted
// hardcoded hreflang for pt-BR + en) with generateBlogIndexMetadata(config,
// locale). The factory derives hreflang from config.supportedLocales, which
// matches the site row, so adding a third locale to the site no longer
// requires editing this page.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    return { title: 'Blog', alternates: { canonical: `/blog/${locale}` } }
  }
  const host = (await headers()).get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateBlogIndexMetadata(config, locale)
  } catch {
    return { title: 'Blog', alternates: { canonical: `/blog/${locale}` } }
  }
}
