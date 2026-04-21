'use server'

import crypto from 'node:crypto'
import { z } from 'zod'
import { getSupabaseServiceClient } from '../../../../lib/supabase/service'
import { getSiteContext } from '../../../../lib/cms/site-context'
import { getEmailService } from '../../../../lib/email/service'
import { verifyTurnstileToken } from '../../../../lib/turnstile'

const CONSENT_VERSION = 'newsletter-v1-2026-04'

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
  const parsed = InlineSchema.safeParse({
    email: formData.get('email'),
    newsletter_id: formData.get('newsletter_id'),
    locale: formData.get('locale'),
    turnstile_token: formData.get('turnstile_token'),
  })
  if (!parsed.success) {
    return { error: 'E-mail inválido. / Invalid email.' }
  }

  const { email, newsletter_id, locale, turnstile_token } = parsed.data

  // siteId from middleware header — same pattern as newsletter/subscribe/actions.ts
  const { siteId } = await getSiteContext()

  // Turnstile: required when NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    if (!turnstile_token) return { error: 'Verificação necessária. / Verification required.' }
    const ok = await verifyTurnstileToken(turnstile_token)
    if (!ok) return { error: 'Verificação falhou. / Verification failed.' }
  }

  const db = getSupabaseServiceClient()

  // Rate check (per-email, best-effort)
  const { data: rate } = await db.rpc('newsletter_rate_check', {
    p_site_id: siteId,
    p_email: email,
  })
  if (rate?.allowed === false) {
    return { error: 'Muitas tentativas. Tente novamente em breve. / Too many attempts.' }
  }

  // Generate confirmation token
  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  // Insert subscription
  const { error: insertError } = await db.from('newsletter_subscriptions').insert({
    site_id: siteId,
    email,
    status: 'pending_confirmation',
    newsletter_id,
    locale,
    consent_text_version: CONSENT_VERSION,
    confirmation_token_hash: tokenHash,
    confirmation_expires_at: expiresAt,
  })

  if (insertError && !insertError.message.includes('duplicate')) {
    return { error: 'Erro interno. Tente novamente. / Internal error.' }
  }

  // Send confirmation email (non-fatal)
  const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/newsletter/confirm?token=${rawToken}`
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
  }).catch(() => undefined)

  return { success: true }
}
