import { redirect } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { LinkForm } from '@tn-figueiredo/links-admin/client'
import type { LinkFormData } from '@tn-figueiredo/links-admin/client'
import { createLink } from '../actions'

export const dynamic = 'force-dynamic'

export default async function NewLinkPage() {
  const { siteId } = await getSiteContext()

  if (process.env.NEXT_PUBLIC_LINKS_ENABLED !== 'true') redirect('/cms')

  const authRes = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!authRes.ok) redirect('/cms')

  async function handleCreate(data: LinkFormData) {
    'use server'
    const result = await createLink({
      destination_url: data.destination_url,
      title: data.title || undefined,
      code: data.slug || undefined,
      redirect_type: String(data.redirect_type) as '301' | '302',
      source_type: data.source_type,
      utm_source: data.utm_source || undefined,
      utm_medium: data.utm_medium || undefined,
      utm_campaign: data.utm_campaign || undefined,
      utm_term: data.utm_term || undefined,
      utm_content: data.utm_content || undefined,
      tags: data.tags.length > 0 ? data.tags : undefined,
      expires_at: data.expires_at || undefined,
    })
    if (!result.ok) {
      return { ok: false as const, error: result.error }
    }
    redirect(`/cms/links/${result.linkId}`)
  }

  function handleCancel() {
    redirect('/cms/links')
  }

  return (
    <LinkForm
      onSubmit={handleCreate}
      onCancel={handleCancel}
      siteId={siteId}
    />
  )
}
