import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { resolveLink } from '@/lib/links/resolver'
import { recordClick } from '@/lib/links/click-recorder'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { safePassthrough, extractClickIds } from '@tn-figueiredo/links'

export const runtime = 'nodejs'

/**
 * Resolve site_id from the Host header instead of trusting x-site-id.
 * This prevents cross-origin link harvesting via spoofed headers.
 */
async function resolveSiteFromHost(host: string): Promise<string | null> {
  const hostname = host.split(':')[0] ?? ''
  // go.* subdomain → strip prefix to get base domain
  const domain = hostname.startsWith('go.') ? hostname.slice(3) : hostname
  // Dev override: resolve localhost using the configured dev hostname
  const resolvedDomain =
    (domain === 'localhost' || domain === '127.0.0.1') &&
    process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME
      ? process.env.NEXT_PUBLIC_DEV_SITE_HOSTNAME
      : domain

  const supabase = getSupabaseServiceClient()
  const { data } = await supabase
    .from('sites')
    .select('id')
    .contains('domains', [resolvedDomain])
    .maybeSingle()

  return data?.id ?? null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await params
  const host = request.headers.get('host') ?? ''
  const siteId = await resolveSiteFromHost(host)

  if (!siteId) {
    return NextResponse.json({ error: 'site_not_resolved' }, { status: 400 })
  }

  try {
    const link = await resolveLink(siteId, code)

    if (!link) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    if (!link.active || link.deleted_at) {
      return new Response('Gone — this link has expired.', { status: 410 })
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response('Gone — this link has expired.', { status: 410 })
    }

    if (link.click_limit && link.total_clicks >= link.click_limit) {
      return new Response('Gone — this link has reached its click limit.', { status: 410 })
    }

    if (link.password_hash != null) {
      return NextResponse.redirect(new URL(`/go/${code}/unlock`, request.url), 302)
    }

    if (link.activates_at && new Date(link.activates_at) > new Date()) {
      const comingSoonUrl = new URL('/go/coming-soon', request.url)
      comingSoonUrl.searchParams.set('title', link.title ?? link.code)
      if (link.activates_at) {
        comingSoonUrl.searchParams.set('activates', link.activates_at)
      }
      return NextResponse.rewrite(comingSoonUrl)
    }

    // Extract visitor info
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      '0.0.0.0'
    const userAgent = request.headers.get('user-agent') ?? ''
    const referrer = request.headers.get('referer') ?? null

    // ── Build destination URL ──────────────────────────────────────────
    let destination = new URL(link.destination_url)

    // UTM params from tracked_links
    const utmMapping = [
      ['utm_source', link.utm_source],
      ['utm_medium', link.utm_medium],
      ['utm_campaign', link.utm_campaign],
      ['utm_term', link.utm_term],
      ['utm_content', link.utm_content],
      ['utm_id', link.utm_id],
    ] as const
    for (const [param, value] of utmMapping) {
      if (value && !destination.searchParams.has(param)) {
        destination.searchParams.set(param, value)
      }
    }

    // Click ID passthrough (gclid, fbclid, etc.)
    const incomingUrl = new URL(request.url)
    let clickIds: Record<string, string> | null = null
    if (link.pass_click_ids) {
      const passResult = safePassthrough(incomingUrl, destination)
      if (passResult.forwarded.length > 0) {
        destination = passResult.url
        clickIds = extractClickIds(incomingUrl)
        Sentry.addBreadcrumb({
          category: 'links.passthrough',
          message: `Forwarded click IDs: ${passResult.forwarded.join(', ')}`,
          level: 'info',
        })
      }
      if (passResult.rejected.length > 0) {
        Sentry.addBreadcrumb({
          category: 'links.passthrough',
          message: `Rejected click IDs: ${passResult.rejected.join(', ')}`,
          level: 'warning',
        })
      }
    }

    // Custom params (jsonb key-value pairs from tracked_links)
    if (link.custom_params && typeof link.custom_params === 'object') {
      const entries = Object.entries(link.custom_params)
      let applied = 0
      for (const [key, value] of entries) {
        if (applied >= 20) break
        if (!value || typeof value !== 'string') continue
        if (key.toLowerCase().startsWith('utm_')) continue
        if (value.length > 500) continue
        if (!destination.searchParams.has(key)) {
          destination.searchParams.set(key, value)
          applied++
        }
      }
    }

    // Fire-and-forget click recording (non-blocking)
    void recordClick({
      linkId: link.id,
      siteId,
      ip,
      userAgent,
      referrer,
      headers: new Headers(
        Object.fromEntries(
          [...new Headers(request.headers).entries()].filter(
            ([k]) => k.startsWith('cf-') || k === 'x-forwarded-for',
          ),
        ),
      ),
      utmSource: link.utm_source,
      utmMedium: link.utm_medium,
      utmCampaign: link.utm_campaign,
      utmTerm: link.utm_term,
      utmContent: link.utm_content,
      utmId: link.utm_id,
      adClickIds: clickIds,
    }).catch((err) => {
      Sentry.captureException(err, { tags: { links: 'true', component: 'redirect' } })
    })

    const response = NextResponse.redirect(destination.toString(), link.redirect_type)
    if (link.redirect_type === 301 && clickIds) {
      response.headers.set('Cache-Control', 'private, no-store')
    }
    return response
  } catch (err) {
    Sentry.captureException(err, { tags: { links: 'true', component: 'redirect' } })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
