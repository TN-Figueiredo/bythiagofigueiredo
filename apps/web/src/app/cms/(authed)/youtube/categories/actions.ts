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

const CategorySchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  name_pt: z.string().min(1),
  name_en: z.string().min(1),
  description_pt: z.string().nullable().optional(),
  description_en: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  match_keywords: z.array(z.string()),
  auto_approve: z.boolean(),
})

export async function createCategory(input: z.infer<typeof CategorySchema>) {
  const siteId = await requireEditAccess()
  const parsed = CategorySchema.parse(input)
  const supabase = getSupabaseServiceClient()

  const { data: maxOrder } = await supabase
    .from('youtube_categories')
    .select('sort_order')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const { error } = await supabase.from('youtube_categories').insert({
    ...parsed, site_id: siteId, sort_order: (maxOrder?.sort_order ?? 0) + 1,
  })

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  revalidatePath('/cms/youtube/categories')
  return { ok: true as const }
}

export async function updateCategory(id: string, input: z.infer<typeof CategorySchema>) {
  const siteId = await requireEditAccess()
  const parsed = CategorySchema.parse(input)
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('youtube_categories')
    .update({ ...parsed, updated_at: new Date().toISOString() })
    .eq('id', id).eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  revalidatePath('/cms/youtube/categories')
  return { ok: true as const }
}

export async function deleteCategory(id: string) {
  const siteId = await requireEditAccess()
  const supabase = getSupabaseServiceClient()

  const { error } = await supabase.from('youtube_categories')
    .delete().eq('id', id).eq('site_id', siteId)

  if (error) return { ok: false as const, error: error.message }
  revalidateTag('youtube')
  revalidateTag('layout-counts')
  revalidatePath('/cms/youtube/categories')
  return { ok: true as const }
}
