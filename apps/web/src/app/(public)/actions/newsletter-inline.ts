'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { getSiteContext } from '../../../../lib/cms/site-context'
import { verifyTurnstileToken } from '../../../../lib/turnstile'
import { getClientIp, isValidInet } from '../../../../lib/request-ip'
import { captureServerActionError } from '../../../lib/sentry-wrap'
import { NEWSLETTER_CONSENT_VERSION as CONSENT_VERSION } from '../../newsletter/consent'
import { generateConfirmToken, hashConfirmToken, sendNewsletterConfirmEmail } from '../../../../lib/newsletter/confirm-email'
import { readNewsletterAttribution } from '../../../../lib/newsletter/attribution'

const InlineSchema = z.object({
  email: z.string().email(),
  newsletter_id: z.string().min(1),
  locale: z.enum(['en', 'pt-BR']),
  turnstile_token: z.string().optional(),
  // UTM params are read/sanitized separately via readNewsletterAttribution;
  // declared optional here so strict parsing never rejects them.
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_content: z.string().optional(),
  utm_term: z.string().optional(),
})

export type InlineState = { success?: boolean; error?: string }

function msg(locale: string, pt: string, en: string) {
  return locale === 'pt-BR' ? pt : en
}

export async function subscribeNewsletterInline(
  _prev: InlineState | undefined,
  formData: FormData,
): Promise<InlineState> {
  const rawLocale = (formData.get('locale') as string) ?? 'pt-BR'

  try {
    const parsed = InlineSchema.safeParse({
      email: formData.get('email'),
      newsletter_id: formData.get('newsletter_id'),
      locale: formData.get('locale'),
      turnstile_token: formData.get('turnstile_token'),
    })
    if (!parsed.success) {
      return { error: msg(rawLocale, 'E-mail inválido.', 'Invalid email.') }
    }

    const { email: rawEmail, newsletter_id, locale, turnstile_token } = parsed.data
    const email = rawEmail.trim().toLowerCase()

    const { siteId } = await getSiteContext()

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      if (!turnstile_token) return { error: msg(locale, 'Verificação necessária.', 'Verification required.') }
      const ok = await verifyTurnstileToken(turnstile_token)
      if (!ok) return { error: msg(locale, 'Verificação falhou.', 'Verification failed.') }
    }

    const db = getSupabaseServiceClient()
    const h = await headers()
    const rawIp = getClientIp(h)
    const ip = isValidInet(rawIp) ? rawIp : null
    const userAgent = h.get('user-agent') || null
    const attribution = readNewsletterAttribution(formData, h as Headers)

    const { data: rateAllowed, error: rateErr } = await db.rpc('newsletter_rate_check', {
      p_site_id: siteId,
      p_ip: rawIp ?? '',
      p_email: email,
    })
    if (rateErr || rateAllowed === false) {
      if (rateErr) captureServerActionError(rateErr, { action: 'newsletter_inline', branch: 'rate_check' })
      return { error: msg(locale, 'Muitas tentativas. Tente novamente em breve.', 'Too many attempts. Try again later.') }
    }

    const rawToken = generateConfirmToken()
    const tokenHash = hashConfirmToken(rawToken)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data: existing } = await db
      .from('newsletter_subscriptions')
      .select('id, status')
      .eq('site_id', siteId)
      .eq('email', email)
      .eq('newsletter_id', newsletter_id)
      .neq('status', 'unsubscribed')
      .maybeSingle()

    if (existing) {
      if (existing.status === 'confirmed') {
        return { success: true }
      }
      // Block bounced/complained subscribers silently (no oracle)
      if (existing.status === 'bounced' || existing.status === 'complained') {
        return { success: true }
      }
      const { error: updateErr } = await db
        .from('newsletter_subscriptions')
        .update({
          status: 'pending_confirmation',
          confirmation_token_hash: tokenHash,
          confirmation_expires_at: expiresAt,
          consent_text_version: CONSENT_VERSION,
          locale,
          ip,
          user_agent: userAgent,
          unsubscribed_at: null,
          ...attribution,
        })
        .eq('id', existing.id)
      if (updateErr) {
        return { error: msg(locale, 'Erro interno. Tente novamente.', 'Internal error. Try again.') }
      }
    } else {
      const { error: insertError } = await db.from('newsletter_subscriptions').insert({
        site_id: siteId,
        email,
        status: 'pending_confirmation',
        newsletter_id,
        locale,
        ip,
        user_agent: userAgent,
        consent_text_version: CONSENT_VERSION,
        confirmation_token_hash: tokenHash,
        confirmation_expires_at: expiresAt,
        ...attribution,
      })
      if (insertError) {
        if (insertError.code !== '23505') {
          return { error: msg(locale, 'Erro interno. Tente novamente.', 'Internal error. Try again.') }
        }
        // Duplicate race — the row exists but the select above missed it
        // (concurrent insert, or a status='unsubscribed' row excluded by the
        // .neq filter). Reactivate it in place with the SAME shape as the
        // existing-row path above (status + unsubscribed_at + fresh token), so
        // the confirm link we email actually matches a DB row — otherwise the
        // subscriber gets 'Link não encontrado'. Mirrors subscribe-newsletters.
        // Guards: never resurrect suppressed (bounced/complained) rows and
        // never regress a concurrently-confirmed row — those match 0 rows and
        // get the same silent-success/no-email treatment as above.
        const { data: fixed, error: fixErr } = await db
          .from('newsletter_subscriptions')
          .update({
            status: 'pending_confirmation',
            confirmation_token_hash: tokenHash,
            confirmation_expires_at: expiresAt,
            consent_text_version: CONSENT_VERSION,
            locale,
            ip,
            user_agent: userAgent,
            unsubscribed_at: null,
            ...attribution,
          })
          .eq('site_id', siteId)
          .eq('email', email)
          .eq('newsletter_id', newsletter_id)
          .neq('status', 'bounced')
          .neq('status', 'complained')
          .neq('status', 'confirmed')
          .select('id')
        if (fixErr) {
          return { error: msg(locale, 'Erro interno. Tente novamente.', 'Internal error. Try again.') }
        }
        // 0 rows updated = suppressed/confirmed row → silent ok, NO email
        // (the token was never persisted, so a confirm link would be dead).
        if (!fixed || fixed.length === 0) {
          return { success: true }
        }
      }
    }

    let newsletterNames: string[] = []
    let replyTo: string | undefined
    try {
      const { data: nlType } = await db
        .from('newsletter_types')
        .select('name, reply_to')
        .eq('id', newsletter_id)
        .maybeSingle()
      if (nlType?.name) newsletterNames = [nlType.name as string]
      // Same reply_to editions use — set on the type → confirm carries it.
      if (nlType?.reply_to) replyTo = nlType.reply_to as string
    } catch { /* best-effort */ }
    const sent = await sendNewsletterConfirmEmail({ to: email, rawToken, locale, action: 'newsletter_inline', newsletterNames, ...(replyTo ? { replyTo } : {}) })
    if (!sent) {
      return { success: false, error: 'email_failed' }
    }
    return { success: true }
  } catch (err) {
    captureServerActionError(err, { action: 'newsletter_inline', branch: 'outer_catch' })
    return { error: msg(rawLocale, 'Erro interno. Tente novamente.', 'Internal error. Try again.') }
  }
}
