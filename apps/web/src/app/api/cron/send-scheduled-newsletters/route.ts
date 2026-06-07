import { revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { withCronLock, newRunId } from '../../../../../lib/logger'
import { getEmailService } from '../../../../../lib/email/service'
import { generateUnsubscribeToken } from '../../../../../lib/newsletter/confirm-email'
import { render } from '@react-email/render'
import { Newsletter } from '../../../../emails/newsletter'
import * as Sentry from '@sentry/nextjs'
import { rewriteLinksForTracking, rewriteLinksUnified } from '../../../../../lib/newsletter/link-tracking'
import { sanitizeForEmail } from '../../../../../lib/newsletter/email-sanitizer'

export const maxDuration = 300

const JOB = 'send-scheduled-newsletters'
const LOCK_KEY = 'cron:send-newsletters'
const BATCH_SIZE = 100
const THROTTLE_MS = 50
const SUBSCRIBER_PAGE_SIZE = 500

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
    // ── Stuck-edition recovery ───────────────────────────────────────────
    // Editions stuck in 'sending' for >2h are likely from a crashed run.
    // Reset them to 'scheduled' so they get retried on the next cycle.
    try {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      const { data: stuck } = await supabase
        .from('newsletter_editions')
        .update({ status: 'scheduled' })
        .eq('status', 'sending')
        .lt('updated_at', twoHoursAgo)
        .select('id')
      if (stuck?.length) {
        Sentry.captureMessage(`Recovered ${stuck.length} stuck edition(s)`, {
          level: 'warning',
          tags: { component: 'cron', job: JOB },
          extra: { editionIds: stuck.map((e) => e.id) },
        })
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: 'cron', job: JOB, phase: 'stuck_recovery' },
      })
    }

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

// Vercel Cron invokes endpoints via GET. Alias so the Vercel scheduler can
// trigger this job (it previously only ran via pg_cron POST, which was never
// registered for this route — so it never fired).
export const GET = POST

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

  // Paginated fetch — Supabase silently truncates at max_rows (1000).
  const subscribers: Array<{ email: string; locale: string | null }> = []
  let offset = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: page } = await supabase
      .from('newsletter_subscriptions')
      .select('email, locale')
      .eq('newsletter_id', edition.newsletter_type_id)
      .eq('site_id', edition.site_id)
      .eq('status', 'confirmed')
      .range(offset, offset + SUBSCRIBER_PAGE_SIZE - 1)
    if (!page?.length) break
    subscribers.push(...page)
    if (page.length < SUBSCRIBER_PAGE_SIZE) break
    offset += SUBSCRIBER_PAGE_SIZE
  }

  if (!subscribers.length) {
    await supabase.from('newsletter_editions').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      send_count: 0,
    }).eq('id', edition.id)
    return 0
  }

  const subscriberLocaleMap = new Map<string, string | null>()
  for (const s of subscribers) {
    subscriberLocaleMap.set(s.email, s.locale ?? null)
  }

  const sendRows = subscribers.map((s) => ({
    edition_id: edition.id,
    subscriber_email: s.email,
    status: 'queued',
  }))

  // Chunk upsert into pages of 500 to avoid PostgREST body-size limits.
  const UPSERT_PAGE = 500
  for (let u = 0; u < sendRows.length; u += UPSERT_PAGE) {
    await supabase.from('newsletter_sends').upsert(
      sendRows.slice(u, u + UPSERT_PAGE),
      { onConflict: 'edition_id,subscriber_email', ignoreDuplicates: true },
    )
  }

  // Paginated fetch of unsent rows — Supabase silently truncates at max_rows (1000).
  const unsent: Array<{ id: string; subscriber_email: string }> = []
  let unsentOffset = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: unsentPage } = await supabase
      .from('newsletter_sends')
      .select('id, subscriber_email')
      .eq('edition_id', edition.id)
      .is('provider_message_id', null)
      .range(unsentOffset, unsentOffset + SUBSCRIBER_PAGE_SIZE - 1)
    if (!unsentPage?.length) break
    unsent.push(...unsentPage)
    if (unsentPage.length < SUBSCRIBER_PAGE_SIZE) break
    unsentOffset += SUBSCRIBER_PAGE_SIZE
  }

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
  const typeColor = type?.color ?? '#FF8240'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  const fromDomain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'

  const shortDomain: string | null = process.env.LINKS_SHORT_DOMAIN ?? null

  // Derive a campaign slug from the edition subject (best effort, url-safe).
  const campaignSlug = edition.subject
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)

  const tokenRows: { site_id: string; email: string; token_hash: string }[] = []
  const tokenMap = new Map<string, string>()

  for (const send of unsent) {
    const { raw, hash } = generateUnsubscribeToken(edition.site_id, send.subscriber_email)
    tokenMap.set(send.subscriber_email, raw)
    tokenRows.push({ site_id: edition.site_id, email: send.subscriber_email, token_hash: hash })
  }

  if (tokenRows.length > 0) {
    await supabase.from('unsubscribe_tokens')
      .upsert(tokenRows, { onConflict: 'site_id,email', ignoreDuplicates: false })
  }

  // ── Pre-render template ONCE with placeholder tokens ──────────────────
  // sanitizeForEmail + Newsletter + render produce identical output for every
  // subscriber (only unsubscribeUrl and archiveUrl differ). Doing this once
  // changes O(n) renders to O(1), raising the ceiling from ~750 to ~5000+.
  const UNSUB_PLACEHOLDER = '__UNSUB_URL__'
  const ARCHIVE_PLACEHOLDER = '__ARCHIVE_URL__'

  const sanitizedContent = sanitizeForEmail(
    edition.content_html ?? `<p>${edition.content_mdx ?? edition.subject}</p>`,
    typeColor,
  )

  const newsletterTemplate = Newsletter({
    subject: edition.subject,
    preheader: edition.preheader ?? undefined,
    contentHtml: sanitizedContent,
    typeName,
    typeColor,
    unsubscribeUrl: UNSUB_PLACEHOLDER,
    archiveUrl: ARCHIVE_PLACEHOLDER,
  })
  let preRenderedHtml = await render(newsletterTemplate)
  const preRenderedText = await render(newsletterTemplate, { plainText: true })

  // Apply link rewriting ONCE on the pre-rendered HTML (with placeholder unsub URL).
  if (shortDomain) {
    const rewriteResult = await rewriteLinksUnified({
      html: preRenderedHtml,
      supabase,
      siteId: edition.site_id,
      editionId: edition.id,
      shortDomain,
      campaignSlug,
    })
    preRenderedHtml = rewriteResult.html
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
        const subscriberLocale = subscriberLocaleMap.get(send.subscriber_email) ?? null
        const localePrefix = subscriberLocale === 'pt-BR' ? '/pt' : ''
        const archiveUrl = `${appUrl}${localePrefix}/newsletter/archive/${edition.id}`

        // Fast per-subscriber string replacement instead of full render.
        let html = preRenderedHtml
          .replace(/__UNSUB_URL__/g, unsubscribeUrl)
          .replace(/__ARCHIVE_URL__/g, archiveUrl)
        const text = preRenderedText
          .replace(/__UNSUB_URL__/g, unsubscribeUrl)
          .replace(/__ARCHIVE_URL__/g, archiveUrl)

        // Legacy path: per-subscriber click-tracking rewrite (only when no shortDomain).
        if (!shortDomain) {
          html = rewriteLinksForTracking(html, send.id, appUrl)
        }

        const result = await emailService.send({
          from: { name: senderName, email: senderEmail },
          to: send.subscriber_email,
          subject: edition.subject,
          html,
          text,
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
          // Record which pipeline was used — the webhook handler reads this.
          link_rewrite_enabled: shortDomain !== null,
        } as Record<string, unknown>).eq('id', send.id)

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

  // Query actual sent count from DB — after crash-resume sentCount only
  // reflects the current run, so we ask the DB for the true total.
  const { count: totalSentCount } = await supabase
    .from('newsletter_sends')
    .select('id', { count: 'exact', head: true })
    .eq('edition_id', edition.id)
    .not('provider_message_id', 'is', null)

  await supabase.from('newsletter_editions').update({
    status: 'sent',
    sent_at: new Date().toISOString(),
    send_count: totalSentCount ?? sentCount,
  }).eq('id', edition.id)

  await supabase.from('newsletter_types').update({
    last_sent_at: new Date().toISOString(),
  }).eq('id', edition.newsletter_type_id)

  return sentCount
}
