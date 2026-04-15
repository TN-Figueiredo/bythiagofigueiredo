'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { contactReceivedTemplate, contactAdminAlertTemplate } from '@tn-figueiredo/email'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { getEmailService } from '../../../lib/email/service'
import { getEmailSender } from '../../../lib/email/sender'
import { getSiteContext } from '../../../lib/cms/site-context'
import { verifyTurnstileToken } from '../../../lib/turnstile'
import {
  CONTACT_CONSENT_VERSION,
  CONTACT_MARKETING_CONSENT_VERSION,
} from './consent'

const ContactSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().max(320),
  message: z.string().min(10).max(5000),
  consent_processing: z.literal('on'),
  consent_marketing: z.string().transform((v) => v === 'true'),
  turnstile_token: z.string().min(1),
})

export type ContactResult =
  | { status: 'ok' }
  | { status: 'validation' }
  | { status: 'captcha_failed' }
  | { status: 'rate_limited' }
  | { status: 'error' }

export async function submitContact(formData: FormData): Promise<ContactResult> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  const userAgent = h.get('user-agent') ?? undefined

  const ctx = await getSiteContext()

  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
    consent_processing: formData.get('consent_processing'),
    consent_marketing: formData.get('consent_marketing'),
    turnstile_token: formData.get('turnstile_token'),
  }

  const parsed = ContactSchema.safeParse(raw)
  if (!parsed.success) {
    return { status: 'validation' }
  }

  const input = parsed.data

  const turnstileOk = await verifyTurnstileToken(input.turnstile_token, ip)
  if (!turnstileOk) {
    return { status: 'captcha_failed' }
  }

  const supabase = getSupabaseServiceClient()

  // Server-side rate limit (IP + email, 10min window)
  const { data: rateOk, error: rateErr } = await supabase.rpc('contact_rate_check', {
    p_site_id: ctx.siteId,
    p_ip: ip ?? null,
    p_email: input.email,
  })
  if (rateErr) {
    return { status: 'error' }
  }
  if (rateOk === false) {
    return { status: 'rate_limited' }
  }

  // Insert submission with server-controlled consent versions (client values ignored).
  const { data: submission, error: insertError } = await supabase
    .from('contact_submissions')
    .insert({
      site_id: ctx.siteId,
      name: input.name,
      email: input.email,
      message: input.message,
      consent_processing: true,
      consent_processing_text_version: CONTACT_CONSENT_VERSION,
      consent_marketing: input.consent_marketing,
      consent_marketing_text_version: input.consent_marketing
        ? CONTACT_MARKETING_CONSENT_VERSION
        : null,
      ip: ip ?? null,
      user_agent: userAgent ?? null,
    })
    .select('id')
    .single()

  if (insertError || !submission) {
    return { status: 'error' }
  }

  // Revalidate admin list so new row appears.
  revalidatePath('/cms/contacts')

  // Fire emails in background — failures must not surface.
  void sendContactEmails({
    siteId: ctx.siteId,
    submissionId: submission.id as string,
    name: input.name,
    email: input.email,
    message: input.message,
    locale: 'pt-BR',
  }).catch(() => {
    /* swallow */
  })

  return { status: 'ok' }
}

async function sendContactEmails(opts: {
  siteId: string
  submissionId: string
  name: string
  email: string
  message: string
  locale: string
}) {
  const supabase = getSupabaseServiceClient()
  const sender = await getEmailSender(opts.siteId)
  const emailService = getEmailService()
  const branding = {
    brandName: sender.brandName,
    logoUrl: undefined,
    primaryColor: sender.primaryColor,
    siteUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com',
  }

  // Auto-reply — rely on unique partial index (sent_emails_contact_autoreply_daily)
  // to prevent duplicate sends for (site_id, to_email, 'contact-received', UTC day).
  try {
    const autoReplyResult = await emailService.sendTemplate(
      contactReceivedTemplate,
      { email: sender.email, name: sender.name },
      opts.email,
      { name: opts.name, expectedReplyTime: '2 dias úteis', branding },
      opts.locale,
    )

    const { error: insErr } = await supabase.from('sent_emails').insert({
      site_id: opts.siteId,
      template_name: 'contact-received',
      to_email: opts.email,
      subject: `Recebemos sua mensagem — ${branding.brandName}`,
      provider: 'brevo',
      provider_message_id: autoReplyResult.messageId ?? null,
      status: 'sent',
      metadata: { submission_id: opts.submissionId },
    })

    // 23505 = unique violation → already sent today, treated as throttled no-op.
    if (insErr && (insErr as { code?: string }).code !== '23505') {
      // other DB errors — swallowed (best effort)
    }
  } catch {
    /* email send failure swallowed */
  }

  // Admin alert
  const { data: site } = await supabase
    .from('sites')
    .select('contact_notification_email')
    .eq('id', opts.siteId)
    .single()

  const adminEmail =
    (site?.contact_notification_email as string | null) ?? sender.email

  const adminAlertResult = await emailService.sendTemplate(
    contactAdminAlertTemplate,
    { email: sender.email, name: sender.name },
    adminEmail,
    {
      submitterName: opts.name,
      submitterEmail: opts.email,
      message: opts.message,
      viewInAdminUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'}/cms/contacts/${opts.submissionId}`,
      branding,
    },
    opts.locale,
  )

  await supabase.from('sent_emails').insert({
    site_id: opts.siteId,
    template_name: 'contact-admin-alert',
    to_email: adminEmail,
    subject: `Novo contato: ${opts.name}`,
    provider: 'brevo',
    provider_message_id: adminAlertResult.messageId ?? null,
    status: 'sent',
    metadata: { submission_id: opts.submissionId },
  })
}
