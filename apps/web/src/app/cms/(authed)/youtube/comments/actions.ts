'use server'

import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

async function requireEditAccess(): Promise<string> {
  const { siteId } = await getSiteContext()
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  return siteId
}

const CommentSchema = z.object({
  video_id: z.string().uuid(),
  author_handle: z.string().min(1),
  author_avatar_url: z.string().nullable().optional(),
  text_pt: z.string().min(1),
  text_en: z.string().min(1),
  like_count: z.number().int().min(0),
  target_locale: z.enum(['pt', 'en']).nullable(),
  published_at: z.string().nullable().optional(),
})

export async function createComment(input: z.infer<typeof CommentSchema>) {
  const siteId = await requireEditAccess()
  const parsed = CommentSchema.parse(input)
  const supabase = getSupabaseServiceClient()

  const { data: maxOrder } = await supabase
    .from('youtube_curated_comments')
    .select('display_order')
    .eq('site_id', siteId)
    .order('display_order', { ascending: false })
    .limit(1)
    .single()

  const { error } = await supabase.from('youtube_curated_comments').insert({
    ...parsed, site_id: siteId, display_order: (maxOrder?.display_order ?? 0) + 1,
  })

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  revalidatePath('/cms/youtube/comments')
  return { ok: true as const }
}

export async function updateComment(id: string, input: Partial<z.infer<typeof CommentSchema>>) {
  const siteId = await requireEditAccess()
  const parsed = CommentSchema.partial().parse(input)
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('youtube_curated_comments')
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq('id', id).eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  revalidatePath('/cms/youtube/comments')
  return { ok: true as const }
}

export async function deleteComment(id: string) {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('youtube_curated_comments')
    .delete().eq('id', id).eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  revalidatePath('/cms/youtube/comments')
  return { ok: true as const }
}

export async function reorderComments(orderedIds: string[]) {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  for (let i = 0; i < orderedIds.length; i++) {
    await supabase.from('youtube_curated_comments')
      .update({ display_order: i })
      .eq('id', orderedIds[i]).eq('site_id', siteId)
  }

  revalidateTag('youtube')
  revalidatePath('/cms/youtube/comments')
  return { ok: true as const }
}
