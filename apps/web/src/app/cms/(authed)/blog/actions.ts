'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { revalidateBlogPostSeo } from '@/lib/seo/cache-invalidation'

async function requireEditScope(siteId: string): Promise<void> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  }
}

export async function bulkPublish(
  postIds: string[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (postIds.length === 0) return { ok: true, count: 0 }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  // CAS: only transition posts that are currently in publishable statuses
  const { data, error } = await supabase
    .from('blog_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .in('id', postIds)
    .eq('site_id', siteId)
    .in('status', ['draft', 'ready', 'pending_review'])
    .select('id, blog_translations(locale, slug)')

  if (error) return { ok: false, error: error.message }

  const published = data ?? []
  for (const post of published) {
    const translations = (post as { id: string; blog_translations: Array<{ locale: string; slug: string }> }).blog_translations ?? []
    for (const tx of translations) {
      revalidateBlogPostSeo(siteId, post.id, tx.locale, tx.slug)
    }
  }

  revalidatePath('/cms/blog')
  return { ok: true, count: published.length }
}

export async function bulkArchive(
  postIds: string[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (postIds.length === 0) return { ok: true, count: 0 }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  // CAS: only archive posts that are currently published or draft
  const { data, error } = await supabase
    .from('blog_posts')
    .update({ status: 'archived' })
    .in('id', postIds)
    .eq('site_id', siteId)
    .in('status', ['published', 'draft', 'ready', 'pending_review'])
    .select('id, blog_translations(locale, slug)')

  if (error) return { ok: false, error: error.message }

  const archived = data ?? []
  for (const post of archived) {
    const translations = (post as { id: string; blog_translations: Array<{ locale: string; slug: string }> }).blog_translations ?? []
    for (const tx of translations) {
      revalidateBlogPostSeo(siteId, post.id, tx.locale, tx.slug)
    }
  }

  revalidatePath('/cms/blog')
  return { ok: true, count: archived.length }
}

export async function bulkDelete(
  postIds: string[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (postIds.length === 0) return { ok: true, count: 0 }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  // CAS: only delete drafts (safety — never delete published posts)
  const { data: toDelete, error: fetchError } = await supabase
    .from('blog_posts')
    .select('id, blog_translations(locale, slug)')
    .in('id', postIds)
    .eq('site_id', siteId)
    .in('status', ['draft', 'archived'])

  if (fetchError) return { ok: false, error: fetchError.message }

  const rows = toDelete ?? []
  if (rows.length === 0) return { ok: true, count: 0 }

  const deleteIds = rows.map((r) => r.id)
  const { error: deleteError } = await supabase
    .from('blog_posts')
    .delete()
    .in('id', deleteIds)
    .eq('site_id', siteId)

  if (deleteError) return { ok: false, error: deleteError.message }

  for (const post of rows) {
    const translations = (post as { id: string; blog_translations: Array<{ locale: string; slug: string }> }).blog_translations ?? []
    for (const tx of translations) {
      revalidateBlogPostSeo(siteId, post.id, tx.locale, tx.slug)
    }
  }

  revalidatePath('/cms/blog')
  return { ok: true, count: rows.length }
}

export async function bulkChangeAuthor(
  postIds: string[],
  newAuthorId: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (postIds.length === 0) return { ok: true, count: 0 }
  if (!newAuthorId) return { ok: false, error: 'author_id_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  // Verify author exists
  const { data: author, error: authorError } = await supabase
    .from('authors')
    .select('id')
    .eq('id', newAuthorId)
    .maybeSingle()

  if (authorError) return { ok: false, error: authorError.message }
  if (!author) return { ok: false, error: 'author_not_found' }

  const { data, error } = await supabase
    .from('blog_posts')
    .update({ author_id: newAuthorId })
    .in('id', postIds)
    .eq('site_id', siteId)
    .select('id')

  if (error) return { ok: false, error: error.message }

  revalidatePath('/cms/blog')
  return { ok: true, count: (data ?? []).length }
}
