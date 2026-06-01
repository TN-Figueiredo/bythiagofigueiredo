'use server'

import { revalidatePath } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { put } from '@vercel/blob'

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error('forbidden')
  return siteId
}

export async function uploadToLibrary(
  formData: FormData,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false, error: 'forbidden' } }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) return { ok: false, error: 'No file' }

  const title = formData.get('title') as string | null
  const tags = (formData.get('tags') as string | null)?.split(',').map(t => t.trim()).filter(Boolean) ?? []

  const blob = await put(`thumbnails/library/${Date.now()}-${file.name}`, file, { access: 'public' })

  const supabase = getSupabaseServiceClient()
  const { data, error } = await supabase
    .from('thumbnail_library')
    .insert({
      site_id: siteId,
      source_type: 'manual_upload',
      blob_url: blob.url,
      title: title || file.name,
      tags,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/youtube/ab-lab/library')
  return { ok: true, id: data?.id }
}

export async function updateLibraryTags(
  id: string,
  tags: string[],
): Promise<{ ok: boolean }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }

  const supabase = getSupabaseServiceClient()
  await supabase
    .from('thumbnail_library')
    .update({ tags })
    .eq('id', id)
    .eq('site_id', siteId)

  revalidatePath('/cms/youtube/ab-lab/library')
  return { ok: true }
}

export async function deleteFromLibrary(id: string): Promise<{ ok: boolean }> {
  let siteId: string
  try { siteId = await requireEditAccess() } catch { return { ok: false } }

  const supabase = getSupabaseServiceClient()

  const { data: entry } = await supabase
    .from('thumbnail_library')
    .select('blob_url, source_type')
    .eq('id', id)
    .eq('site_id', siteId)
    .single()

  if (entry?.blob_url && entry.source_type === 'manual_upload') {
    const { del } = await import('@vercel/blob')
    await del(entry.blob_url).catch(() => {})
  }

  await supabase.from('thumbnail_library').delete().eq('id', id).eq('site_id', siteId)
  revalidatePath('/cms/youtube/ab-lab/library')
  return { ok: true }
}
