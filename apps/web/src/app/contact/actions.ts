'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { contactReceivedTemplate, contactAdminAlertTemplate } from '@tn-figueiredo/email'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { getEmailService } from '../../../lib/email/service'
import { getEmailSender } from '../../../lib/email/sender'
import { getSiteContext } from '../../../lib/cms/site-context'
import { verifyTurnstileToken } from '../../../lib/turnstile'

const ContactSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().max(320),
  message: z.string().min(10).max(5000),
  consent_processing: z.literal('on'),
  consent_processing_text_version: z.string().min(1),
  consent_marketing: z.string().transform((v) => v === 'true'),
  consent_marketing_text_version: z.string().optional(),
  turnstile_token: z.string().min(1),
})

export async function submitContact(formData: FormData) {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  const userAgent = h.get('user-agent') ?? undefined

  const ctx = await getSiteContext()

  // 1. Parse + validate
  const raw = {
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
    consent_processing: formData.get('consent_processing'),
    consent_processing_text_version: formData.get('consent_processing_text_version'),
    consent_marketing: formData.get('consent_marketing'),
    consent_marketing_text_version: formData.get('consent_marketing_text_version') ?? undefined,
    turnstile_token: formData.get('turnstile_token'),
  }

  const parsed = ContactSchema.safeParse(raw)
  if (!parsed.success) {
    redirect('/contact?error=validation_error')
  }

  const input = parsed.data

  // 2. Verify Turnstile
  const turnstileOk = await verifyTurnstileToken(input.turnstile_token, ip)
  if (!turnstileOk) {
    redirect('/contact?error=bot_check_failed')
  }

  const supabase = getSupabaseServiceClient()

  // 3. Insert into contact_submissions
  const { data: submission, error: insertError } = await supabase
    .from('contact_submissions')
    .insert({
      site_id: ctx.siteId,
      name: input.name,
      email: input.email,
      message: input.message,
      consent_processing: true,
      consent_processing_text_version: input.consent_processing_text_version,
      consent_marketing: input.consent_marketing,
      consent_marketing_text_version: input.consent_marketing
        ? (input.consent_marketing_text_version ?? null)
        : null,
      ip: ip ?? null,
      user_agent: userAgent ?? null,
    })
    .select('id')
    .single()

  if (insertError || !submission) {
    redirect('/contact?error=submit_failed')
  }

  // 4. Fire emails in background (best-effort — errors should not block redirect)
  void sendContactEmails({
    siteId: ctx.siteId,
    submissionId: submission.id as string,
    name: input.name,
    email: input.email,
    message: input.message,
    locale: 'pt-BR',
  }).catch(() => {
    // swallow — email failures must not surface to user
  })

  redirect('/contact?notice=contact_received')
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

  // 4a. Auto-reply — rate-limited to 1 per email/site/24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentSent } = await supabase
    .from('sent_emails')
    .select('id')
    .eq('site_id', opts.siteId)
    .eq('template_name', 'contact-received')
    .eq('to_email', opts.email)
    .gte('sent_at', since)
    .limit(1)

  if (!recentSent || recentSent.length === 0) {
    const autoReplyResult = await emailService.sendTemplate(
      contactReceivedTemplate,
      { email: sender.email, name: sender.name },
      opts.email,
      { name: opts.name, expectedReplyTime: '2 dias úteis', branding },
      opts.locale,
    )
    await supabase.from('sent_emails').insert({
      site_id: opts.siteId,
      template_name: 'contact-received',
      to_email: opts.email,
      subject: `Recebemos sua mensagem — ${branding.brandName}`,
      provider: 'brevo',
      provider_message_id: autoReplyResult.messageId ?? null,
      status: 'sent',
      metadata: { submission_id: opts.submissionId },
    })
  }

  // 4b. Admin alert
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
