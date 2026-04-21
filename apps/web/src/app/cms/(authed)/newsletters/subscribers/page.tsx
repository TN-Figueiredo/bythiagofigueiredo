import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

export const dynamic = 'force-dynamic'

export default async function SubscribersPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; page?: string }>
}) {
  const ctx = await getSiteContext()
  const params = await searchParams
  const page = parseInt(params.page ?? '1', 10)
  const perPage = 50
  const offset = (page - 1) * perPage
  const supabase = getSupabaseServiceClient()

  let query = supabase
    .from('newsletter_subscriptions')
    .select('id, email, status, newsletter_id, subscribed_at, confirmed_at, tracking_consent, welcome_sent', { count: 'exact' })
    .eq('site_id', ctx.siteId)
    .order('subscribed_at', { ascending: false })
    .range(offset, offset + perPage - 1)

  if (params.type) query = query.eq('newsletter_id', params.type)
  if (params.status) query = query.eq('status', params.status)

  const { data: subs, count } = await query

  const totalPages = Math.ceil((count ?? 0) / perPage)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Subscribers</h1>
      <p className="text-sm text-gray-500">{count ?? 0} total</p>

      <form className="flex gap-3">
        <select name="status" defaultValue={params.status ?? ''} className="rounded border px-3 py-1.5 text-sm">
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending_confirmation">Pending</option>
          <option value="unsubscribed">Unsubscribed</option>
          <option value="bounced">Bounced</option>
          <option value="complained">Complained</option>
        </select>
        <button type="submit" className="rounded bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200">Filter</button>
      </form>

      <table className="w-full text-sm">
        <thead className="border-b text-left text-gray-500">
          <tr>
            <th className="pb-2">Email</th>
            <th className="pb-2">Newsletter</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">Tracking</th>
            <th className="pb-2">Subscribed</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(subs ?? []).map((s) => (
            <tr key={s.id}>
              <td className="py-2 font-mono text-xs">{s.email}</td>
              <td className="py-2">{s.newsletter_id}</td>
              <td className="py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${
                  s.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                  s.status === 'bounced' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {s.status}
                </span>
              </td>
              <td className="py-2">{s.tracking_consent ? 'On' : 'Off'}</td>
              <td className="py-2 text-gray-500">{new Date(s.subscribed_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => (
            <a
              key={i}
              href={`/cms/newsletters/subscribers?page=${i + 1}${params.status ? `&status=${params.status}` : ''}`}
              className={`rounded px-3 py-1 text-sm ${page === i + 1 ? 'bg-orange-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              {i + 1}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
