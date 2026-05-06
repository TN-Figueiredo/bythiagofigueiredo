import { NextResponse } from 'next/server'
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

  const link = await resolveLink(siteId, code)

  if (!link) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Expired link
  if (link.status === 'expired' || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return new Response('Gone — this link has expired.', { status: 410 })
  }

  // Click limit reached
  if (link.max_clicks && link.total_clicks >= link.max_clicks) {
    return new Response('Gone — this link has reached its click limit.', { status: 410 })
  }

  // Password protected — redirect to interstitial
  if (link.is_password_protected) {
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
  }).catch(() => {
    // Best-effort — never block the redirect
  })

  // Redirect
  const status = link.redirect_type === 302 ? 302 : 301
  return NextResponse.redirect(link.destination_url, status)
}
