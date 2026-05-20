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

const InlineSchema = z.object({
  email: z.string().email(),
  newsletter_id: z.string().min(1),
  locale: z.enum(['en', 'pt-BR']),
  turnstile_token: z.string().optional(),
})

export type InlineState = { success?: boolean; error?: string }

export async function subscribeNewsletterInline(
  _prev: InlineState | undefined,
  formData: FormData,
): Promise<InlineState> {
  try {
  const parsed = InlineSchema.safeParse({
    email: formData.get('email'),
    newsletter_id: formData.get('newsletter_id'),
    locale: formData.get('locale'),
    turnstile_token: formData.get('turnstile_token'),
  })
  if (!parsed.success) {
    return { error: 'E-mail inválido. / Invalid email.' }
  }

  const { email: rawEmail, newsletter_id, locale, turnstile_token } = parsed.data
  const email = rawEmail.trim().toLowerCase()

  const { siteId } = await getSiteContext()

  // Turnstile: required when NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    if (!turnstile_token) return { error: 'Verificação necessária. / Verification required.' }
    const ok = await verifyTurnstileToken(turnstile_token)
    if (!ok) return { error: 'Verificação falhou. / Verification failed.' }
  }

  const db = getSupabaseServiceClient()
  const h = await headers()
  const rawIp = getClientIp(h)
  const ip = isValidInet(rawIp) ? rawIp : null

  const { data: rateAllowed } = await db.rpc('newsletter_rate_check', {
    p_site_id: siteId,
    p_ip: rawIp ?? '',
    p_email: email,
  })
  if (rateAllowed === false) {
    return { error: 'Muitas tentativas. Tente novamente em breve. / Too many attempts.' }
  }

  // Generate confirmation token
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const userAgent = h.get('user-agent') || null

  // Check for existing subscription — update token on re-subscribe
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
    if (updateErr) {
      return { error: 'Erro interno. Tente novamente. / Internal error.' }
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
    })
    if (insertError && !insertError.message.includes('duplicate')) {
      return { error: 'Erro interno. Tente novamente. / Internal error.' }
    }
  }

  // Send confirmation email (non-fatal)
  const localePrefix = locale === 'pt-BR' ? '/pt' : ''
  const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}${localePrefix}/newsletter/confirm/${rawToken}`
  const isPt = locale === 'pt-BR'
  const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
  await getEmailService().send({
    from: { name: 'Thiago Figueiredo', email: `no-reply@${domain}` },
    to: email,
    subject: isPt ? 'Confirme sua inscrição' : 'Confirm your subscription',
    html: `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:480px;margin:40px auto;">
      <h2>${isPt ? 'Confirme sua inscrição' : 'Confirm your subscription'}</h2>
      <a href="${confirmUrl}" style="background:#C14513;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
        ${isPt ? 'Confirmar' : 'Confirm'}
      </a>
    </body></html>`,
  }).catch((err) => {
    console.error('[newsletter-inline] Email send failed:', err)
    captureServerActionError(err, { action: 'newsletter_inline', branch: 'send_confirm_email' })
  })

  return { success: true }
  } catch (err) {
    captureServerActionError(err, { action: 'newsletter_inline', branch: 'outer_catch' })
    return { error: 'Erro interno. Tente novamente. / Internal error.' }
  }
}
