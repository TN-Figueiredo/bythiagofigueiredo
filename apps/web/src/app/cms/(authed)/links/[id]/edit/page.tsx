import { notFound, redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { LinkForm } from '@tn-figueiredo/links-admin/client'
import type { LinkFormData } from '@tn-figueiredo/links-admin/client'
import { handleUpdate } from './actions'

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

  async function onSubmit(data: LinkFormData) {
    'use server'
    const result = await handleUpdate(id, {
      destination_url: data.destination_url,
      title: data.title || undefined,
      slug: data.slug || null,
      source_type: data.source_type,
      utm_source: data.utm_source || undefined,
      utm_medium: data.utm_medium || undefined,
      utm_campaign: data.utm_campaign || undefined,
      utm_term: data.utm_term || undefined,
      utm_content: data.utm_content || undefined,
      tags: data.tags,
      expires_at: data.expires_at || null,
    })
    if (!result.ok) {
      return { ok: false as const, error: result.error }
    }
    redirect(`/cms/links/${id}`)
  }

  async function handleCancel() {
    'use server'
    redirect(`/cms/links/${id}`)
  }

  return (
    <LinkForm
      link={{
        id: link.id as string,
        destination_url: link.destination_url as string,
        title: (link.title as string) ?? '',
        slug: (link.slug as string) ?? '',
        source_type: (link.source_type as LinkFormData['source_type']) ?? 'manual',
        redirect_type: (link.redirect_type as 301 | 302) ?? 302,
        active: link.active as boolean,
        tags: (link.tags as string[]) ?? [],
        utm_source: (link.utm_source as string) ?? '',
        utm_medium: (link.utm_medium as string) ?? '',
        utm_campaign: (link.utm_campaign as string) ?? '',
        utm_term: (link.utm_term as string) ?? '',
        utm_content: (link.utm_content as string) ?? '',
        expires_at: (link.expires_at as string) ?? '',
        click_limit: (link.click_limit as number) ?? null,
        password: '',
      }}
      onSubmit={onSubmit}
      onCancel={handleCancel}
      siteId={siteId}
    />
  )
}
