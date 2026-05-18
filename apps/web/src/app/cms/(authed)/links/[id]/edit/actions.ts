'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { updateLink } from '../../actions'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function handleUpdate(
  id: string,
  input: {
    destination_url?: string
    title?: string
    slug?: string | null
    source_type?: 'manual' | 'campaign' | 'newsletter' | 'blog' | 'social' | 'print'
    utm_source?: string
    utm_medium?: string
    utm_campaign?: string
    utm_term?: string
    utm_content?: string
    utm_id?: string
    tags?: string[]
    expires_at?: string | null
    activates_at?: string | null
    pass_click_ids?: boolean
    redirect_type?: 301 | 302 | 307 | 308
  },
): Promise<ActionResult> {
  if (!id) return { ok: false, error: 'id_required' }

  const result = await updateLink(id, input)

  if (result.ok) {
    revalidatePath(`/cms/links/${id}`)
    revalidatePath(`/cms/links/${id}/edit`)
    revalidateTag(`link:${id}`)
  }

  return result
}
