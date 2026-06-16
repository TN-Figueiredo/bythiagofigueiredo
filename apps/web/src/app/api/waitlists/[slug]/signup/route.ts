import { headers } from 'next/headers'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { verifyTurnstileToken } from '../../../../../../lib/turnstile'
import { getLogger } from '../../../../../../lib/logger'
import { redactMessage } from '../../../../../../lib/waitlists/scrub'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { WAITLIST_CONSENT_VERSION } from '../../consent'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const Body = z.object({
  locale: z.string().min(2).max(10),
  email: z.string().email().max(320),
  consent_launch_notification: z.literal(true),
  turnstile_token: z.string().min(1),
})
interface Ctx { params: Promise<{ slug: string }> }

export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  const { slug } = await ctx.params
  const isDev = process.env.VERCEL_ENV !== 'production' && process.env.VERCEL_ENV !== 'preview' && process.env.NODE_ENV === 'development'
  const hasTurnstileSecret = Boolean(process.env.TURNSTILE_SECRET_KEY)
  if (!hasTurnstileSecret && !isDev) return Response.json({ error: 'unavailable' }, { status: 503 })

  let body: z.infer<typeof Body>
  try { body = Body.parse(await req.json()) } catch { return Response.json({ error: 'invalid_body' }, { status: 400 }) }

  const h = await headers()
  const siteId = h.get('x-site-id')
  if (!siteId || !UUID_RE.test(siteId)) return Response.json({ error: 'no_site' }, { status: 404 })
  const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    ?? (isDev ? (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null) : null)
  const ua = req.headers.get('user-agent') ?? null

  const supabase = getSupabaseServiceClient()
  const rate = await supabase.rpc('waitlist_rate_check', { p_site_id: siteId, p_ip: ip, p_email: body.email })
  if (rate.error) { getLogger().error('[waitlist_rate_check]', { code: rate.error.code }); return Response.json({ error: 'unavailable' }, { status: 503 }) }
  if (rate.data === false) return Response.json({ error: 'rate_limited' }, { status: 429 })

  if (hasTurnstileSecret) {
    const ok = await verifyTurnstileToken(body.turnstile_token, ip ?? undefined)
    if (!ok) return Response.json({ error: 'turnstile_failed' }, { status: 400 })
  }

  const [{ data: wlRow }, { data: ct }] = await Promise.all([
    supabase.from('waitlists').select('name').eq('site_id', siteId).eq('slug', slug).maybeSingle(),
    supabase.from('consent_texts').select('text_md')
      .eq('category', 'launch_notification').eq('locale', body.locale)
      .eq('version', WAITLIST_CONSENT_VERSION).maybeSingle(),
  ])
  if (!wlRow) return Response.json({ error: 'not_found' }, { status: 404 })
  if (!ct) return Response.json({ error: 'unavailable' }, { status: 503 })
  const snapshot = ct.text_md.replaceAll('{name}', wlRow.name)
  const res = await supabase.rpc('waitlist_signup', {
    p_site_id: siteId, p_slug: slug, p_email: body.email, p_locale: body.locale,
    p_consent_version: WAITLIST_CONSENT_VERSION, p_consent_text_snapshot: snapshot,
    p_source_surface: 'landing', p_ip: ip, p_user_agent: ua, // TODO Fase 3: source_surface from body for embed/tiptap
  })
  if (res.error) {
    getLogger().error('[waitlist_signup]', { code: res.error.code })
    Sentry.captureException(new Error(`waitlist_signup ${res.error.code}: ${redactMessage(res.error.message ?? '')}`), { tags: { component: 'waitlist' } })
    return Response.json({ error: 'insert_failed' }, { status: 500 })
  }
  const out = res.data as { error?: string; status?: string; duplicate?: boolean }
  if (out.error === 'not_found') return Response.json({ error: 'not_found' }, { status: 404 })
  if (out.error === 'waitlist_not_open') return Response.json({ error: 'waitlist_not_open', status: out.status }, { status: 409 })
  return Response.json({ success: true, duplicate: out.duplicate === true })
}
