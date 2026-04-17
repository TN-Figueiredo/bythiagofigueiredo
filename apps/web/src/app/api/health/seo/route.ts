import type { NextRequest } from 'next/server'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { enumerateSiteRoutes } from '@/lib/seo/enumerator'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/health/seo — CRON_SECRET-protected health endpoint exposing the
 * SEO stack state for operational monitoring and smoke tests.
 *
 * Sprint 5b PR-E. See `docs/runbooks/seo-incident.md` for usage and
 * `docs/runbooks/sprint-5b-post-deploy.md` for the full verification flow.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response(null, { status: 401 })
  }

  const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
  const site = await resolveSiteByHost(host)
  if (!site) {
    return Response.json(
      { ok: false, error: 'site_not_resolved', host },
      { status: 503 },
    )
  }

  const configStart = Date.now()
  const config = await getSiteSeoConfig(site.id, host)
  const seoConfigCachedMs = Date.now() - configStart

  const sitemapStart = Date.now()
  const routes = await enumerateSiteRoutes(site.id, config)
  const sitemapBuildMs = Date.now() - sitemapStart

  return Response.json({
    ok: true,
    siteId: site.id,
    siteSlug: site.slug,
    identityType: config.identityType,
    seoConfigCachedMs,
    sitemapBuildMs,
    sitemapRouteCount: routes.length,
    schemaVersion: 'v1',
    flags: {
      jsonLd: process.env.NEXT_PUBLIC_SEO_JSONLD_ENABLED !== 'false',
      dynamicOg: process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED !== 'false',
      extendedSchemas: process.env.NEXT_PUBLIC_SEO_EXTENDED_SCHEMAS_ENABLED !== 'false',
      aiCrawlersBlocked: process.env.SEO_AI_CRAWLERS_BLOCKED === 'true',
      sitemapKilled: process.env.SEO_SITEMAP_KILLED === 'true',
    },
  })
}
