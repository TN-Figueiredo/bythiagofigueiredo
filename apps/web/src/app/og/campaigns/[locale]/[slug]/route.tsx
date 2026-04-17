import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { getCampaignBySlug } from '@/lib/cms/repositories'
import { renderCampaignOgImage, notFoundOgFallback } from '@/lib/seo/og/render'

/**
 * Sprint 5b PR-B Phase 3 — dynamic OG image for campaign landing pages.
 *
 * Uses `getCampaignBySlug` (B.19a) — the package's `SupabaseCampaignRepository`
 * does not expose slug-based lookup. Falls back to /og-default.png on any
 * error (kill-switch, unknown host, missing campaign, thrown exception).
 */
export const runtime = 'nodejs'
export const revalidate = 3600

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ locale: string; slug: string }> },
): Promise<Response> {
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED === 'false') {
    return notFoundOgFallback()
  }
  const { locale, slug } = await ctx.params
  try {
    const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
    const site = await resolveSiteByHost(host)
    if (!site) return notFoundOgFallback()
    const config = await getSiteSeoConfig(site.id, host)
    const campaign = await getCampaignBySlug({ siteId: site.id, locale, slug })
    if (!campaign) return notFoundOgFallback()
    return await renderCampaignOgImage({
      title: campaign.translation.meta_title ?? 'Campaign',
      author: config.personIdentity?.name ?? config.siteName,
      locale,
      brandColor: config.primaryColor,
      logoUrl: config.logoUrl,
    })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'og-route', type: 'campaign', slug, locale },
    })
    return notFoundOgFallback()
  }
}
