'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { z } from 'zod'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { verifyTurnstileToken } from '../../../../lib/turnstile'
import { getEmailService } from '../../../../lib/email/service'
import { getSiteContext } from '../../../../lib/cms/site-context'
import { getClientIp, isValidInet } from '../../../../lib/request-ip'
import { NEWSLETTER_CONSENT_VERSION } from '../consent'
import { captureServerActionError } from '../../../lib/sentry-wrap'

// Supported locales for newsletter emails. Falls back to pt-BR on anything else.
const LocaleSchema = z.enum(['pt-BR', 'en'])
type NewsletterLocale = z.infer<typeof LocaleSchema>

const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000 // 24h

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function buildConfirmationHtml(confirmUrl: string, locale: string): string {
  const isPt = locale === 'pt-BR'
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${isPt ? 'Confirme sua inscrição' : 'Confirm your subscription'}</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:40px auto;color:#161208;background:#FBF6E8;padding:32px;border-radius:8px;">
  <h1 style="font-size:24px;margin-bottom:16px;">${isPt ? 'Quase lá!' : 'Almost there!'}</h1>
  <p style="font-size:16px;line-height:1.6;margin-bottom:24px;">
    ${isPt
      ? 'Clique no botão abaixo para confirmar sua inscrição na newsletter.'
      : 'Click the button below to confirm your newsletter subscription.'}
  </p>
  <a href="${confirmUrl}" style="display:inline-block;background:#C14513;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
    ${isPt ? 'Confirmar inscrição' : 'Confirm subscription'}
  </a>
  <p style="font-size:12px;color:#6A5F48;margin-top:32px;">
    ${isPt
      ? 'Se você não se inscreveu, ignore este email.'
      : "If you didn't subscribe, ignore this email."}
  </p>
</body>
</html>
  `.trim()
}

export type SubscribeResult =
  | { status: 'ok' }
  | { status: 'error'; code: string }

export async function subscribeToNewsletter(formData: FormData): Promise<SubscribeResult> {
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const consentProcessing = formData.get('consent_processing') === 'on'
  const consentMarketing = formData.get('consent_marketing') === 'on'
  const turnstileToken = formData.get('turnstile_token') as string | null

  // Locale: validated via Zod enum — any unknown value falls back to pt-BR.
  const localeParse = LocaleSchema.safeParse(formData.get('locale'))
  const locale: NewsletterLocale = localeParse.success ? localeParse.data : 'pt-BR'

  const newsletter_id = (formData.get('newsletter_id') as string | null) ?? 'main-pt'

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', code: 'invalid_email' }
  }
  if (!consentProcessing || !consentMarketing) {
    return { status: 'error', code: 'consent_required' }
  }

  // Turnstile: if a site key is configured the token MUST be present and valid.
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    if (!turnstileToken) {
      return { status: 'error', code: 'captcha_required' }
    }
    const ok = await verifyTurnstileToken(turnstileToken)
    if (!ok) return { status: 'error', code: 'turnstile_failed' }
  }

  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  // Per-IP+site rate limit (best-effort — don't oracle on DB errors).
  // Always call the RPC — even with null IP, it still enforces the per-email limit.
  const h = await headers()
  const ip = getClientIp(h)
  const { data: rateOk } = await supabase.rpc('newsletter_rate_check', {
    p_site_id: siteId,
    p_ip: ip,
    p_email: email,
  })
  if (rateOk === false) {
    // Neutral response — don't reveal state to callers. Still returns ok to
    // avoid giving enumeration oracles.
    return { status: 'ok' }
  }

  // Check for existing subscription. Match both the raw email AND its sha256
  // hash — the unsubscribe flow anonymizes the row by replacing `email` with
  // the hex digest (see migration 20260418000001). Without the hash branch,
  // a re-subscribe after anonymization would silently create a duplicate row.
  const emailHash = createHash('sha256').update(email).digest('hex')
  const { data: existing } = await supabase
    .from('newsletter_subscriptions')
    .select('id, status, email')
    .eq('site_id', siteId)
    .or(`email.eq.${email},email.eq.${emailHash}`)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'confirmed') {
      // Do not reveal confirmed state. Return ok without re-sending email.
      return { status: 'ok' }
    }
    // pending_confirmation or unsubscribed — rotate token + resend confirm email.
    // When the existing row is an anonymized unsubscribe (email stored as hash),
    // we also restore the raw email so the confirm/unsubscribe flow works
    // again. The user is explicitly opting back in via double-opt-in.
    const rawToken = generateToken()
    const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS)
    await supabase
      .from('newsletter_subscriptions')
      .update({
        status: 'pending_confirmation',
        email,
        confirmation_token_hash: hashToken(rawToken),
        confirmation_expires_at: expiresAt.toISOString(),
        consent_text_version: NEWSLETTER_CONSENT_VERSION,
        locale,
        unsubscribed_at: null,
      })
      .eq('id', existing.id)

    await sendConfirmEmail({ email, rawToken, locale })
    return { status: 'ok' }
  }

  // New subscription
  const rawToken = generateToken()
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS)

  const { error } = await supabase.from('newsletter_subscriptions').insert({
    site_id: siteId,
    email,
    status: 'pending_confirmation',
    confirmation_token_hash: hashToken(rawToken),
    confirmation_expires_at: expiresAt.toISOString(),
    consent_text_version: NEWSLETTER_CONSENT_VERSION,
    locale,
    newsletter_id,
    ip: isValidInet(ip) ? ip : null,
  })

  if (error) {
    if (error.code === '23505') {
      // Race-condition duplicate — treat as ok (no oracle).
      return { status: 'ok' }
    }
    captureServerActionError(error, {
      action: 'newsletter_subscribe',
      site_id: siteId,
      branch: 'insert',
      pg_code: error.code,
    })
    return { status: 'error', code: 'db_error' }
  }

  await sendConfirmEmail({ email, rawToken, locale })
  return { status: 'ok' }
}

async function sendConfirmEmail({
  email, rawToken, locale,
}: { email: string; rawToken: string; locale: string }) {
  const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/newsletter/confirm?token=${rawToken}`
  try {
    const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
    await getEmailService().send({
      from: { name: 'Thiago Figueiredo', email: `no-reply@${domain}` },
      to: email,
      subject: locale === 'pt-BR' ? 'Confirme sua inscrição' : 'Confirm your subscription',
      html: buildConfirmationHtml(confirmUrl, locale),
    })
  } catch {
    // Email delivery failure is non-fatal — subscription row already created
  }
}
