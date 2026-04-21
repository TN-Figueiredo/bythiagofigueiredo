import Link from 'next/link'
import { getSupabaseServiceClient } from '../../../../../lib/supabase/service'
import { getSiteContext } from '../../../../../lib/cms/site-context'

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
    .select('id, subject, status, newsletter_type_id, slot_date, scheduled_at, sent_at, send_count, stats_opens, stats_delivered, created_at')
    .eq('site_id', ctx.siteId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (params.type) editionsQuery = editionsQuery.eq('newsletter_type_id', params.type)
  if (params.status) editionsQuery = editionsQuery.eq('status', params.status)

  const { data: editions } = await editionsQuery

  const statuses = ['draft', 'ready', 'queued', 'scheduled', 'sending', 'sent', 'failed', 'cancelled']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Newsletter Editions</h1>
        <Link
          href="/cms/newsletters/new"
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          data-testid="new-edition-btn"
        >
          New Edition
        </Link>
      </div>

      {/* Type cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(types ?? []).map((t) => (
          <Link
            key={t.id}
            href={`/cms/newsletters?type=${t.id}`}
            className="rounded-lg border p-4 hover:border-orange-400 transition-colors"
            style={{ borderLeftColor: t.color, borderLeftWidth: 4 }}
          >
            <div className="font-medium">{t.name}</div>
            <div className="text-sm text-gray-500">
              {t.cadence_paused ? 'Paused' : `Every ${t.cadence_days}d`}
              {' · '}
              {t.locale}
            </div>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <form className="flex gap-3">
        <select name="type" defaultValue={params.type ?? ''} className="rounded border px-3 py-1.5 text-sm">
          <option value="">All types</option>
          {(types ?? []).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <select name="status" defaultValue={params.status ?? ''} className="rounded border px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button type="submit" className="rounded bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200">
          Filter
        </button>
      </form>

      {/* Editions table */}
      <table className="w-full text-sm">
        <thead className="border-b text-left text-gray-500">
          <tr>
            <th className="pb-2">Subject</th>
            <th className="pb-2">Type</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">Slot</th>
            <th className="pb-2">Sent</th>
            <th className="pb-2">Opens</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(editions ?? []).map((e) => {
            const openRate = e.stats_delivered > 0
              ? Math.round((e.stats_opens / e.stats_delivered) * 100)
              : 0
            return (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="py-2">
                  <Link href={`/cms/newsletters/${e.id}/edit`} className="text-orange-600 hover:underline">
                    {e.subject}
                  </Link>
                </td>
                <td className="py-2">{e.newsletter_type_id}</td>
                <td className="py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    e.status === 'sent' ? 'bg-green-100 text-green-700' :
                    e.status === 'failed' ? 'bg-red-100 text-red-700' :
                    e.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {e.status}
                  </span>
                </td>
                <td className="py-2">{e.slot_date ?? '—'}</td>
                <td className="py-2">{e.send_count > 0 ? e.send_count : '—'}</td>
                <td className="py-2">{e.stats_delivered > 0 ? `${openRate}%` : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {(editions ?? []).length === 0 && (
        <p className="text-center text-gray-400 py-8">No editions yet. Create your first one!</p>
      )}
    </div>
  )
}
