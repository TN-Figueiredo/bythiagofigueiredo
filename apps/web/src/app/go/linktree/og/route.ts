import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { renderLinktreeOgImage, notFoundOgFallback } from '@/lib/seo/og/render'

export const runtime = 'nodejs'
export const revalidate = 3600

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
    const site = await resolveSiteByHost(host)
    if (!site) return notFoundOgFallback()

    const config = await getSiteSeoConfig(site.id, host)
    const personName = config.personIdentity?.name ?? config.siteName

    return await renderLinktreeOgImage({
      name: personName,
      tagline: 'Links · Blog · YouTube · Newsletter',
      domain: `go.${config.siteUrl.replace('https://', '')}`,
      brandColor: config.primaryColor,
      avatarUrl: config.personIdentity?.imageUrl ?? null,
    })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'og-route', type: 'linktree' },
    })
    return notFoundOgFallback()
  }
}
