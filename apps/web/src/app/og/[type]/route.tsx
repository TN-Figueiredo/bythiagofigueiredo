import type { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { resolveSiteByHost } from '@/lib/seo/host'
import { getSiteSeoConfig } from '@/lib/seo/config'
import { renderGenericOgImage, notFoundOgFallback } from '@/lib/seo/og/render'

/**
 * Sprint 5b PR-B Phase 3 — generic OG image for static-ish routes (root,
 * legal, contact, blog/campaigns indexes). `?title=` query param is allowed
 * to override the default title and is sanitized (control-char strip + 120
 * char truncate) before reaching the renderer.
 */
export const runtime = 'nodejs'
export const revalidate = 3600

const ALLOWED_TYPES = new Set([
  'root',
  'legal',
  'contact',
  'blog-index',
  'campaigns-index',
])

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
): Promise<Response> {
  if (process.env.NEXT_PUBLIC_SEO_DYNAMIC_OG_ENABLED === 'false') {
    return notFoundOgFallback()
  }
  const { type } = await ctx.params
  if (!ALLOWED_TYPES.has(type)) return notFoundOgFallback()
  try {
    const host = (req.headers.get('host') ?? '').split(':')[0] ?? ''
    const site = await resolveSiteByHost(host)
    if (!site) return notFoundOgFallback()
    const config = await getSiteSeoConfig(site.id, host)
    const overrideTitle = new URL(req.url).searchParams.get('title')
    const title = sanitizeTitle(overrideTitle ?? defaultTitle(type, config))
    return await renderGenericOgImage({
      title,
      siteName: config.siteName,
      brandColor: config.primaryColor,
    })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'og-route', type: 'generic', variant: type },
    })
    return notFoundOgFallback()
  }
}

// Strip C0/C1 control chars + DEL, then truncate. The regex is intentional —
// linter will complain about control chars in the class so disable inline.
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/g

function sanitizeTitle(raw: string): string {
  return raw.replace(CONTROL_CHAR_RE, '').slice(0, 120)
}

function defaultTitle(type: string, config: { siteName: string }): string {
  switch (type) {
    case 'root':
      return config.siteName
    case 'legal':
      return 'Legal'
    case 'contact':
      return 'Fale comigo'
    case 'blog-index':
      return 'Blog'
    case 'campaigns-index':
      return 'Campanhas'
    default:
      return config.siteName
  }
}
