import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { isPreviewOrDevHost, resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { buildRobotsRules } from '@/lib/seo/robots-config'
import { PROTECTED_DISALLOW_PATHS } from '@/lib/seo/noindex'

/**
 * Sprint 5b PR-B Phase 3 — multi-domain dynamic robots.txt.
 *
 * - Preview/dev hosts → `Disallow: /` (single rule).
 * - Prod hosts → `Allow: /` + `Disallow: <PROTECTED_DISALLOW_PATHS>` plus
 *   per-AI-crawler disallow rules when `SEO_AI_CRAWLERS_BLOCKED=true`.
 * - Sitemap URL points at `${siteUrl}/sitemap.xml` when site config resolves;
 *   falls back to `https://${host}/sitemap.xml` for unresolved hosts so a
 *   misconfigured prod still advertises a sitemap path crawlers can probe.
 *
 * Resolves host via `next/headers` directly (NOT middleware-injected
 * `x-site-id` — those headers are stripped from MetadataRoute invocations
 * per Next #58436).
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers()
  const host = (h.get('host') ?? '').split(':')[0] ?? ''
  if (isPreviewOrDevHost(host)) {
    return { rules: [{ userAgent: '*', disallow: '/' }] }
  }
  const site = await resolveSiteByHost(host)
  const config = site ? await getSiteSeoConfig(site.id, host) : null
  const aiCrawlersBlocked = process.env.SEO_AI_CRAWLERS_BLOCKED === 'true'
  const rules = buildRobotsRules({
    config,
    host,
    aiCrawlersBlocked,
    protectedPaths: PROTECTED_DISALLOW_PATHS,
  })
  return {
    // `Rule` from robots-config matches the shape MetadataRoute.Robots.rules
    // accepts. The cast here is just to reconcile the looser local interface
    // with the stricter Next union.
    rules: rules as MetadataRoute.Robots['rules'],
    sitemap: config ? `${config.siteUrl}/sitemap.xml` : `https://${host}/sitemap.xml`,
  }
}
