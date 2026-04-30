'use server'

import crypto from 'node:crypto'
import { headers } from 'next/headers'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { getSiteContext } from '../../../../lib/cms/site-context'
import { getEmailService } from '../../../../lib/email/service'
import { verifyTurnstileToken } from '../../../../lib/turnstile'

const CONSENT_VERSION = 'newsletter-v1-2026-04'

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

    const { siteId } = await getSiteContext()

    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
      if (!turnstileToken) return { error: locale === 'pt-BR' ? 'Verificação necessária.' : 'Verification required.' }
      const ok = await verifyTurnstileToken(turnstileToken)
      if (!ok) return { error: locale === 'pt-BR' ? 'Verificação falhou.' : 'Verification failed.' }
    }

    const db = getSupabaseServiceClient()
    const h = await headers()
    const rawIp = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    const ip = rawIp || null
    const userAgent = h.get('user-agent') || null

    const { data: rateAllowed } = await db.rpc('newsletter_rate_check', {
      p_site_id: siteId,
      p_ip: rawIp ?? '',
      p_email: email,
    })
    if (rateAllowed === false) {
      return { error: locale === 'pt-BR' ? 'Muitas tentativas. Tente novamente em breve.' : 'Too many attempts. Try again later.' }
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const subscribedIds: string[] = []
    for (const newsletterId of parsed.data.newsletter_ids) {
      const { error } = await db.from('newsletter_subscriptions').insert({
        site_id: siteId,
        email,
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
      }
    }

    if (subscribedIds.length === 0) {
      return { error: locale === 'pt-BR' ? 'Erro interno. Tente novamente.' : 'Internal error. Try again.' }
    }

    const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/newsletter/confirm?token=${rawToken}`
    const isPt = locale === 'pt-BR'

    try {
      const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
      await getEmailService().send({
        from: { name: 'Thiago Figueiredo', email: `no-reply@${domain}` },
        to: email,
        subject: isPt ? 'Confirme sua inscrição' : 'Confirm your subscription',
        html: `<!DOCTYPE html><html><body style="font-family:Georgia,serif;max-width:520px;margin:40px auto;color:#161208;line-height:1.6;">
          <h2 style="font-weight:500;letter-spacing:-0.02em;">${isPt ? 'Quase lá.' : 'Almost there.'}</h2>
          <p style="color:#6A5F48;font-family:sans-serif;">${isPt
            ? `Você escolheu ${subscribedIds.length} newsletter${subscribedIds.length > 1 ? 's' : ''}. Confirma clicando no botão abaixo.`
            : `You picked ${subscribedIds.length} newsletter${subscribedIds.length > 1 ? 's' : ''}. Confirm by clicking below.`
          }</p>
          <a href="${confirmUrl}" style="background:#C14513;color:#fff;padding:14px 28px;border-radius:4px;text-decoration:none;display:inline-block;font-family:sans-serif;font-weight:600;font-size:14px;margin-top:8px;">
            ${isPt ? 'Confirmar inscrição' : 'Confirm subscription'}
          </a>
          <p style="margin-top:32px;font-size:13px;color:#9C9178;font-family:sans-serif;">${isPt ? 'Se não foi você, pode ignorar este email.' : "If this wasn't you, you can ignore this email."}</p>
        </body></html>`,
      })
    } catch (emailErr) {
      console.error('[subscribe-newsletters] Email send failed:', emailErr)
      Sentry.captureException(emailErr, { tags: { component: 'newsletter-subscribe', action: 'send-confirmation' } })
    }

    return { success: true, subscribedIds }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'newsletter-subscribe', action: 'subscribe' } })
    return { error: locale === 'pt-BR' ? 'Erro interno. Tente novamente.' : 'Internal error. Try again.' }
  }
}
