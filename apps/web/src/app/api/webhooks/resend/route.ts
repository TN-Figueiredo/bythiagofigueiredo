import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import * as Sentry from '@sentry/nextjs'

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 400 })

  const body = await req.text()
  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  }

  let event: { type: string; data: Record<string, unknown> }
  try {
    const wh = new Webhook(secret)
    event = wh.verify(body, headers) as typeof event
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 })
  }

  const svixId = headers['svix-id']
  const supabase = getSupabaseServiceClient()

  // Idempotency check
  const { data: existing } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('idempotency_key', svixId)
    .maybeSingle()

  if (existing) return NextResponse.json({ ok: true, dedup: true })

  try {
    await processEvent(supabase, event)
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'webhook', provider: 'resend' } })
  }

  // Record for idempotency (best-effort)
  await supabase.from('webhook_events').insert({
    idempotency_key: svixId,
    event_type: event.type,
  }).then(() => {}, () => {})

  return NextResponse.json({ ok: true })
}

async function processEvent(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  event: { type: string; data: Record<string, unknown> },
) {
  const messageId = event.data.email_id as string | undefined
  if (!messageId) return

  // Look up the send row + edition's site_id for proper scoping
  const { data: send } = await supabase
    .from('newsletter_sends')
    .select('id, edition_id, subscriber_email, newsletter_editions(site_id, newsletter_type_id)')
    .eq('provider_message_id', messageId)
    .maybeSingle()

  if (!send) return // Not a newsletter email (transactional), ignore

  const editionData = Array.isArray(send.newsletter_editions)
    ? send.newsletter_editions[0] as { site_id: string; newsletter_type_id: string } | undefined
    : send.newsletter_editions as { site_id: string; newsletter_type_id: string } | null
  const siteId = editionData?.site_id
  const newsletterId = editionData?.newsletter_type_id

  // Check tracking consent — scoped to site
  const { data: sub } = await supabase
    .from('newsletter_subscriptions')
    .select('tracking_consent')
    .eq('email', send.subscriber_email)
    .eq('site_id', siteId ?? '')
    .maybeSingle()

  const trackPii = sub?.tracking_consent !== false

  switch (event.type) {
    case 'email.delivered':
      await supabase.from('newsletter_sends').update({
        status: 'delivered',
        delivered_at: event.data.created_at as string,
      }).eq('id', send.id)
      break

    case 'email.opened':
      await supabase.from('newsletter_sends').update({
        status: 'opened',
        opened_at: event.data.created_at as string,
        ...(trackPii ? {
          open_ip: event.data.ipAddress as string ?? null,
          open_user_agent: event.data.userAgent as string ?? null,
        } : {}),
      }).eq('id', send.id)
      break

    case 'email.clicked': {
      await supabase.from('newsletter_sends').update({
        status: 'clicked',
        clicked_at: event.data.created_at as string,
      }).eq('id', send.id)
      await supabase.from('newsletter_click_events').insert({
        send_id: send.id,
        url: event.data.link as string,
        ...(trackPii ? {
          ip: event.data.ipAddress as string ?? null,
          user_agent: event.data.userAgent as string ?? null,
        } : {}),
      })
      break
    }

    case 'email.bounced':
      await supabase.from('newsletter_sends').update({
        status: 'bounced',
        bounce_type: event.data.type as string,
      }).eq('id', send.id)
      if (event.data.type === 'Permanent' && siteId && newsletterId) {
        await supabase.from('newsletter_subscriptions').update({
          status: 'bounced',
        }).eq('email', send.subscriber_email)
          .eq('site_id', siteId)
          .eq('newsletter_id', newsletterId)
      }
      break

    case 'email.complained':
      await supabase.from('newsletter_sends').update({
        status: 'complained',
      }).eq('id', send.id)
      if (siteId && newsletterId) {
        await supabase.from('newsletter_subscriptions').update({
          status: 'complained',
        }).eq('email', send.subscriber_email)
          .eq('site_id', siteId)
          .eq('newsletter_id', newsletterId)
      }
      break
  }

  // Mark edition stats as stale
  await supabase.from('newsletter_editions').update({
    stats_stale: true,
  }).eq('id', send.edition_id)
}
