'use client'

import { useRouter } from 'next/navigation'
import { LinkForm } from '@tn-figueiredo/links-admin/client'
import type { LinkFormData } from '@tn-figueiredo/links-admin/client'
import { createLink } from '../actions'

interface Props {
  siteId: string
}

export function NewLinkFormWrapper({ siteId }: Props) {
  const router = useRouter()

  async function handleSubmit(data: LinkFormData): Promise<{ ok: boolean; error?: string }> {
    const result = await createLink({
      destination_url: data.destination_url,
      title: data.title || undefined,
      slug: data.slug || undefined,
      redirect_type: String(data.redirect_type) as '301' | '302' | '307' | '308',
      source_type: data.source_type,
      utm_source: data.utm_source || undefined,
      utm_medium: data.utm_medium || undefined,
      utm_campaign: data.utm_campaign || undefined,
      utm_term: data.utm_term || undefined,
      utm_content: data.utm_content || undefined,
      utm_id: data.utm_id || undefined,
      tags: data.tags.length > 0 ? data.tags : undefined,
      expires_at: data.expires_at || undefined,
      activates_at: data.activates_at || undefined,
      pass_click_ids: data.pass_click_ids,
    })

    if (!result.ok) return { ok: false, error: result.error }
    router.push(`/cms/links/${result.linkId}`)
    return { ok: true }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-foreground">Create Link</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Create a new tracked short link.
        </p>
      </div>
      <LinkForm
        siteId={siteId}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/cms/links')}
      />
    </div>
  )
}
