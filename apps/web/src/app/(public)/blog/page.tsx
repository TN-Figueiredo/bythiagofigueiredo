import { Suspense } from 'react'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { tryGetSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { generateBlogIndexMetadata } from '@/lib/seo/page-metadata'
import { buildBreadcrumbNode } from '@/lib/seo/jsonld/builders'
import { composeGraph } from '@/lib/seo/jsonld/graph'
import { JsonLdScript } from '@/lib/seo/jsonld/render'
import { localePath } from '@/lib/i18n/locale-path'
import { BlogArchiveClient } from './blog-archive-client'
import type { ArchivePost } from './blog-archive-client'

export const revalidate = 3600

// ---------------------------------------------------------------------------
// Category helpers
// ---------------------------------------------------------------------------
const CATEGORY_MAP: Record<string, { pt: string; color: string; colorDark: string }> = {
  code:    { pt: 'Codigo',      color: '#D65B1F', colorDark: '#E8752F' },
  product: { pt: 'Produto',     color: '#2F6B22', colorDark: '#4A8E3C' },
  essay:   { pt: 'Ensaios',     color: '#1E4D7A', colorDark: '#3A7AB5' },
  diary:   { pt: 'Diario',      color: '#8A4A8F', colorDark: '#A96DAE' },
  tools:   { pt: 'Ferramentas', color: '#B87333', colorDark: '#D4914D' },
  career:  { pt: 'Carreira',    color: '#5B6E2B', colorDark: '#7A9340' },
  tech:    { pt: 'Tech',        color: '#6366f1', colorDark: '#818cf8' },
  vida:    { pt: 'Vida',        color: '#22c55e', colorDark: '#4ade80' },
  viagem:  { pt: 'Viagem',      color: '#f59e0b', colorDark: '#fbbf24' },
  crescimento: { pt: 'Crescimento', color: '#ec4899', colorDark: '#f472b6' },
  negocio: { pt: 'Negocio',     color: '#14b8a6', colorDark: '#2dd4bf' },
}

function getCategoryColor(category: string | null, dark: boolean): string {
  if (!category) return dark ? '#3A7AB5' : '#1E4D7A'
  const entry = CATEGORY_MAP[category]
  if (!entry) return dark ? '#3A7AB5' : '#1E4D7A'
  return dark ? entry.colorDark : entry.color
}

function getCategoryLabel(category: string | null): string {
  if (!category) return 'Ensaios'
  return CATEGORY_MAP[category]?.pt ?? category
}

// ---------------------------------------------------------------------------
// Pattern assignment (deterministic by id hash)
// ---------------------------------------------------------------------------
const PATTERNS = ['dots', 'grid', 'diag', 'stripe', 'blur'] as const

function getPattern(id: string): ArchivePost['patternName'] {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  return PATTERNS[Math.abs(hash) % PATTERNS.length]!
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------
function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------
type DbRow = {
  slug: string
  title: string
  excerpt: string | null
  reading_time_min: number
  cover_image_url: string | null
  blog_posts: {
    id: string
    published_at: string | null
    category: string | null
    tag_id: string | null
    blog_tags: { name: string; color: string; color_dark: string | null } | null
  }
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------
async function fetchAllPosts(siteId: string, locale: string): Promise<DbRow[]> {
  const db = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const { data, error } = await db
    .from('blog_translations')
    .select(`
      slug, title, excerpt, reading_time_min, cover_image_url,
      blog_posts!inner(id, published_at, category, tag_id,
        blog_tags(name, color, color_dark)
      )
    `)
    .eq('locale', locale)
    .eq('blog_posts.site_id', siteId)
    .eq('blog_posts.status', 'published')
    .lte('blog_posts.published_at', now)
    .order('published_at', { referencedTable: 'blog_posts', ascending: false })

  if (error) {
    console.error('[blog/page] fetchAllPosts error:', error.message)
    return []
  }

  return (data ?? []) as unknown as DbRow[]
}

// ---------------------------------------------------------------------------
// Transform DB row to ArchivePost
// ---------------------------------------------------------------------------
function toArchivePost(row: DbRow): ArchivePost {
  const post = row.blog_posts
  const tagName = post.blog_tags?.name ?? null
  return {
    id: post.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || '',
    category: post.category || 'essay',
    categoryColor: getCategoryColor(post.category, false),
    categoryColorDark: getCategoryColor(post.category, true),
    categoryLabel: getCategoryLabel(post.category),
    date: formatDate(post.published_at),
    isoDate: post.published_at?.split('T')[0] || '',
    readingTime: row.reading_time_min || 5,
    tags: tagName ? [tagName] : [],
    coverUrl: row.cover_image_url || null,
    patternName: getPattern(post.id),
  }
}

// ---------------------------------------------------------------------------
// Derive categories with counts from posts
// ---------------------------------------------------------------------------
function deriveCategories(posts: ArchivePost[]): Array<{ key: string; label: string; color: string; count: number }> {
  const map = new Map<string, { label: string; color: string; count: number }>()
  for (const p of posts) {
    const existing = map.get(p.category)
    if (existing) {
      existing.count++
    } else {
      map.set(p.category, {
        label: p.categoryLabel,
        color: p.categoryColor,
        count: 1,
      })
    }
  }
  return Array.from(map.entries())
    .map(([key, val]) => ({ key, ...val }))
    .sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// Derive tags with counts from posts
// ---------------------------------------------------------------------------
function deriveTags(posts: ArchivePost[]): Array<{ tag: string; count: number }> {
  const map = new Map<string, number>()
  for (const p of posts) {
    for (const t of p.tags) {
      map.set(t, (map.get(t) ?? 0) + 1)
    }
  }
  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------
export default async function BlogPage() {
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const ctx = await tryGetSiteContext()

  let posts: ArchivePost[]
  let categories: Array<{ key: string; label: string; color: string; count: number }>
  let tags: Array<{ tag: string; count: number }>

  if (ctx) {
    const dbRows = await fetchAllPosts(ctx.siteId, locale)
    const dbPosts = dbRows.map(toArchivePost)
    posts = dbPosts
    categories = deriveCategories(dbPosts)
    tags = deriveTags(dbPosts)
  } else {
    posts = []
    categories = []
    tags = []
  }

  // JSON-LD breadcrumb: Home > Blog
  let graph = null
  if (ctx) {
    const host = h.get('host') ?? ctx.primaryDomain ?? ''
    const config = await getSiteSeoConfig(ctx.siteId, host).catch(() => null)
    if (config) {
      graph = composeGraph([
        buildBreadcrumbNode([
          { name: locale === 'pt-BR' ? 'Início' : 'Home', url: config.siteUrl },
          { name: 'Blog', url: `${config.siteUrl}${localePath('/blog', locale)}` },
        ]),
      ])
    }
  }

  return (
    <main style={{ background: '#1E1A12', minHeight: '100vh', paddingTop: 48, paddingBottom: 80 }}>
      {graph && <JsonLdScript graph={graph} />}
      <Suspense>
        <BlogArchiveClient
          posts={posts}
          categories={categories}
          tags={tags}
          locale={locale === 'en' ? 'en' : 'pt-BR'}
        />
      </Suspense>
    </main>
  )
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
export async function generateMetadata(): Promise<Metadata> {
  const h = await headers()
  const locale = h.get('x-locale') ?? 'en'
  const ctx = await tryGetSiteContext()
  if (!ctx) {
    return {
      title: 'Blog — By Thiago Figueiredo',
      description: 'Textos sobre codigo, produto, carreira e engenharia de software.',
      alternates: { canonical: localePath('/blog', locale) },
    }
  }
  const host = h.get('host') ?? ctx.primaryDomain ?? ''
  try {
    const config = await getSiteSeoConfig(ctx.siteId, host)
    return generateBlogIndexMetadata(config, locale)
  } catch {
    return {
      title: 'Blog — By Thiago Figueiredo',
      description: 'Textos sobre codigo, produto, carreira e engenharia de software.',
      alternates: { canonical: localePath('/blog', locale) },
    }
  }
}
