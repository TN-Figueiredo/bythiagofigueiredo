import { revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { getEmailService } from '../../../../../lib/email/service'
import { render } from '@react-email/render'
import { Newsletter } from '../../../../emails/newsletter'
import * as Sentry from '@sentry/nextjs'

const JOB = 'send-scheduled-newsletters'
const LOCK_KEY = 'cron:send-newsletters'
const BATCH_SIZE = 100
const THROTTLE_MS = 50

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

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
      .select('id, newsletter_type_id, subject, preheader, content_html, content_mdx, segment, site_id')
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

    if (totalSent > 0) {
      revalidateTag('newsletter-suggestions')
    }

    return { status: 'ok' as const, sent: totalSent, editions: editions.length }
  })
}

async function sendEdition(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  edition: {
    id: string; newsletter_type_id: string; subject: string; preheader: string | null
    content_html: string | null; content_mdx: string | null; segment: string | null; site_id: string
  },
): Promise<number> {
  const { data: claimed } = await supabase
    .from('newsletter_editions')
    .update({ status: 'sending' })
    .eq('id', edition.id)
    .eq('status', 'scheduled')
    .select('id')

  if (!claimed?.length) return 0

  const { data: subscribers } = await supabase
    .from('newsletter_subscriptions')
    .select('email')
    .eq('newsletter_id', edition.newsletter_type_id)
    .eq('site_id', edition.site_id)
    .eq('status', 'confirmed')

  if (!subscribers?.length) {
    await supabase.from('newsletter_editions').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      send_count: 0,
    }).eq('id', edition.id)
    return 0
  }

  const sendRows = subscribers.map((s) => ({
    edition_id: edition.id,
    subscriber_email: s.email,
    status: 'queued',
  }))

  await supabase.from('newsletter_sends').upsert(sendRows, {
    onConflict: 'edition_id,subscriber_email',
    ignoreDuplicates: true,
  })

  const { data: unsent } = await supabase
    .from('newsletter_sends')
    .select('id, subscriber_email')
    .eq('edition_id', edition.id)
    .is('provider_message_id', null)

  if (!unsent?.length) {
    await supabase.from('newsletter_editions').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      send_count: subscribers.length,
    }).eq('id', edition.id)
    return subscribers.length
  }

  const { data: type } = await supabase
    .from('newsletter_types')
    .select('name, color, sender_name, sender_email, reply_to, max_bounce_rate_pct')
    .eq('id', edition.newsletter_type_id)
    .single()

  const senderName = type?.sender_name ?? 'Thiago Figueiredo'
  const senderEmail = type?.sender_email ?? 'newsletter@bythiagofigueiredo.com'
  const replyTo = type?.reply_to ?? undefined
  const maxBounceRate = type?.max_bounce_rate_pct ?? 5
  const typeName = type?.name ?? 'Newsletter'
  const typeColor = type?.color ?? '#ea580c'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  const fromDomain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'

  const { createHash } = await import('crypto')

  // For crash recovery: read existing tokens so we reuse them instead of generating orphans
  const subscriberEmails = unsent.map((s) => s.subscriber_email)
  const { data: existingTokens } = await supabase
    .from('unsubscribe_tokens')
    .select('email, token')
    .eq('site_id', edition.site_id)
    .in('email', subscriberEmails)

  const existingTokenMap = new Map<string, string>()
  for (const t of existingTokens ?? []) {
    existingTokenMap.set(t.email, t.token)
  }

  // Generate tokens only for subscribers who don't have one yet
  const tokenMap = new Map<string, string>()
  const newTokenRows: { site_id: string; email: string; token: string }[] = []

  for (const send of unsent) {
    const existingHash = existingTokenMap.get(send.subscriber_email)
    if (existingHash) {
      // We can't recover the raw token from the hash, but we can use a fresh token
      // and update the existing row
      const { randomUUID } = await import('crypto')
      const rawToken = randomUUID() + randomUUID().replace(/-/g, '')
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')
      tokenMap.set(send.subscriber_email, rawToken)
      // Update existing token with new hash
      await supabase.from('unsubscribe_tokens')
        .update({ token: tokenHash })
        .eq('site_id', edition.site_id)
        .eq('email', send.subscriber_email)
    } else {
      const { randomUUID } = await import('crypto')
      const rawToken = randomUUID() + randomUUID().replace(/-/g, '')
      const tokenHash = createHash('sha256').update(rawToken).digest('hex')
      tokenMap.set(send.subscriber_email, rawToken)
      newTokenRows.push({ site_id: edition.site_id, email: send.subscriber_email, token: tokenHash })
    }
  }

  if (newTokenRows.length > 0) {
    await supabase.from('unsubscribe_tokens')
      .upsert(newTokenRows, { onConflict: 'site_id,email', ignoreDuplicates: true })
  }

  const emailService = getEmailService()
  let sentCount = 0
  let errorCount = 0

  for (let i = 0; i < unsent.length; i += BATCH_SIZE) {
    const batch = unsent.slice(i, i + BATCH_SIZE)

    for (const send of batch) {
      try {
        const unsubToken = tokenMap.get(send.subscriber_email) ?? ''
        const unsubscribeUrl = `${appUrl}/api/newsletters/unsubscribe?token=${unsubToken}`
        const archiveUrl = `${appUrl}/newsletter/archive/${edition.id}`

        const html = await render(Newsletter({
          subject: edition.subject,
          preheader: edition.preheader ?? undefined,
          contentHtml: edition.content_html ?? `<p>${edition.content_mdx ?? edition.subject}</p>`,
          typeName,
          typeColor,
          unsubscribeUrl,
          archiveUrl,
        }))

        const result = await emailService.send({
          from: { name: senderName, email: senderEmail },
          to: send.subscriber_email,
          subject: edition.subject,
          html,
          metadata: {
            configurationSet: process.env.SES_MARKETING_CONFIG_SET ?? 'bythiago-marketing',
            headers: {
              'List-Unsubscribe': `<mailto:unsubscribe@${fromDomain}?subject=unsubscribe>, <${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          },
          ...(replyTo ? { replyTo } : {}),
        })

        await supabase.from('newsletter_sends').update({
          provider_message_id: result.messageId,
          status: 'sent',
        }).eq('id', send.id)

        sentCount++
        await sleep(THROTTLE_MS)
      } catch (err) {
        errorCount++
        Sentry.captureException(err, {
          tags: { component: 'cron', job: JOB, editionId: edition.id, sendId: send.id },
        })
      }
    }

    const totalAttempted = sentCount + errorCount
    if (totalAttempted >= 10 && (errorCount / totalAttempted) * 100 > maxBounceRate) {
      await supabase.from('newsletter_editions').update({ status: 'failed' }).eq('id', edition.id)
      return sentCount
    }
  }

  await supabase.from('newsletter_editions').update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    send_count: sentCount,
  }).eq('id', edition.id)

  await supabase.from('newsletter_types').update({
    last_sent_at: new Date().toISOString(),
  }).eq('id', edition.newsletter_type_id)

  return sentCount
}
