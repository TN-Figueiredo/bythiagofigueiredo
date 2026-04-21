import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { getEmailService } from '../../../../../lib/email/service'
import * as Sentry from '@sentry/nextjs'

const JOB = 'send-scheduled-newsletters'
const LOCK_KEY = 'cron:send-newsletters'
const BATCH_SIZE = 100

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const runId = newRunId()

  return withCronLock(supabase, LOCK_KEY, runId, JOB, async () => {
    const { data: editions } = await supabase
      .from('newsletter_editions')
      .select('id, newsletter_type_id, subject, content_html, segment, site_id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())

    if (!editions?.length) return { status: 'ok' as const, sent: 0 }

    let totalSent = 0

    for (const edition of editions) {
      try {
        const sent = await sendEdition(supabase, edition)
        totalSent += sent
      } catch (err) {
        Sentry.captureException(err, {
          tags: { component: 'cron', job: JOB, editionId: edition.id },
        })
      }
    }

    return { status: 'ok' as const, sent: totalSent, editions: editions.length }
  })
}

async function sendEdition(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  edition: { id: string; newsletter_type_id: string; subject: string; content_html: string | null; segment: string | null; site_id: string },
): Promise<number> {
  // CAS: claim the edition
  const { data: claimed } = await supabase
    .from('newsletter_editions')
    .update({ status: 'sending' })
    .eq('id', edition.id)
    .eq('status', 'scheduled')
    .select('id')

  if (!claimed?.length) return 0

  // Resolve audience
  const { data: subscribers } = await supabase
    .from('newsletter_subscriptions')
    .select('email')
    .eq('newsletter_id', edition.newsletter_type_id)
    .eq('status', 'confirmed')

  if (!subscribers?.length) {
    await supabase.from('newsletter_editions').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      send_count: 0,
    }).eq('id', edition.id)
    return 0
  }

  // Seed send rows (idempotent for crash recovery)
  const sendRows = subscribers.map((s) => ({
    edition_id: edition.id,
    subscriber_email: s.email,
    status: 'queued',
  }))

  await supabase.from('newsletter_sends').upsert(sendRows, {
    onConflict: 'edition_id,subscriber_email',
    ignoreDuplicates: true,
  })

  // Get unsent sends
  const { data: unsent } = await supabase
    .from('newsletter_sends')
    .select('id, subscriber_email')
    .eq('edition_id', edition.id)
    .is('resend_message_id', null)

  if (!unsent?.length) {
    await supabase.from('newsletter_editions').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      send_count: subscribers.length,
    }).eq('id', edition.id)
    return subscribers.length
  }

  // Get sender config
  const { data: type } = await supabase
    .from('newsletter_types')
    .select('sender_name, sender_email, max_bounce_rate_pct')
    .eq('id', edition.newsletter_type_id)
    .single()

  const senderName = type?.sender_name ?? 'Thiago Figueiredo'
  const senderEmail = type?.sender_email ?? 'newsletter@bythiagofigueiredo.com'
  const maxBounceRate = type?.max_bounce_rate_pct ?? 5
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'

  // Use content_html if available, otherwise basic fallback
  const html = edition.content_html ?? `<html><body><p>${edition.subject}</p></body></html>`

  // Batch-generate unsubscribe tokens for all subscribers
  const { createHash, randomUUID } = await import('crypto')
  const tokenMap = new Map<string, string>()
  const tokenRows = unsent.map((send) => {
    const rawToken = randomUUID() + randomUUID().replace(/-/g, '')
    const tokenHash = createHash('sha256').update(rawToken).digest('hex')
    tokenMap.set(send.subscriber_email, rawToken)
    return { site_id: edition.site_id, email: send.subscriber_email, token: tokenHash }
  })
  // Batch insert (ON CONFLICT ignore for crash recovery)
  await supabase.from('unsubscribe_tokens')
    .upsert(tokenRows, { onConflict: 'site_id,email', ignoreDuplicates: true })

  const emailService = getEmailService()
  let sentCount = 0
  let bounceCount = 0

  // Send in batches of BATCH_SIZE
  for (let i = 0; i < unsent.length; i += BATCH_SIZE) {
    const batch = unsent.slice(i, i + BATCH_SIZE)

    for (const send of batch) {
      try {
        const unsubToken = tokenMap.get(send.subscriber_email) ?? ''
        const result = await emailService.send({
          from: { name: senderName, email: senderEmail },
          to: send.subscriber_email,
          subject: edition.subject,
          html,
          metadata: {
            headers: {
              'List-Unsubscribe': `<${appUrl}/api/newsletters/unsubscribe?token=${unsubToken}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          },
        })

        await supabase.from('newsletter_sends').update({
          resend_message_id: result.messageId,
          status: 'sent',
        }).eq('id', send.id)

        sentCount++
      } catch {
        bounceCount++
      }
    }

    // Check bounce rate after each batch
    if (sentCount > 0 && (bounceCount / sentCount) * 100 > maxBounceRate) {
      await supabase.from('newsletter_editions').update({ status: 'failed' }).eq('id', edition.id)
      return sentCount
    }
  }

  // Finalize
  await supabase.from('newsletter_editions').update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    send_count: sentCount,
  }).eq('id', edition.id)

  // Update last_sent_at on newsletter_type
  await supabase.from('newsletter_types').update({
    last_sent_at: new Date().toISOString(),
  }).eq('id', edition.newsletter_type_id)

  return sentCount
}
