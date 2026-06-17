import { headers } from 'next/headers'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { verifyTurnstileToken } from '../../../../../../lib/turnstile'
import { getLogger } from '../../../../../../lib/logger'
import { redactMessage } from '../../../../../../lib/waitlists/scrub'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { WAITLIST_CONSENT_VERSION } from '../../consent'
import { FORM_STRINGS, type WaitlistLocale } from '@/components/waitlists/form-strings'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// WL-R8: whitelist locales to the supported set (source of truth: FORM_STRINGS) so an
// attacker can't probe consent_texts with an arbitrary `locale` string. Unknown locale
// fails the Body.parse below → existing invalid_body 400.
const WAITLIST_LOCALES = Object.keys(FORM_STRINGS) as [WaitlistLocale, ...WaitlistLocale[]]
const Body = z.object({
  locale: z.enum(WAITLIST_LOCALES),
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

  // safeParse + a warning breadcrumb so malformed JSON / unknown-locale (WL-R8) / false
  // consent rejections are visible (client bugs or probing) instead of a silent 400.
  // No raw body is logged (PII) — just the slug + the zod issue codes.
  let parsedBody: ReturnType<typeof Body.safeParse>
  try {
    parsedBody = Body.safeParse(await req.json())
  } catch {
    getLogger().warn('[waitlist_signup_body] non-JSON body', { slug })
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!parsedBody.success) {
    getLogger().warn('[waitlist_signup_body] schema rejected', { slug, issues: parsedBody.error.issues.map((i) => i.code) })
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }
  const body = parsedBody.data

  const h = await headers()
  const siteId = h.get('x-site-id')
  if (!siteId || !UUID_RE.test(siteId)) return Response.json({ error: 'no_site' }, { status: 404 })
  const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    ?? (isDev ? (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null) : null)
  const ua = req.headers.get('user-agent') ?? null

  const supabase = getSupabaseServiceClient()
  const rate = await supabase.rpc('waitlist_rate_check', { p_site_id: siteId, p_ip: ip, p_email: body.email })
  if (rate.error) {
    getLogger().error('[waitlist_rate_check]', { code: rate.error.code })
    Sentry.captureException(new Error(`waitlist_rate_check ${rate.error.code}: ${redactMessage(rate.error.message ?? '')}`), { tags: { component: 'waitlist', rpc: 'rate_check' }, level: 'warning' })
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
  // Validate the rate-check result shape: a non-boolean (schema drift) must FAIL CLOSED
  // to 503, never skip the `=== false` gate and let the signup through (fail-open).
  const rateOk = z.boolean().safeParse(rate.data)
  if (!rateOk.success) {
    getLogger().error('[waitlist_rate_check] non-boolean result', {})
    Sentry.captureException(new Error('waitlist_rate_check: unexpected result shape'), {
      tags: { component: 'waitlist', rpc: 'rate_check' },
    })
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
  if (rateOk.data === false) return Response.json({ error: 'rate_limited' }, { status: 429 })

  if (hasTurnstileSecret) {
    const ok = await verifyTurnstileToken(body.turnstile_token, ip ?? undefined)
    if (!ok) {
      getLogger().warn('[waitlist_turnstile_failed]', { slug })
      return Response.json({ error: 'turnstile_failed' }, { status: 400 })
    }
  }

  const [{ data: wlRow }, { data: ct }] = await Promise.all([
    supabase.from('waitlists').select('name').eq('site_id', siteId).eq('slug', slug).maybeSingle(),
    supabase.from('consent_texts').select('text_md')
      .eq('category', 'launch_notification').eq('locale', body.locale)
      .eq('version', WAITLIST_CONSENT_VERSION).maybeSingle(),
  ])
  if (!wlRow) return Response.json({ error: 'not_found' }, { status: 404 })
  if (!ct) {
    getLogger().error('[waitlist_consent_lookup]', { locale: body.locale, version: WAITLIST_CONSENT_VERSION })
    Sentry.captureException(new Error(`waitlist_consent_lookup missing consent_texts: ${redactMessage(`locale=${body.locale} version=${WAITLIST_CONSENT_VERSION}`)}`), { tags: { component: 'waitlist', rpc: 'consent_lookup' }, level: 'warning' })
    return Response.json({ error: 'unavailable' }, { status: 503 })
  }
  // WL-13 follow-up: parity test (FORM_STRINGS[locale].consentLabel ↔ consent_texts.text_md) + DB-gated audit snapshot assertion live in apps/web/test/* — not in this route file.
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
  // Validate the RPC result shape (project rule: zod for boundary data). A silent
  // schema drift would otherwise mis-route the 404/409/success branches; fail to 500.
  const parsed = z
    .object({ error: z.string().optional(), status: z.string().optional(), duplicate: z.boolean().optional() })
    .safeParse(res.data)
  if (!parsed.success) {
    getLogger().error('[waitlist_signup] unexpected RPC result shape', {})
    Sentry.captureException(new Error('waitlist_signup: unexpected RPC result shape'), { tags: { component: 'waitlist' } })
    return Response.json({ error: 'insert_failed' }, { status: 500 })
  }
  const out = parsed.data
  if (out.error === 'not_found') return Response.json({ error: 'not_found' }, { status: 404 })
  if (out.error === 'waitlist_not_open') return Response.json({ error: 'waitlist_not_open', status: out.status }, { status: 409 })
  // Count-only conversion funnel breadcrumb (Task 21) — source_surface + duplicate flag
  // only, NEVER email/ip (those are scrubbed everywhere else too).
  Sentry.addBreadcrumb({
    category: 'waitlist',
    message: 'signup',
    level: 'info',
    data: { source_surface: 'landing', duplicate: out.duplicate === true },
  })
  return Response.json({ success: true, duplicate: out.duplicate === true })
}
