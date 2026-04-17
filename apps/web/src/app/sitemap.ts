import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { isPreviewOrDevHost, resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { enumerateSiteRoutes, type SitemapRouteEntry } from '@/lib/seo/enumerator'

/**
 * Sprint 5b PR-B Phase 3 — multi-domain dynamic sitemap.
 *
 * Resolves the request host via `next/headers` directly (NOT middleware
 * `x-site-id` headers — those are stripped from `MetadataRoute` invocations
 * per Next #58436). Returns `[]` for preview/dev to keep crawlers off
 * non-canonical hosts. Maps `SitemapRouteEntry[]` to absolute URLs and
 * propagates per-locale alternates with `x-default` pointing at the
 * default-locale variant.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers()
  const host = (h.get('host') ?? '').split(':')[0] ?? ''
  if (isPreviewOrDevHost(host)) return []
  const site = await resolveSiteByHost(host)
  if (!site) return []
  const config = await getSiteSeoConfig(site.id, host)
  const routes = await enumerateSiteRoutes(site.id, config)
  return routes.map((r) => toSitemapEntry(r, config.siteUrl, config.defaultLocale))
}

function toSitemapEntry(
  r: SitemapRouteEntry,
  siteUrl: string,
  defaultLocale: string,
): MetadataRoute.Sitemap[number] {
  const absAlternates: Record<string, string> = {}
  for (const [loc, p] of Object.entries(r.alternates)) {
    absAlternates[loc] = `${siteUrl}${p}`
  }
  // x-default targets the default-locale alternate when present.
  if (r.alternates[defaultLocale]) {
    absAlternates['x-default'] = `${siteUrl}${r.alternates[defaultLocale]}`
  }
  const entry: MetadataRoute.Sitemap[number] = {
    url: `${siteUrl}${r.path}`,
    lastModified: r.lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }
  if (Object.keys(absAlternates).length > 0) {
    entry.alternates = { languages: absAlternates }
  }
  return entry
}
