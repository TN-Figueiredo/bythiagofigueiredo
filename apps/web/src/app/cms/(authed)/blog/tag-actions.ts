'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

async function requireEditScope(siteId: string): Promise<void> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) {
    throw new Error(res.reason === 'unauthenticated' ? 'unauthenticated' : 'forbidden')
  }
}

function revalidateBlogHub(siteId?: string): void {
  revalidateTag('blog-hub')
  revalidateTag('pipeline-blog')
  revalidateTag('sidebar-badges')
  revalidatePath('/cms/blog')
  if (siteId) revalidateTag(`sitemap:${siteId}`)
}

function generateTagSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function createTag(input: {
  name: string
  color?: string
  colorDark?: string | null
  badge?: string | null
  sortOrder?: number
  nameTranslations?: Record<string, string>
}): Promise<{ ok: true; tagId: string } | { ok: false; error: string }> {
  if (!input.name.trim()) return { ok: false, error: 'name_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const slug = generateTagSlug(input.name.trim())

  const insertData: Record<string, unknown> = {
    site_id: siteId,
    name: input.name.trim(),
    slug,
    color: input.color ?? '#6366f1',
    color_dark: input.colorDark ?? null,
    badge: input.badge ?? null,
    sort_order: input.sortOrder ?? 0,
  }
  if (input.nameTranslations) {
    const cleaned: Record<string, string> = {}
    for (const [locale, value] of Object.entries(input.nameTranslations)) {
      const trimmed = value?.trim()
      if (trimmed) cleaned[locale] = trimmed
    }
    insertData.name_translations = cleaned
  }

  const { data, error } = await supabase
    .from('blog_tags')
    .insert(insertData)
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'name_already_exists' }
    return { ok: false, error: error.message }
  }

  revalidateBlogHub(siteId)
  return { ok: true, tagId: data.id as string }
}

export async function updateTag(
  tagId: string,
  patch: {
    name?: string
    color?: string
    colorDark?: string | null
    badge?: string | null
    sortOrder?: number
    nameTranslations?: Record<string, string>
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const updateData: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    updateData.name = patch.name.trim()
    updateData.slug = generateTagSlug(patch.name.trim())
  }
  if (patch.color !== undefined) updateData.color = patch.color
  if (patch.colorDark !== undefined) updateData.color_dark = patch.colorDark
  if (patch.badge !== undefined) updateData.badge = patch.badge
  if (patch.sortOrder !== undefined) updateData.sort_order = patch.sortOrder
  if (patch.nameTranslations !== undefined) {
    const cleaned: Record<string, string> = {}
    for (const [locale, value] of Object.entries(patch.nameTranslations)) {
      const trimmed = value?.trim()
      if (trimmed) cleaned[locale] = trimmed
    }
    updateData.name_translations = cleaned
  }
  updateData.updated_at = new Date().toISOString()

  const { error } = await supabase
    .from('blog_tags')
    .update(updateData)
    .eq('id', tagId)
    .eq('site_id', siteId)

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'name_already_exists' }
    return { ok: false, error: error.message }
  }

  revalidateBlogHub(siteId)
  return { ok: true }
}

export async function deleteTag(
  tagId: string,
): Promise<{ ok: true } | { ok: false; error: string; postCount?: number }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { count, error: countError } = await supabase
    .from('blog_posts')
    .select('id', { count: 'exact', head: true })
    .eq('tag_id', tagId)
    .eq('site_id', siteId)

  if (countError) return { ok: false, error: countError.message }

  const postCount = count ?? 0
  if (postCount > 0) {
    return { ok: false, error: 'tag_has_posts', postCount }
  }

  const { error } = await supabase
    .from('blog_tags')
    .delete()
    .eq('id', tagId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateBlogHub(siteId)
  return { ok: true }
}

export async function getTagWithLink(
  tagId: string,
): Promise<{
  id: string
  name: string
  slug: string
  color: string
  color_dark: string | null
  badge: string | null
  sort_order: number
  linkedNewsletterTypes: Array<{ id: string; name: string; locale: string }>
} | null> {
  const { siteId } = await getSiteContext()

  const supabase = getSupabaseServiceClient()

  const { data: tag, error } = await supabase
    .from('blog_tags')
    .select('id, name, slug, color, color_dark, badge, sort_order')
    .eq('id', tagId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (error || !tag) return null

  const { data: nlTypes } = await supabase
    .from('newsletter_types')
    .select('id, name, locale')
    .eq('linked_tag_id', tagId)
    .eq('site_id', siteId)

  return {
    ...(tag as {
      id: string
      name: string
      slug: string
      color: string
      color_dark: string | null
      badge: string | null
      sort_order: number
    }),
    linkedNewsletterTypes: (nlTypes ?? []) as Array<{ id: string; name: string; locale: string }>,
  }
}

export async function reorderTags(
  tagIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (tagIds.length === 0) return { ok: true }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const updates = tagIds.map((id, index) =>
    supabase
      .from('blog_tags')
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('site_id', siteId),
  )

  const results = await Promise.all(updates)
  const firstError = results.find((r) => r.error)?.error
  if (firstError) return { ok: false, error: firstError.message }

  revalidateBlogHub(siteId)
  return { ok: true }
}
