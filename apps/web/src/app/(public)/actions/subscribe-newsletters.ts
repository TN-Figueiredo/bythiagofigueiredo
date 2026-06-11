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
import { sanitizeAttributionInput } from '../../../../lib/newsletter/attribution'
import type { UtmAttributionInput } from '../../../../lib/newsletter/attribution'
import { getFilteredSuggestionsForSubscriber } from '@/lib/newsletter/suggestions'
import type { ScoredSuggestion } from '@/lib/newsletter/suggestions'

const MultiSchema = z.object({
  email: z.string().email(),
  newsletter_ids: z.array(z.string().min(1)).min(1).max(8),
  locale: z.enum(['en', 'pt-BR']),
  turnstile_token: z.string().optional(),
})

export type MultiSubState = { success?: boolean; error?: string; subscribedIds?: string[]; needsConfirmation?: boolean }

export async function subscribeToNewsletters(
  email: string,
  newsletterIds: string[],
  locale: 'en' | 'pt-BR',
  turnstileToken?: string,
  attribution?: UtmAttributionInput,
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

    // UTM attribution forwarded by the client (sanitized) + referrer captured
    // server-side from the `referer` header. All six fields null when absent.
    const attr = sanitizeAttributionInput(attribution, h)

    const { data: rateAllowed, error: rateErr } = await db.rpc('newsletter_rate_check', {
      p_site_id: siteId,
      p_ip: rawIp ?? '',
      p_email: normalizedEmail,
    })
    if (rateErr || rateAllowed === false) {
      if (rateErr) captureServerActionError(rateErr, { action: 'newsletter_subscribe', branch: 'rate_check' })
      return { error: locale === 'pt-BR' ? 'Muitas tentativas. Tente novamente em breve.' : 'Too many attempts. Try again later.' }
    }

    const rawToken = generateConfirmToken()
    const tokenHash = hashConfirmToken(rawToken)
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
        // Block bounced/complained subscribers silently (no oracle)
        if (existing.status === 'bounced' || existing.status === 'complained') {
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
            ip,
            user_agent: userAgent,
            unsubscribed_at: null,
            ...attr,
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
          ...attr,
        })
        if (!error) {
          subscribedIds.push(newsletterId)
          needsConfirmation = true
        } else if (error.code === '23505') {
          // Duplicate race — the row exists but the select above missed it
          // (concurrent insert, or a status='unsubscribed' row excluded by the
          // .neq filter). Reactivate it in place with the SAME shape as the
          // existing-row path above (status + unsubscribed_at included), so the
          // confirm RPC — which only flips status='pending_confirmation' rows —
          // can actually complete the re-subscribe.
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
              ...attr,
            })
            .eq('site_id', siteId)
            .eq('email', normalizedEmail)
            .eq('newsletter_id', newsletterId)
            .neq('status', 'bounced')
            .neq('status', 'complained')
            .neq('status', 'confirmed')
            .select('id')
          if (!fixErr) {
            subscribedIds.push(newsletterId)
            // 0 rows updated = suppressed/confirmed row → silent ok, no email.
            if (fixed && fixed.length > 0) needsConfirmation = true
          }
        }
      }
    }

    if (subscribedIds.length === 0) {
      return { error: locale === 'pt-BR' ? 'Erro interno. Tente novamente.' : 'Internal error. Try again.' }
    }

    if (needsConfirmation) {
      const { data: types } = await db
        .from('newsletter_types')
        .select('id, name, reply_to')
        .in('id', subscribedIds)
      const newsletterNames = types?.map((t: { id: string; name: string }) => t.name) ?? []
      // Same reply_to editions use — first type with one set wins; none → omitted.
      const replyTo = types?.find((t: { reply_to: string | null }) => t.reply_to)?.reply_to ?? undefined
      const sent = await sendNewsletterConfirmEmail({ to: normalizedEmail, rawToken, locale, newsletterNames, ...(replyTo ? { replyTo } : {}) })
      if (!sent) {
        return { error: locale === 'pt-BR' ? 'Erro ao enviar email. Tente novamente.' : 'Failed to send email. Try again.' }
      }
    }

    return { success: true, subscribedIds, needsConfirmation }
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
