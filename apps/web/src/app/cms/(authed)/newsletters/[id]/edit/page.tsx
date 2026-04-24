import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { StatusBadge, type StatusVariant } from '@tn-figueiredo/cms-ui/client'
import { saveEdition, sendTestEmail, scheduleEdition, cancelEdition } from '../../actions'

const ONE_HOUR_MS = 3_600_000

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
          <p className="text-sm text-cms-text-muted">
            {edition.newsletter_types?.name} ·{' '}
            <StatusBadge variant={edition.status as StatusVariant} pill />
          </p>
        </div>
        <div className="flex gap-2">
          {edition.status === 'draft' && (
            <form action={async () => {
              'use server'
              await sendTestEmail(id)
            }}>
              <button type="submit" className="rounded border px-3 py-1.5 text-sm hover:bg-cms-surface-hover">
                Send Test
              </button>
            </form>
          )}
          {['draft', 'ready'].includes(edition.status) && (
            <form action={async () => {
              'use server'
              await scheduleEdition(id, new Date(Date.now() + ONE_HOUR_MS).toISOString())
            }}>
              <button type="submit" className="rounded bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700">
                Schedule
              </button>
            </form>
          )}
          {!['sent', 'cancelled'].includes(edition.status) && (
            <form action={async () => {
              'use server'
              await cancelEdition(id)
            }}>
              <button type="submit" className="rounded border border-[rgba(239,68,68,.3)] px-3 py-1.5 text-sm text-cms-red hover:bg-[rgba(239,68,68,.05)]">
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
            <span className="text-sm text-cms-text-muted">
              Audience: ~{subscriberCount ?? 0} subscribers
            </span>
            <button type="submit" className="rounded bg-cms-accent px-4 py-2 text-sm text-white hover:opacity-90">
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
        <p className="text-xs text-[var(--cms-green,#22c55e)]">
          Test sent: {new Date(edition.test_sent_at).toLocaleString()}
        </p>
      )}
    </div>
  )
}
