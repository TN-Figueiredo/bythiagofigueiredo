'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { z } from 'zod'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { verifyTurnstileToken } from '../../../../lib/turnstile'
import { getEmailService } from '../../../../lib/email/service'
import { getEmailSender } from '../../../../lib/email/sender'
import { getSiteContext } from '../../../../lib/cms/site-context'
import { getClientIp, isValidInet } from '../../../../lib/request-ip'
import { confirmSubscriptionTemplate, ensureUnsubscribeToken } from '@tn-figueiredo/email'
import { NEWSLETTER_CONSENT_VERSION } from '../consent'

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

    await sendConfirmEmail({ supabase, siteId, email, rawToken, expiresAt, locale })
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
    ip: isValidInet(ip) ? ip : null,
  })

  if (error) {
    if (error.code === '23505') {
      // Race-condition duplicate — treat as ok (no oracle).
      return { status: 'ok' }
    }
    return { status: 'error', code: 'db_error' }
  }

  await sendConfirmEmail({ supabase, siteId, email, rawToken, expiresAt, locale })
  return { status: 'ok' }
}

async function sendConfirmEmail(opts: {
  supabase: ReturnType<typeof getSupabaseServiceClient>
  siteId: string
  email: string
  rawToken: string
  expiresAt: Date
  locale: NewsletterLocale
}) {
  const { supabase, siteId, email, rawToken, expiresAt, locale } = opts
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const confirmUrl = `${baseUrl}/newsletter/confirm/${rawToken}`
    const unsubscribeUrl = await ensureUnsubscribeToken(supabase, siteId, email, baseUrl)
    const sender = await getEmailSender(siteId)
    const emailService = getEmailService()
    await emailService.sendTemplate(
      confirmSubscriptionTemplate,
      { email: sender.email, name: sender.name },
      email,
      {
        confirmUrl,
        expiresAt,
        branding: {
          brandName: sender.brandName,
          primaryColor: sender.primaryColor,
          unsubscribeUrl,
        },
      },
      locale,
    )
  } catch {
    // Email delivery failure is non-fatal — subscription row already created
  }
}
