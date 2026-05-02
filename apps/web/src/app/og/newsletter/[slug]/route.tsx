import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { getNewsletterTypeBySlug } from '@/lib/newsletter/queries'
import { deriveCadenceLabel } from '@/lib/newsletter/format'
import { renderNewsletterOgImage, notFoundOgFallback } from '@/lib/seo/og/render'

export const runtime = 'nodejs'
export const revalidate = 3600

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED === 'false') {
    return notFoundOgFallback()
  }
  const { slug } = await ctx.params
  try {
    const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
    const site = await resolveSiteByHost(host)
    if (!site) return notFoundOgFallback()
    const config = await getSiteSeoConfig(site.id, host)
    const type = await getNewsletterTypeBySlug(slug)
    if (!type) return notFoundOgFallback()

    return await renderNewsletterOgImage({
      name: type.name,
      description: type.description,
      cadenceLabel: deriveCadenceLabel(type.cadence_label, type.cadence_days, type.locale as 'en' | 'pt-BR'),
      accentColor: type.color,
      author: config.personIdentity?.name ?? config.siteName,
      domain: 'bythiagofigueiredo.com',
    })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'og-route', type: 'newsletter', slug, seo: true },
    })
    return notFoundOgFallback()
  }
}
