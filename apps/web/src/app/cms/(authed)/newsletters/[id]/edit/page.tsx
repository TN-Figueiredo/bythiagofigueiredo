import { notFound } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { EditionEditor } from './edition-editor'

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

  const { data: types } = await supabase
    .from('newsletter_types')
    .select('id, name, color')
    .eq('site_id', ctx.siteId)
    .eq('active', true)
    .order('sort_order')

  return (
    <div className="p-6 lg:p-8">
      <EditionEditor
        edition={{
          id: edition.id,
          subject: edition.subject,
          preheader: edition.preheader,
          content_json: edition.content_json,
          content_html: edition.content_html,
          status: edition.status,
          notes: edition.notes,
          newsletter_type_id: edition.newsletter_type_id,
          newsletter_types: edition.newsletter_types,
          segment: edition.segment,
          web_archive_enabled: edition.web_archive_enabled ?? true,
        }}
        subscriberCount={subscriberCount ?? 0}
        types={(types ?? []).map((t) => ({
          id: t.id as string,
          name: t.name as string,
          color: (t.color ?? '#7c3aed') as string,
        }))}
      />
    </div>
  )
}
