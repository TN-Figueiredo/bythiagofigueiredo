import { NextResponse } from 'next/server'
import { render } from '@react-email/render'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getEmailService } from '@/lib/email/service'
import { getProductionDeadline } from '@/lib/pipeline/get-production-deadline'
import { PipelineDeadlineDigest, type DeadlineItem } from '@/emails/pipeline-deadline-digest'
import type { Stage } from '@/lib/pipeline/up-next-constants'
import * as Sentry from '@sentry/nextjs'

export const runtime = 'nodejs'
export const maxDuration = 30

const TEMPLATE_NAME = 'pipeline-deadline-digest'
const MAX_DAYS_AHEAD = 3

export async function POST(req: Request): Promise<Response> {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseServiceClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bythiagofigueiredo.com'
  const domain = process.env.NEWSLETTER_FROM_DOMAIN ?? 'bythiagofigueiredo.com'
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const { data: items, error: itemsErr } = await supabase
    .from('content_pipeline')
    .select('id, title_pt, title_en, stage, format, scheduled_at, site_id')
    .eq('is_archived', false)
    .not('stage', 'in', '("published","scheduled")')
    .not('scheduled_at', 'is', null)

  if (itemsErr || !items?.length) {
    return NextResponse.json({ status: 'ok', sent: 0, reason: itemsErr ? 'query_error' : 'no_items' })
  }

  const deadlineItems: (DeadlineItem & { siteId: string })[] = []
  for (const item of items) {
    const pubDate = (item.scheduled_at as string).slice(0, 10)
    const deadline = getProductionDeadline(pubDate, item.stage as Stage)
    if (!deadline) continue

    const deadlineMs = new Date(deadline + 'T00:00:00Z').getTime()
    const todayMs = new Date(todayStr + 'T00:00:00Z').getTime()
    const daysUntil = Math.round((deadlineMs - todayMs) / 86_400_000)

    if (daysUntil > MAX_DAYS_AHEAD) continue

    deadlineItems.push({
      title: (item.title_pt as string || item.title_en as string) ?? 'Untitled',
      stage: item.stage as string,
      format: item.format as string,
      deadlineDate: deadline,
      pubDate,
      daysUntilDeadline: daysUntil,
      siteId: item.site_id as string,
    })
  }

  if (deadlineItems.length === 0) {
    return NextResponse.json({ status: 'ok', sent: 0, reason: 'no_deadlines' })
  }

  const bySite = new Map<string, typeof deadlineItems>()
  for (const item of deadlineItems) {
    const group = bySite.get(item.siteId) ?? []
    group.push(item)
    bySite.set(item.siteId, group)
  }

  let sentCount = 0
  let errorCount = 0

  for (const [siteId, siteItems] of bySite) {
    const { data: members } = await supabase
      .from('site_users')
      .select('user_id, users:auth_user_id(email)')
      .eq('site_id', siteId)
      .in('role', ['super_admin', 'org_admin', 'editor'])

    if (!members?.length) continue

    for (const member of members) {
      const email = (member as Record<string, unknown>).users as Record<string, string> | null
      const toEmail = email?.email
      if (!toEmail) continue

      const { count } = await supabase
        .from('sent_emails')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', siteId)
        .eq('to_email', toEmail)
        .eq('template_name', TEMPLATE_NAME)
        .gte('sent_at', `${todayStr}T00:00:00Z`)

      if (count && count > 0) continue

      try {
        const html = await render(
          PipelineDeadlineDigest({
            locale: 'pt-BR',
            items: siteItems,
            dashboardUrl: `${appUrl}/cms/pipeline`,
          })
        )

        const subject = siteItems.some(i => i.daysUntilDeadline < 0)
          ? 'Pipeline: itens atrasados'
          : 'Pipeline: prazos se aproximando'

        await getEmailService().send({
          from: { name: 'Pipeline CMS', email: `no-reply@${domain}` },
          to: toEmail,
          subject,
          html,
        })

        await supabase.from('sent_emails').insert({
          site_id: siteId,
          template_name: TEMPLATE_NAME,
          to_email: toEmail,
          subject,
          provider: 'ses',
          status: 'sent',
        })

        sentCount++
      } catch (err) {
        errorCount++
        Sentry.captureException(err, { tags: { cron: TEMPLATE_NAME } })
      }
    }
  }

  return NextResponse.json({ status: 'ok', sent: sentCount, errors: errorCount })
}
