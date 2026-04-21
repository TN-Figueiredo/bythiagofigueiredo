'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'

type ActionResult = { ok: true } | { ok: false; error: string }

export async function assignBlogToSlot(postId: string, slotDate: string): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_posts')
    .update({ status: 'queued', slot_date: slotDate, queue_position: null })
    .eq('id', postId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/content-queue')
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function unslotBlogPost(postId: string): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_posts')
    .update({ status: 'ready', slot_date: null })
    .eq('id', postId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/content-queue')
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function publishBlogNow(postId: string): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/content-queue')
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function markBlogReady(postId: string): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_posts')
    .update({ status: 'ready' })
    .eq('id', postId)
    .eq('site_id', ctx.siteId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/content-queue')
  revalidatePath('/cms/blog')
  return { ok: true }
}

export async function reorderBacklog(
  items: { id: string; position: number }[],
): Promise<ActionResult> {
  const supabase = getSupabaseServiceClient()
  for (const item of items) {
    await supabase
      .from('blog_posts')
      .update({ queue_position: item.position })
      .eq('id', item.id)
  }
  revalidatePath('/cms/content-queue')
  return { ok: true }
}

export async function updateBlogCadence(
  locale: string,
  patch: { cadence_days?: number; preferred_send_time?: string; cadence_paused?: boolean },
): Promise<ActionResult> {
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()
  const { error } = await supabase
    .from('blog_cadence')
    .upsert({
      site_id: ctx.siteId,
      locale,
      ...patch,
    }, { onConflict: 'site_id,locale' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/cms/content-queue')
  return { ok: true }
}
