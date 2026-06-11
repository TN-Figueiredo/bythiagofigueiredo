'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { z } from 'zod'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { verifyTurnstileToken } from '../../../../lib/turnstile'
import { getSiteContext } from '../../../../lib/cms/site-context'
import { getClientIp, isValidInet } from '../../../../lib/request-ip'
import { NEWSLETTER_CONSENT_VERSION } from '../consent'
import { captureServerActionError } from '../../../lib/sentry-wrap'
import { generateConfirmToken, hashConfirmToken, sendNewsletterConfirmEmail } from '../../../../lib/newsletter/confirm-email'
import { readNewsletterAttribution } from '../../../../lib/newsletter/attribution'

const LocaleSchema = z.enum(['pt-BR', 'en'])
type NewsletterLocale = z.infer<typeof LocaleSchema>

const CONFIRMATION_TTL_MS = 24 * 60 * 60 * 1000

type SupabaseClient = ReturnType<typeof getSupabaseServiceClient>

async function fetchNewsletterMeta(
  db: SupabaseClient,
  newsletterId: string,
): Promise<{ names: string[]; replyTo?: string }> {
  try {
    const { data } = await db
      .from('newsletter_types')
      .select('name, reply_to')
      .eq('id', newsletterId)
      .maybeSingle()
    return {
      names: data?.name ? [data.name as string] : [],
      // Same reply_to editions use — set on the type → confirm carries it.
      ...(data?.reply_to ? { replyTo: data.reply_to as string } : {}),
    }
  } catch {
    return { names: [] }
  }
}

export type SubscribeResult =
  | { status: 'ok' }
  | { status: 'error'; code: string }

export async function subscribeToNewsletter(formData: FormData): Promise<SubscribeResult> {
  const email = (formData.get('email') as string | null)?.trim().toLowerCase()
  const consentProcessing = formData.get('consent_processing') === 'on'
  const consentMarketing = formData.get('consent_marketing') === 'on'
  const turnstileToken = formData.get('turnstile_token') as string | null

  const localeParse = LocaleSchema.safeParse(formData.get('locale'))
  const locale: NewsletterLocale = localeParse.success ? localeParse.data : 'pt-BR'
  const newsletter_id = (formData.get('newsletter_id') as string | null) ?? 'main-pt'

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 'error', code: 'invalid_email' }
  }
  if (!consentProcessing || !consentMarketing) {
    return { status: 'error', code: 'consent_required' }
  }

  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    if (!turnstileToken) return { status: 'error', code: 'captcha_required' }
    const ok = await verifyTurnstileToken(turnstileToken)
    if (!ok) return { status: 'error', code: 'turnstile_failed' }
  }

  try {
    const { siteId } = await getSiteContext()
    const supabase = getSupabaseServiceClient()
    const h = await headers()
    const ip = getClientIp(h)
    const userAgent = h.get('user-agent') || null
    const attribution = readNewsletterAttribution(formData, h as Headers)

    const { data: rateOk, error: rateErr } = await supabase.rpc('newsletter_rate_check', {
      p_site_id: siteId,
      p_ip: ip ?? '',
      p_email: email,
    })
    if (rateErr || rateOk === false) {
      if (rateErr) captureServerActionError(rateErr, { action: 'newsletter_subscribe', branch: 'rate_check' })
      return { status: 'ok' }
    }

    const emailHash = createHash('sha256').update(email).digest('hex')
    const { data: existingByEmail } = await supabase
      .from('newsletter_subscriptions')
      .select('id, status, email')
      .eq('site_id', siteId)
      .eq('newsletter_id', newsletter_id)
      .eq('email', email)
      .maybeSingle()
    let existing = existingByEmail
    if (!existing) {
      const { data: existingByHash } = await supabase
        .from('newsletter_subscriptions')
        .select('id, status, email')
        .eq('site_id', siteId)
        .eq('newsletter_id', newsletter_id)
        .eq('email', emailHash)
        .maybeSingle()
      existing = existingByHash
    }

    if (existing) {
      if (existing.status === 'confirmed') {
        return { status: 'ok' }
      }
      // Block bounced/complained subscribers silently (no oracle)
      if (existing.status === 'bounced' || existing.status === 'complained') {
        return { status: 'ok' }
      }
      const rawToken = generateConfirmToken()
      const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS)
      const { error: updateErr } = await supabase
        .from('newsletter_subscriptions')
        .update({
          status: 'pending_confirmation',
          email,
          confirmation_token_hash: hashConfirmToken(rawToken),
          confirmation_expires_at: expiresAt.toISOString(),
          consent_text_version: NEWSLETTER_CONSENT_VERSION,
          locale,
          ip: isValidInet(ip) ? ip : null,
          user_agent: userAgent,
          unsubscribed_at: null,
          ...attribution,
        })
        .eq('id', existing.id)

      if (updateErr) {
        captureServerActionError(updateErr, { action: 'newsletter_subscribe', branch: 'update', pg_code: updateErr.code })
        return { status: 'error', code: 'db_error' }
      }

      const { names, replyTo } = await fetchNewsletterMeta(supabase, newsletter_id)
      const sent = await sendNewsletterConfirmEmail({ to: email, rawToken, locale, newsletterNames: names, ...(replyTo ? { replyTo } : {}) })
      if (!sent) return { status: 'error', code: 'email_failed' }
      return { status: 'ok' }
    }

    const rawToken = generateConfirmToken()
    const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS)

    const { error } = await supabase.from('newsletter_subscriptions').insert({
      site_id: siteId,
      email,
      status: 'pending_confirmation',
      confirmation_token_hash: hashConfirmToken(rawToken),
      confirmation_expires_at: expiresAt.toISOString(),
      consent_text_version: NEWSLETTER_CONSENT_VERSION,
      locale,
      newsletter_id,
      ip: isValidInet(ip) ? ip : null,
      user_agent: userAgent,
      ...attribution,
    })

    if (error) {
      if (error.code === '23505') return { status: 'ok' }
      captureServerActionError(error, { action: 'newsletter_subscribe', branch: 'insert', pg_code: error.code })
      return { status: 'error', code: 'db_error' }
    }

    const { names, replyTo } = await fetchNewsletterMeta(supabase, newsletter_id)
    const sent = await sendNewsletterConfirmEmail({ to: email, rawToken, locale, newsletterNames: names, ...(replyTo ? { replyTo } : {}) })
    if (!sent) return { status: 'error', code: 'email_failed' }
    return { status: 'ok' }
  } catch (err) {
    captureServerActionError(err, { action: 'newsletter_subscribe', branch: 'outer_catch' })
    return { status: 'error', code: 'internal' }
  }
}
