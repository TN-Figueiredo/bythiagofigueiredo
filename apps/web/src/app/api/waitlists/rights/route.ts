// apps/web/src/app/api/waitlists/rights/route.ts
// LGPD Art. 18 rights REQUEST: the data subject enters their email; if it is registered on
// any (non-anonymized) waitlist for this site, we email them a tokenized manage link (access
// + erasure). NO ORACLE: the response is identical (200 {ok:true}) whether or not the email
// is registered, whether Turnstile passes, and whether rate-limited — so this endpoint can't
// enumerate signups. Defense in depth: Turnstile + per-site rate-limit, both fail-NEUTRAL.
import { headers } from 'next/headers'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { verifyTurnstileToken } from '../../../../../lib/turnstile'
import { getLogger } from '../../../../../lib/logger'
import { redactMessage } from '../../../../../lib/waitlists/scrub'
import { generateWaitlistDsarToken } from '../../../../../lib/waitlists/dsar-token'
import { getEmailService } from '../../../../../lib/email/service'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const Body = z.object({
  email: z.string().email().max(320),
  locale: z.enum(['pt-BR', 'en']).optional(),
  turnstile_token: z.string().optional(),
})
// Identical neutral response for every outcome (no oracle).
const OK = () => Response.json({ ok: true }, { status: 200 })

export async function POST(req: Request): Promise<Response> {
  const isDev = process.env.VERCEL_ENV !== 'production' && process.env.VERCEL_ENV !== 'preview' && process.env.NODE_ENV === 'development'
  const hasTurnstileSecret = Boolean(process.env.TURNSTILE_SECRET_KEY)
  if (!hasTurnstileSecret && !isDev) return Response.json({ error: 'unavailable' }, { status: 503 })

  let parsed: ReturnType<typeof Body.safeParse>
  try {
    parsed = Body.safeParse(await req.json())
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 })
  const body = parsed.data

  const h = await headers()
  const siteId = h.get('x-site-id')
  if (!siteId || !UUID_RE.test(siteId)) return Response.json({ error: 'no_site' }, { status: 404 })
  const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    ?? (isDev ? (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null) : null)

  // Turnstile — fail NEUTRAL (OK, no email) so a bad/absent token reveals nothing and sends nothing.
  if (hasTurnstileSecret) {
    const ok = body.turnstile_token ? await verifyTurnstileToken(body.turnstile_token, ip ?? undefined) : false
    if (!ok) return OK()
  }

  const supabase = getSupabaseServiceClient()

  // Per-site rate-limit (reuse the signup limiter) — fail NEUTRAL: a rate-limited or
  // schema-drifted result sends no email and returns the same OK() (no oracle, no email-bomb).
  const rate = await supabase.rpc('waitlist_rate_check', { p_site_id: siteId, p_ip: ip, p_email: body.email })
  if (rate.error || z.boolean().safeParse(rate.data).data !== true) return OK()

  // Is this email registered on any non-anonymized waitlist for THIS site?
  const { data: hit, error: lookupErr } = await supabase
    .from('waitlist_signups')
    .select('id')
    .eq('site_id', siteId)
    .eq('email', body.email)
    .is('anonymized_at', null)
    .limit(1)
    .maybeSingle()
  if (lookupErr) {
    getLogger().error('[waitlist_rights_lookup]', { code: lookupErr.code })
    Sentry.captureException(new Error(`waitlist_rights_lookup ${lookupErr.code}: ${redactMessage(lookupErr.message ?? '')}`), { tags: { component: 'waitlist', action: 'rights_request', error_type: 'lookup' }, level: 'warning' })
    return OK() // fail neutral — never reveal lookup state
  }
  if (!hit) return OK() // no oracle: identical response when not registered

  // Registered → issue (deterministic) token, (re)arm it by refreshing created_at + clearing
  // used_at so a fresh request re-enables an expired/burned link (G: TTL-bounded access).
  const { raw, hash } = generateWaitlistDsarToken(siteId, body.email)
  const { error: tokErr } = await supabase
    .from('waitlist_dsar_tokens')
    .upsert({ token_hash: hash, site_id: siteId, email: body.email, used_at: null, created_at: new Date().toISOString() }, { onConflict: 'site_id,email' })
  if (tokErr) {
    getLogger().error('[waitlist_rights_token]', { code: tokErr.code })
    Sentry.captureException(new Error(`waitlist_rights_token ${tokErr.code}: ${redactMessage(tokErr.message ?? '')}`), { tags: { component: 'waitlist', action: 'rights_request', error_type: 'token_creation' }, level: 'warning' })
    return OK()
  }

  const isPt = (body.locale ?? 'pt-BR') === 'pt-BR'
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const link = `${base}/waitlists/manage/${raw}`
  const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
  const subject = isPt ? 'Seus dados na lista de espera' : 'Your waitlist data'
  const intro = isPt
    ? 'Você (ou alguém) pediu para acessar ou excluir os dados da lista de espera associados a este e-mail. Use o link abaixo para ver ou apagar seus dados. O link expira em 7 dias. Se não foi você, ignore este e-mail.'
    : 'You (or someone) requested access to or deletion of the waitlist data associated with this email. Use the link below to view or erase your data. The link expires in 7 days. If this wasn’t you, ignore this email.'
  const cta = isPt ? 'Gerenciar meus dados' : 'Manage my data'
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">`
    + `<p>${intro}</p>`
    + `<p style="margin:24px 0"><a href="${link}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">${cta}</a></p>`
    + `<p style="color:#666;font-size:13px;word-break:break-all">${link}</p>`
    + `</body></html>`
  const text = `${intro}\n\n${cta}: ${link}\n`

  try {
    await getEmailService().send({
      from: { name: 'Thiago Figueiredo', email: `no-reply@${domain}` },
      to: body.email,
      subject,
      html,
      text,
      metadata: { configurationSet: process.env.SES_TRANSACTIONAL_CONFIG_SET ?? process.env.SES_DEFAULT_CONFIG_SET },
    })
  } catch (err) {
    getLogger().error('[waitlist_rights_email]', {})
    Sentry.captureException(new Error(`waitlist_rights_email: ${redactMessage(String((err as Error)?.message ?? ''))}`), { tags: { component: 'waitlist', action: 'rights_request', error_type: 'email_send' }, level: 'warning' })
  }
  return OK()
}
