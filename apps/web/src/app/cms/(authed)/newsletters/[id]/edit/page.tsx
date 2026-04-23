import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { saveEdition, sendTestEmail, scheduleEdition, cancelEdition } from '../../actions'

export const dynamic = 'force-dynamic'

export default async function EditEditionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  const { data: edition } = await supabase
    .from('newsletter_editions')
    .select('*, newsletter_types(name, color, sender_name, sender_email)')
    .eq('id', id)
    .maybeSingle()

  if (!edition || edition.site_id !== ctx.siteId) return notFound()

  const { count: subscriberCount } = await supabase
    .from('newsletter_subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('newsletter_id', edition.newsletter_type_id)
    .eq('status', 'confirmed')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{edition.subject || 'Untitled'}</h1>
          <p className="text-sm text-gray-500">
            {edition.newsletter_types?.name} ·{' '}
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              edition.status === 'sent' ? 'bg-green-100 text-green-700' :
              edition.status === 'draft' ? 'bg-gray-100 text-gray-600' :
              'bg-blue-100 text-blue-700'
            }`}>
              {edition.status}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {edition.status === 'draft' && (
            <form action={async () => {
              'use server'
              await sendTestEmail(id)
            }}>
              <button className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
                Send Test
              </button>
            </form>
          )}
          {['draft', 'ready'].includes(edition.status) && (
            <form action={async () => {
              'use server'
              await scheduleEdition(id, new Date(Date.now() + 3600_000).toISOString())
            }}>
              <button className="rounded bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700">
                Schedule
              </button>
            </form>
          )}
          {!['sent', 'cancelled'].includes(edition.status) && (
            <form action={async () => {
              'use server'
              await cancelEdition(id)
            }}>
              <button className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50">
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Editor form */}
      <form action={async (formData: FormData) => {
        'use server'
        await saveEdition(id, {
          subject: formData.get('subject') as string,
          preheader: formData.get('preheader') as string,
          content_mdx: formData.get('content_mdx') as string,
        })
      }}>
        <div className="space-y-4">
          <div>
            <label htmlFor="subject" className="block text-sm font-medium mb-1">Subject</label>
            <input
              id="subject"
              name="subject"
              defaultValue={edition.subject}
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="preheader" className="block text-sm font-medium mb-1">Preheader</label>
            <input
              id="preheader"
              name="preheader"
              defaultValue={edition.preheader ?? ''}
              placeholder="Preview text shown in inbox..."
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="content_mdx" className="block text-sm font-medium mb-1">Content (MDX)</label>
            <textarea
              id="content_mdx"
              name="content_mdx"
              defaultValue={edition.content_mdx ?? ''}
              rows={20}
              className="w-full rounded border px-3 py-2 font-mono text-sm"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Audience: ~{subscriberCount ?? 0} subscribers
            </span>
            <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
              Save Draft
            </button>
          </div>
        </div>
      </form>

      {/* Preview iframe */}
      {edition.content_html && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Preview</h2>
          <iframe
            src={`/api/newsletters/${id}/preview`}
            className="w-full rounded border"
            style={{ height: 600 }}
            title="Newsletter Preview"
          />
        </div>
      )}

      {/* Test send gate */}
      {edition.test_sent_at && (
        <p className="text-xs text-green-600">
          Test sent: {new Date(edition.test_sent_at).toLocaleString()}
        </p>
      )}
    </div>
  )
}
