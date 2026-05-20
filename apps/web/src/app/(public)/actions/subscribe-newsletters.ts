'use server'

import crypto from 'node:crypto'
import { headers } from 'next/headers'
import { z } from 'zod'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { getSiteContext } from '../../../../lib/cms/site-context'
import { getEmailService } from '../../../../lib/email/service'
import { verifyTurnstileToken } from '../../../../lib/turnstile'
import { getClientIp, isValidInet } from '../../../../lib/request-ip'
import { captureServerActionError } from '../../../lib/sentry-wrap'
import { NEWSLETTER_CONSENT_VERSION as CONSENT_VERSION } from '../../newsletter/consent'
import { getFilteredSuggestionsForSubscriber } from '@/lib/newsletter/suggestions'
import type { ScoredSuggestion } from '@/lib/newsletter/suggestions'

const MultiSchema = z.object({
  email: z.string().email(),
  newsletter_ids: z.array(z.string().min(1)).min(1).max(8),
  locale: z.enum(['en', 'pt-BR']),
  turnstile_token: z.string().optional(),
})

export type MultiSubState = { success?: boolean; error?: string; subscribedIds?: string[] }

export async function subscribeToNewsletters(
  email: string,
  newsletterIds: string[],
  locale: 'en' | 'pt-BR',
  turnstileToken?: string,
): Promise<MultiSubState> {
  try {
    const parsed = MultiSchema.safeParse({
      email,
      newsletter_ids: newsletterIds,
      locale,
      turnstile_token: turnstileToken,
    })
    if (!parsed.success) {
      return { error: locale === 'pt-BR' ? 'E-mail inválido.' : 'Invalid email.' }
    }

    const normalizedEmail = email.trim().toLowerCase()
    const { siteId } = await getSiteContext()

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      if (!turnstileToken) return { error: locale === 'pt-BR' ? 'Verificação necessária.' : 'Verification required.' }
      const ok = await verifyTurnstileToken(turnstileToken)
      if (!ok) return { error: locale === 'pt-BR' ? 'Verificação falhou.' : 'Verification failed.' }
    }

    const db = getSupabaseServiceClient()
    const h = await headers()
    const rawIp = getClientIp(h)
    const ip = isValidInet(rawIp) ? rawIp : null
    const userAgent = h.get('user-agent') || null

    const { data: rateAllowed } = await db.rpc('newsletter_rate_check', {
      p_site_id: siteId,
      p_ip: rawIp ?? '',
      p_email: normalizedEmail,
    })
    if (rateAllowed === false) {
      return { error: locale === 'pt-BR' ? 'Muitas tentativas. Tente novamente em breve.' : 'Too many attempts. Try again later.' }
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const subscribedIds: string[] = []
    let needsConfirmation = false
    for (const newsletterId of parsed.data.newsletter_ids) {
      const { data: existing } = await db
        .from('newsletter_subscriptions')
        .select('id, status')
        .eq('site_id', siteId)
        .eq('email', normalizedEmail)
        .eq('newsletter_id', newsletterId)
        .neq('status', 'unsubscribed')
        .maybeSingle()

      if (existing) {
        if (existing.status === 'confirmed') {
          subscribedIds.push(newsletterId)
          continue
        }
        const { error: updateErr } = await db
          .from('newsletter_subscriptions')
          .update({
            status: 'pending_confirmation',
            confirmation_token_hash: tokenHash,
            confirmation_expires_at: expiresAt,
            consent_text_version: CONSENT_VERSION,
            locale,
            unsubscribed_at: null,
          })
          .eq('id', existing.id)
        if (!updateErr) {
          subscribedIds.push(newsletterId)
          needsConfirmation = true
        }
      } else {
        const { error } = await db.from('newsletter_subscriptions').insert({
          site_id: siteId,
          email: normalizedEmail,
          status: 'pending_confirmation',
          newsletter_id: newsletterId,
          locale,
          consent_text_version: CONSENT_VERSION,
          confirmation_token_hash: tokenHash,
          confirmation_expires_at: expiresAt,
          ip,
          user_agent: userAgent,
        })
        if (!error || error.message.includes('duplicate')) {
          subscribedIds.push(newsletterId)
          needsConfirmation = true
        }
      }
    }

    if (subscribedIds.length === 0) {
      return { error: locale === 'pt-BR' ? 'Erro interno. Tente novamente.' : 'Internal error. Try again.' }
    }

    if (needsConfirmation) {
      const localePrefix = locale === 'pt-BR' ? '/pt' : ''
      const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}${localePrefix}/newsletter/confirm/${rawToken}`
      const isPt = locale === 'pt-BR'

      try {
        const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
        await getEmailService().send({
          from: { name: 'Thiago Figueiredo', email: `no-reply@${domain}` },
          to: normalizedEmail,
          subject: isPt ? 'Confirme sua inscrição' : 'Confirm your subscription',
          html: `<!DOCTYPE html><html><body style="font-family:Georgia,serif;max-width:520px;margin:40px auto;color:#161208;line-height:1.6;">
            <h2 style="font-weight:500;letter-spacing:-0.02em;">${isPt ? 'Quase lá.' : 'Almost there.'}</h2>
            <p style="color:#6A5F48;font-family:sans-serif;">${isPt
              ? `Confirme clicando no botão abaixo.`
              : `Confirm by clicking below.`
            }</p>
            <a href="${confirmUrl}" style="background:#C14513;color:#fff;padding:14px 28px;border-radius:4px;text-decoration:none;display:inline-block;font-family:sans-serif;font-weight:600;font-size:14px;margin-top:8px;">
              ${isPt ? 'Confirmar inscrição' : 'Confirm subscription'}
            </a>
            <p style="margin-top:32px;font-size:13px;color:#9C9178;font-family:sans-serif;">${isPt ? 'Se não foi você, pode ignorar este email.' : "If this wasn't you, you can ignore this email."}</p>
          </body></html>`,
        })
      } catch (emailErr) {
        console.error('[subscribe-newsletters] Email send failed:', emailErr)
        captureServerActionError(emailErr, { action: 'newsletter_subscribe', branch: 'send_confirm_email' })
      }
    }

    return { success: true, subscribedIds }
  } catch (err) {
    captureServerActionError(err, { action: 'newsletter_subscribe', branch: 'outer_catch' })
    return { error: locale === 'pt-BR' ? 'Erro interno. Tente novamente.' : 'Internal error. Try again.' }
  }
}

export async function getPostSubscribeSuggestions(
  currentSlug: string,
  locale: 'en' | 'pt-BR',
  email: string,
): Promise<ScoredSuggestion[]> {
  try {
    return await getFilteredSuggestionsForSubscriber(currentSlug, locale, email)
  } catch {
    return []
  }
}
