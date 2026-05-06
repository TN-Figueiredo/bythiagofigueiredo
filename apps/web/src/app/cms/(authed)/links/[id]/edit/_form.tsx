'use client'

import { useRouter } from 'next/navigation'
import { LinkForm } from '@tn-figueiredo/links-admin/client'
import type { LinkFormData } from '@tn-figueiredo/links-admin/client'
import { handleUpdate } from './actions'

interface EditLinkFormProps {
  linkId: string
  siteId: string
  initial: {
    destination_url: string
    title: string
    slug: string
    source_type: string
    redirect_type: number
    utm_source: string
    utm_medium: string
    utm_campaign: string
    utm_term: string
    utm_content: string
    expires_at: string
    tags: string[]
  }
}

export function EditLinkForm({ linkId, siteId, initial }: EditLinkFormProps) {
  const router = useRouter()

  const linkData: LinkFormData & { id: string } = {
    id: linkId,
    destination_url: initial.destination_url,
    title: initial.title,
    slug: initial.slug,
    source_type: initial.source_type as LinkFormData['source_type'],
    redirect_type: initial.redirect_type as 301 | 302,
    active: true,
    tags: initial.tags,
    utm_source: initial.utm_source,
    utm_medium: initial.utm_medium,
    utm_campaign: initial.utm_campaign,
    utm_term: initial.utm_term,
    utm_content: initial.utm_content,
    expires_at: initial.expires_at,
    click_limit: null,
    password: '',
  }

  async function handleSubmit(data: LinkFormData): Promise<{ ok: boolean; error?: string }> {
    const result = await handleUpdate(linkId, {
      destination_url: data.destination_url,
      title: data.title || undefined,
      slug: data.slug || null,
      source_type: data.source_type,
      utm_source: data.utm_source || undefined,
      utm_medium: data.utm_medium || undefined,
      utm_campaign: data.utm_campaign || undefined,
      utm_term: data.utm_term || undefined,
      utm_content: data.utm_content || undefined,
      tags: data.tags.length > 0 ? data.tags : undefined,
      expires_at: data.expires_at || null,
    })
    if (!result.ok) return { ok: false, error: result.error }
    router.push(`/cms/links/${linkId}`)
    return { ok: true }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-foreground">Edit Link</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Update link settings and tracking parameters.
        </p>
      </div>
      <LinkForm
        link={linkData}
        siteId={siteId}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/cms/links/${linkId}`)}
      />
    </div>
  )
}
