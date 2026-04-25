'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getEmailService } from '@/lib/email/service'
import { getEmailSender } from '@/lib/email/sender'
import { captureServerActionError } from '@/lib/sentry-wrap'

type ActionResult = { ok: true } | { ok: false; error: string }
type ExportResult =
  | { ok: true; csv: string; filename: string }
  | { ok: false; error: string }

function zodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(', ') || 'Validation failed'
}

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(
      res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden',
    )
  }
  return siteId
}

/* ------------------------------------------------------------------ */
/*  markReplied                                                       */
/* ------------------------------------------------------------------ */

export async function markReplied(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Missing submission id' }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('contact_submissions')
    .update({ replied_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)
  if (error) {
    captureServerActionError(error, {
      action: 'contact_mark_replied',
      site_id: siteId,
    })
    return { ok: false, error: error.message }
  }
  revalidatePath('/cms/contacts')
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/*  undoMarkReplied                                                   */
/* ------------------------------------------------------------------ */

export async function undoMarkReplied(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Missing submission id' }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('contact_submissions')
    .update({ replied_at: null })
    .eq('id', id)
    .eq('site_id', siteId)
  if (error) {
    captureServerActionError(error, {
      action: 'contact_undo_mark_replied',
      site_id: siteId,
    })
    return { ok: false, error: error.message }
  }
  revalidatePath('/cms/contacts')
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/*  anonymizeSubmission                                                */
/* ------------------------------------------------------------------ */

export async function anonymizeSubmission(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Missing submission id' }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase.rpc('anonymize_contact_submission', {
    p_id: id,
  })
  if (error) {
    captureServerActionError(error, {
      action: 'contact_anonymize',
      site_id: siteId,
      submission_id: id,
    })
    return { ok: false, error: error.message }
  }
  revalidatePath('/cms/contacts')
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/*  bulkAnonymize                                                     */
/* ------------------------------------------------------------------ */

export async function bulkAnonymize(ids: string[]): Promise<ActionResult> {
  if (!ids.length) return { ok: false, error: 'No submissions selected' }
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()
  const errors: string[] = []
  for (const id of ids) {
    const { error } = await supabase.rpc('anonymize_contact_submission', {
      p_id: id,
    })
    if (error) {
      captureServerActionError(error, {
        action: 'contact_bulk_anonymize',
        site_id: siteId,
        submission_id: id,
      })
      errors.push(id)
    }
  }
  revalidatePath('/cms/contacts')
  if (errors.length > 0) {
    return { ok: false, error: `Failed to anonymize ${errors.length} submission(s)` }
  }
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/*  sendReply                                                         */
/* ------------------------------------------------------------------ */

const sendReplySchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
  body: z.string().min(1, 'Body is required').max(10000),
})

export async function sendReply(
  id: string,
  input: { subject: string; body: string },
): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'Missing submission id' }
  const parsed = sendReplySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  // Fetch submission to get recipient email
  const { data: sub, error: fetchErr } = await supabase
    .from('contact_submissions')
    .select('email, name, anonymized_at')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (fetchErr || !sub) {
    return { ok: false, error: 'Submission not found' }
  }
  if (sub.anonymized_at) {
    return { ok: false, error: 'Cannot reply to anonymized submission' }
  }

  const sender = await getEmailSender(siteId)
  const emailService = getEmailService()

  try {
    await emailService.send({
      from: { email: sender.email, name: sender.name },
      to: sub.email as string,
      subject: parsed.data.subject,
      html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333">${parsed.data.body.replace(/\n/g, '<br>')}</div>`,
    })
  } catch (err) {
    captureServerActionError(err instanceof Error ? err : new Error(String(err)), {
      action: 'contact_send_reply',
      site_id: siteId,
      submission_id: id,
    })
    return { ok: false, error: 'Failed to send email' }
  }

  // Mark as replied after successful send
  await supabase
    .from('contact_submissions')
    .update({ replied_at: new Date().toISOString() })
    .eq('id', id)
    .eq('site_id', siteId)

  // Record in sent_emails
  await supabase.from('sent_emails').insert({
    site_id: siteId,
    template_name: 'contact-reply',
    to_email: sub.email as string,
    subject: parsed.data.subject,
    provider: 'resend',
    provider_message_id: null,
    status: 'sent',
    metadata: { submission_id: id },
  })

  revalidatePath('/cms/contacts')
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/*  exportContacts                                                    */
/* ------------------------------------------------------------------ */

const exportSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '365d', 'all']),
  status: z.enum(['all', 'pending', 'replied', 'anonymized']),
})

export async function exportContacts(
  period: string,
  status: string,
): Promise<ExportResult> {
  const parsed = exportSchema.safeParse({ period, status })
  if (!parsed.success) return { ok: false, error: zodError(parsed.error) }

  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  let query = supabase
    .from('contact_submissions')
    .select('id, name, email, message, submitted_at, replied_at, anonymized_at')
    .eq('site_id', siteId)
    .order('submitted_at', { ascending: false })

  // Period filter
  if (parsed.data.period !== 'all') {
    const days = parseInt(parsed.data.period)
    const since = new Date()
    since.setDate(since.getDate() - days)
    query = query.gte('submitted_at', since.toISOString())
  }

  // Status filter
  if (parsed.data.status === 'pending') {
    query = query.is('replied_at', null).is('anonymized_at', null)
  } else if (parsed.data.status === 'replied') {
    query = query.not('replied_at', 'is', null)
  } else if (parsed.data.status === 'anonymized') {
    query = query.not('anonymized_at', 'is', null)
  }

  const { data, error } = await query

  if (error) {
    captureServerActionError(error, {
      action: 'contact_export',
      site_id: siteId,
    })
    return { ok: false, error: error.message }
  }

  const rows = data ?? []
  const header = 'Name,Email,Message,Submitted,Replied,Status'
  const csvRows = rows.map((r) => {
    const status = r.anonymized_at
      ? 'anonymized'
      : r.replied_at
        ? 'replied'
        : 'pending'
    const escapeCsv = (v: unknown) => {
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }
    return [
      escapeCsv(r.name),
      escapeCsv(r.email),
      escapeCsv(r.message),
      escapeCsv(String(r.submitted_at).slice(0, 19)),
      escapeCsv(r.replied_at ? String(r.replied_at).slice(0, 19) : ''),
      status,
    ].join(',')
  })

  const csv = [header, ...csvRows].join('\n')
  const date = new Date().toISOString().slice(0, 10)
  return { ok: true, csv, filename: `contacts-${date}.csv` }
}
