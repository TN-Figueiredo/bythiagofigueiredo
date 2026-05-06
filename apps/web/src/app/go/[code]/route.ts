import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { resolveLink } from '@/lib/links/resolver'
import { recordClick, isBot } from '@/lib/links/click-recorder'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await params
  const siteId = request.headers.get('x-site-id') ?? ''

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

    // Extract visitor info
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      '0.0.0.0'
    const userAgent = request.headers.get('user-agent') ?? ''
    const referrer = request.headers.get('referer') ?? null

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
    }).catch((err) => {
      Sentry.captureException(err, { tags: { links: 'true', component: 'redirect' } })
    })

    const destination = new URL(link.destination_url)
    if (link.utm_source) destination.searchParams.set('utm_source', link.utm_source)
    if (link.utm_medium) destination.searchParams.set('utm_medium', link.utm_medium)
    if (link.utm_campaign) destination.searchParams.set('utm_campaign', link.utm_campaign)
    if (link.utm_term) destination.searchParams.set('utm_term', link.utm_term)
    if (link.utm_content) destination.searchParams.set('utm_content', link.utm_content)

    return NextResponse.redirect(destination.toString(), link.redirect_type)
  } catch (err) {
    Sentry.captureException(err, { tags: { links: 'true', component: 'redirect' } })
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
