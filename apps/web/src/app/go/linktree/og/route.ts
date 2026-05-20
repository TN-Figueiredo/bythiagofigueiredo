import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { renderLinktreeOgImage, notFoundOgFallback } from '@/lib/seo/og/render'
import { getLinktreeConfig } from '../_lib/queries'

export const runtime = 'nodejs'
export const revalidate = 3600

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
    const siteId = req.headers.get('x-site-id')
    const resolveHost = host.startsWith('go.') ? host.slice(3) : host
    const site = siteId ? { id: siteId } : await resolveSiteByHost(resolveHost)
    if (!site) return notFoundOgFallback()

    const [seoConfig, ltConfig] = await Promise.all([
      getSiteSeoConfig(site.id, host),
      getLinktreeConfig(site.id),
    ])
    const personName = seoConfig.personIdentity?.name ?? seoConfig.siteName
    const locale = req.nextUrl.searchParams.get('locale')
      ?? req.headers.get('x-locale')
      ?? 'pt-BR'
    const tagline = (locale.startsWith('pt') ? ltConfig.tagline_pt : ltConfig.tagline_en)
      || 'Links · Blog · YouTube · Newsletter'

    return await renderLinktreeOgImage({
      name: personName,
      tagline,
      domain: `go.${seoConfig.siteUrl.replace('https://', '')}`,
      brandColor: seoConfig.primaryColor,
      avatarUrl: seoConfig.personIdentity?.imageUrl ?? null,
    })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'og-route', type: 'linktree' },
    })
    return notFoundOgFallback()
  }
}
