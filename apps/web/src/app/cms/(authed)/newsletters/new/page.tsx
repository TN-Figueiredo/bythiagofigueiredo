import { redirect } from 'next/navigation'
import { getSupabaseServiceClient } from '../../../../../../lib/supabase/service'
import { getSiteContext } from '../../../../../../lib/cms/site-context'

export const dynamic = 'force-dynamic'

export default async function NewEditionPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const ctx = await getSiteContext()
  const params = await searchParams
  const supabase = getSupabaseServiceClient()

  // Use the first active type if none specified
  let typeId = params.type
  if (!typeId) {
    const { data: types } = await supabase
      .from('newsletter_types')
      .select('id')
      .eq('active', true)
      .order('sort_order')
      .limit(1)
    typeId = types?.[0]?.id
  }
  if (!typeId) throw new Error('No newsletter type available')

  const { data, error } = await supabase
    .from('newsletter_editions')
    .insert({
      site_id: ctx.siteId,
      newsletter_type_id: typeId,
      subject: 'Untitled Edition',
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  redirect(`/cms/newsletters/${data.id}/edit`)
}
