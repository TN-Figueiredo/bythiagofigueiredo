import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { localePath, hreflangCode } from '@/lib/i18n/locale-path'
import type { SiteSeoConfig } from './config'

export interface SitemapRouteEntry {
  path: string
  lastModified: Date
  changeFrequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  priority: number
  alternates: Record<string, string>
}

const STATIC_ROUTE_DEFS: ReadonlyArray<{
  path: string
  changeFrequency: SitemapRouteEntry['changeFrequency']
  priority: number
}> = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/pt', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/newsletters', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/pt/newsletters', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/newsletter/archive', changeFrequency: 'weekly', priority: 0.4 },
]

export async function enumerateSiteRoutes(
  siteId: string,
  config: SiteSeoConfig,
): Promise<SitemapRouteEntry[]> {
  if (process.env.SEO_SITEMAP_KILLED === 'true') {
    Sentry.captureMessage('sitemap: killed via SEO_SITEMAP_KILLED', { level: 'warning' })
    return []
  }

  const supabase = getSupabaseServiceClient()
  const now = new Date().toISOString()

  const [posts, campaigns] = await Promise.all([
    supabase
      .from('blog_translations')
      .select('slug, locale, updated_at, blog_posts!inner(id, status, published_at, site_id)')
      .eq('blog_posts.site_id', siteId)
      .eq('blog_posts.status', 'published')
      .lte('blog_posts.published_at', now)
      .not('blog_posts.published_at', 'is', null),
    supabase
      .from('campaign_translations')
      .select('slug, locale, updated_at, campaigns!inner(id, status, site_id)')
      .eq('campaigns.site_id', siteId)
      .eq('campaigns.status', 'active'),
  ])

  if (posts.error || campaigns.error) {
    Sentry.captureException(posts.error ?? campaigns.error, {
      tags: { component: 'seo-enumerator', siteId },
    })
    return buildStaticRoutes(config)
  }

  type TxRow = { locale: string; slug: string; updated_at: string }

  const postsById = new Map<string, TxRow[]>()
  for (const t of posts.data ?? []) {
    const row = t as unknown as { blog_posts: { id: string } | null; locale: string; slug: string; updated_at: string }
    const p = row.blog_posts
    if (!p) continue
    if (!postsById.has(p.id)) postsById.set(p.id, [])
    postsById.get(p.id)!.push({ locale: row.locale, slug: row.slug, updated_at: row.updated_at })
  }

  const postRoutes: SitemapRouteEntry[] = []
  for (const translations of postsById.values()) {
    for (const t of translations) {
      const alternates: Record<string, string> = {}
      for (const alt of translations) {
        alternates[hreflangCode(alt.locale)] = localePath(`${config.contentPaths.blog}/${alt.slug}`, alt.locale)
      }
      postRoutes.push({
        path: localePath(`${config.contentPaths.blog}/${t.slug}`, t.locale),
        lastModified: new Date(t.updated_at),
        changeFrequency: 'weekly',
        priority: 0.7,
        alternates,
      })
    }
  }

  const campaignsById = new Map<string, TxRow[]>()
  for (const t of campaigns.data ?? []) {
    const row = t as unknown as { campaigns: { id: string } | null; locale: string; slug: string; updated_at: string }
    const c = row.campaigns
    if (!c) continue
    if (!campaignsById.has(c.id)) campaignsById.set(c.id, [])
    campaignsById.get(c.id)!.push({ locale: row.locale, slug: row.slug, updated_at: row.updated_at })
  }
  const campaignRoutes: SitemapRouteEntry[] = []
  for (const translations of campaignsById.values()) {
    for (const t of translations) {
      const alternates: Record<string, string> = {}
      for (const alt of translations) {
        alternates[alt.locale] = localePath(`${config.contentPaths.campaigns}/${alt.slug}`, alt.locale)
      }
      campaignRoutes.push({
        path: localePath(`${config.contentPaths.campaigns}/${t.slug}`, t.locale),
        lastModified: new Date(t.updated_at),
        changeFrequency: 'monthly',
        priority: 0.8,
        alternates,
      })
    }
  }

  // Newsletter archive (sent editions)
  const { data: sentEditions } = await supabase
    .from('newsletter_editions')
    .select('id, sent_at')
    .eq('site_id', siteId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(200)

  const archiveRoutes: SitemapRouteEntry[] = (sentEditions ?? []).map((edition) => ({
    path: `/newsletter/archive/${edition.id}`,
    lastModified: edition.sent_at ? new Date(edition.sent_at) : new Date(),
    changeFrequency: 'yearly' as const,
    priority: 0.5,
    alternates: {},
  }))

  const blogIndex: SitemapRouteEntry = {
    path: localePath(config.contentPaths.blog, config.defaultLocale),
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.9,
    alternates: Object.fromEntries(
      config.supportedLocales.map((l) => [hreflangCode(l), localePath(config.contentPaths.blog, l)]),
    ),
  }

  const all = [...buildStaticRoutes(config), blogIndex, ...postRoutes, ...campaignRoutes, ...archiveRoutes]
  return all.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
}

function buildStaticRoutes(config: SiteSeoConfig): SitemapRouteEntry[] {
  void config
  const now = new Date()
  return STATIC_ROUTE_DEFS.map((s) => ({
    ...s,
    lastModified: now,
    alternates: {},
  }))
}
