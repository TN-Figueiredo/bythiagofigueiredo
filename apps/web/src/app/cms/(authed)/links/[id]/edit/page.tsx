export const metadata = { title: 'Editar' }

import { notFound, redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { EditLinkForm } from './_form'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditLinkPage({ params }: Props) {
  const { id } = await params
  const { siteId } = await getSiteContext()

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!authRes.ok) redirect('/cms')

  const supabase = getSupabaseServiceClient()

  const { data: link, error } = await supabase
    .from('tracked_links')
    .select('*')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (error || !link) notFound()
  if (link.deleted_at) notFound()

  return (
    <EditLinkForm
      linkId={id}
      siteId={siteId}
      initial={{
        destination_url: (link.destination_url as string) ?? '',
        title: (link.title as string) ?? '',
        slug: (link.slug as string) ?? '',
        source_type: (link.source_type as string) ?? 'manual',
        redirect_type: (link.redirect_type as number) ?? 302,
        utm_source: (link.utm_source as string) ?? '',
        utm_medium: (link.utm_medium as string) ?? '',
        utm_campaign: (link.utm_campaign as string) ?? '',
        utm_term: (link.utm_term as string) ?? '',
        utm_content: (link.utm_content as string) ?? '',
        expires_at: (link.expires_at as string) ?? '',
        tags: (link.tags as string[]) ?? [],
        code: (link.code as string) ?? '',
      }}
    />
  )
}
