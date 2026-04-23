import Link from 'next/link'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { CmsTopbar } from '@/components/cms/cms-topbar'
import { CmsButton } from '@/components/cms/ui'
import { TypeCards } from './_components/type-cards'
import { EditionsTable } from './_components/editions-table'
import type { EditionRow } from './_components/editions-table'

export const dynamic = 'force-dynamic'

export default async function NewsletterDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>
}) {
  const ctx = await getSiteContext()
  const params = await searchParams
  const supabase = getSupabaseServiceClient()

  const { data: types } = await supabase
    .from('newsletter_types')
    .select('id, name, locale, color, cadence_days, last_sent_at, cadence_paused')
    .eq('active', true)
    .order('sort_order')

  let editionsQuery = supabase
    .from('newsletter_editions')
    .select(
      'id, subject, preheader, status, newsletter_type_id, slot_date, scheduled_at, sent_at, send_count, stats_opens, stats_delivered, stats_clicks, created_at'
    )
    .eq('site_id', ctx.siteId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (params.type) editionsQuery = editionsQuery.eq('newsletter_type_id', params.type)
  if (params.status) editionsQuery = editionsQuery.eq('status', params.status)

  const { data: editions } = await editionsQuery

  const typeMap = new Map(
    (types ?? []).map((t) => [t.id, { name: t.name, color: t.color }])
  )

  const mappedTypes = (types ?? []).map((t) => {
    const typeEditions = (editions ?? []).filter((e) => e.newsletter_type_id === t.id)
    const sentEditions = typeEditions.filter((e) => e.status === 'sent')
    const totalOpens = sentEditions.reduce((sum, e) => sum + (e.stats_opens ?? 0), 0)
    const totalDelivered = sentEditions.reduce((sum, e) => sum + (e.stats_delivered ?? 0), 0)
    const avgOpenRate = totalDelivered > 0 ? Math.round((totalOpens / totalDelivered) * 100) : 0

    return {
      id: t.id,
      name: t.name,
      color: t.color ?? '#6366f1',
      subscribers: 0,
      avgOpenRate,
      lastSent: t.last_sent_at
        ? new Date(t.last_sent_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })
        : null,
      cadence: t.cadence_days ? `Every ${t.cadence_days}d` : 'Manual',
      editionCount: typeEditions.length,
      isPaused: t.cadence_paused ?? false,
    }
  })

  const mappedEditions: EditionRow[] = (editions ?? []).map((e) => {
    const typeInfo = typeMap.get(e.newsletter_type_id)
    return {
      id: e.id,
      subject: e.subject,
      preheader: e.preheader,
      status: e.status,
      typeName: typeInfo?.name ?? 'Unknown',
      typeColor: typeInfo?.color ?? '#71717a',
      newsletter_type_id: e.newsletter_type_id,
      sendCount: e.send_count ?? 0,
      statsDelivered: e.stats_delivered ?? 0,
      statsOpens: e.stats_opens ?? 0,
      statsClicks: e.stats_clicks ?? 0,
      sentAt: e.sent_at,
      scheduledAt: e.scheduled_at,
      createdAt: e.created_at,
    }
  })

  return (
    <div>
      <CmsTopbar
        title="Newsletters"
        actions={
          <Link href="/cms/newsletters/new">
            <CmsButton variant="primary" size="sm">
              + New Edition
            </CmsButton>
          </Link>
        }
      />
      <div className="p-6 lg:p-8 space-y-6">
        <TypeCards
          types={mappedTypes}
          selectedTypeId={params.type ?? null}
          onSelect={() => {}}
        />

        <div className="flex items-center gap-1 text-xs">
          {['all', 'draft', 'ready', 'scheduled', 'sending', 'sent', 'failed'].map((s) => {
            const isActive = (params.status ?? 'all') === s
            return (
              <Link
                key={s}
                href={`/cms/newsletters?${new URLSearchParams({
                  ...(params.type ? { type: params.type } : {}),
                  ...(s !== 'all' ? { status: s } : {}),
                }).toString()}`}
                className={`rounded-full px-3 py-1.5 font-medium capitalize transition-colors ${
                  isActive
                    ? 'bg-cms-accent text-white'
                    : 'text-cms-text-muted hover:bg-cms-surface-hover hover:text-cms-text'
                }`}
              >
                {s}
              </Link>
            )
          })}
        </div>

        <EditionsTable editions={mappedEditions} />
      </div>
    </div>
  )
}
