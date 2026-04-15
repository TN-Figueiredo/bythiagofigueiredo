'use server'

import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { verifyTurnstileToken } from '../../../../lib/turnstile'
import { getEmailService } from '../../../../lib/email/service'
import { getEmailSender } from '../../../../lib/email/sender'
import { getSiteContext } from '../../../../lib/cms/site-context'
import { confirmSubscriptionTemplate, ensureUnsubscribeToken } from '@tn-figueiredo/email'

export const NEWSLETTER_CONSENT_VERSION = 'newsletter-v1-2026-04'
const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000 // 24h

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type SubscribeResult =
  | { status: 'ok' }
  | { status: 'duplicate' }
  | { status: 'error'; code: string }

export async function subscribeToNewsletter(formData: FormData): Promise<SubscribeResult> {
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const consentProcessing = formData.get('consent_processing') === 'on'
  const consentMarketing = formData.get('consent_marketing') === 'on'
  const turnstileToken = formData.get('turnstile_token') as string | null

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', code: 'invalid_email' }
  }
  if (!consentProcessing || !consentMarketing) {
    return { status: 'error', code: 'consent_required' }
  }

  // Verify Turnstile (skip in test env when key absent)
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && turnstileToken) {
    const ok = await verifyTurnstileToken(turnstileToken)
    if (!ok) return { status: 'error', code: 'turnstile_failed' }
  }

  const { siteId } = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  // Check for existing subscription
  const { data: existing } = await supabase
    .from('newsletter_subscriptions')
    .select('id, status')
    .eq('site_id', siteId)
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'confirmed') {
      return { status: 'duplicate' }
    }
    // pending_confirmation or unsubscribed — resubscribe: update token + expires
    const token = generateToken()
    const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS)
    await supabase
      .from('newsletter_subscriptions')
      .update({
        status: 'pending_confirmation',
        confirmation_token: token,
        confirmation_expires_at: expiresAt.toISOString(),
        consent_text_version: NEWSLETTER_CONSENT_VERSION,
        unsubscribed_at: null,
      })
      .eq('id', existing.id)

    await sendConfirmEmail({ supabase, siteId, email, token, expiresAt })
    return { status: 'ok' }
  }

  // New subscription
  const token = generateToken()
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS)

  const { error } = await supabase.from('newsletter_subscriptions').insert({
    site_id: siteId,
    email,
    status: 'pending_confirmation',
    confirmation_token: token,
    confirmation_expires_at: expiresAt.toISOString(),
    consent_text_version: NEWSLETTER_CONSENT_VERSION,
  })

  if (error) {
    if (error.code === '23505') {
      // Race-condition duplicate — treat as ok
      return { status: 'duplicate' }
    }
    return { status: 'error', code: 'db_error' }
  }

  await sendConfirmEmail({ supabase, siteId, email, token, expiresAt })
  return { status: 'ok' }
}

async function sendConfirmEmail(opts: {
  supabase: ReturnType<typeof getSupabaseServiceClient>
  siteId: string
  email: string
  token: string
  expiresAt: Date
}) {
  const { supabase, siteId, email, token, expiresAt } = opts
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const confirmUrl = `${baseUrl}/newsletter/confirm/${token}`
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
      'pt-BR',
    )
  } catch {
    // Email delivery failure is non-fatal — subscription row already created
  }
}
