'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { revalidateBlogPostSeo } from '@/lib/seo/cache-invalidation'
import { isValidTransition } from './_hub/hub-utils'

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function revalidateBlogHub(siteId?: string): void {
  revalidateTag('blog-hub')
  revalidateTag('sidebar-badges')
  revalidatePath('/cms/blog')
  if (siteId) revalidateTag(`sitemap:${siteId}`)
}

async function getUserClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(c: Array<{ name: string; value: string; options?: CookieOptions }>) {
          for (const { name, value, options } of c) cookieStore.set(name, value, options)
        },
      },
    },
  )
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

// ─── Newsletter Type Link Helpers ────────────────────────────────────────────

export async function getUnlinkedNewsletterTypes(
  siteId: string,
  currentTagId?: string,
): Promise<
  Array<{ id: string; name: string; locale: string; color: string | null; color_dark: string | null }>
> {
  await requireEditScope(siteId)
  const supabase = getSupabaseServiceClient()

  let query = supabase
    .from('newsletter_types')
    .select('id, name, locale, color, color_dark')
    .eq('site_id', siteId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (currentTagId) {
    // Show types that are unlinked OR linked to this specific tag
    query = query.or(`linked_tag_id.is.null,linked_tag_id.eq.${currentTagId}`)
  } else {
    query = query.is('linked_tag_id', null)
  }

  const { data, error } = await query

  if (error) return []
  return (data ?? []) as Array<{ id: string; name: string; locale: string; color: string | null; color_dark: string | null }>
}

async function validateNewsletterTypeLink(
  supabase: ReturnType<typeof getSupabaseServiceClient>,
  siteId: string,
  newsletterTypeId: string,
  currentTagId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: nlType, error: nlError } = await supabase
    .from('newsletter_types')
    .select('id, site_id, linked_tag_id')
    .eq('id', newsletterTypeId)
    .maybeSingle()

  if (nlError) return { ok: false, error: nlError.message }
  if (!nlType) return { ok: false, error: 'newsletter_type_not_found' }
  if (nlType.site_id !== siteId) return { ok: false, error: 'newsletter_type_wrong_site' }
  if (nlType.linked_tag_id && nlType.linked_tag_id !== currentTagId) {
    return { ok: false, error: 'newsletter_type_already_linked' }
  }

  return { ok: true }
}

// ─── Tag CRUD ─────────────────────────────────────────────────────────────────

export async function createTag(input: {
  name: string
  color?: string
  colorDark?: string | null
  badge?: string | null
  sortOrder?: number
  linkedNewsletterTypeId?: string
}): Promise<{ ok: true; tagId: string } | { ok: false; error: string }> {
  if (!input.name.trim()) return { ok: false, error: 'name_required' }

  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  // Validate newsletter type link if provided
  if (input.linkedNewsletterTypeId) {
    const linkCheck = await validateNewsletterTypeLink(
      supabase,
      siteId,
      input.linkedNewsletterTypeId,
    )
    if (!linkCheck.ok) return linkCheck
  }

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
  if (input.linkedNewsletterTypeId) {
    insertData.linked_newsletter_type_id = input.linkedNewsletterTypeId
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
    linkedNewsletterTypeId?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  // Validate newsletter type link if setting a new one
  if (patch.linkedNewsletterTypeId !== undefined && patch.linkedNewsletterTypeId !== null) {
    const linkCheck = await validateNewsletterTypeLink(
      supabase,
      siteId,
      patch.linkedNewsletterTypeId,
      tagId,
    )
    if (!linkCheck.ok) return linkCheck
  }

  const updateData: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    updateData.name = patch.name.trim()
    updateData.slug = generateTagSlug(patch.name.trim())
  }
  if (patch.color !== undefined) updateData.color = patch.color
  if (patch.colorDark !== undefined) updateData.color_dark = patch.colorDark
  if (patch.badge !== undefined) updateData.badge = patch.badge
  if (patch.sortOrder !== undefined) updateData.sort_order = patch.sortOrder
  if (patch.linkedNewsletterTypeId !== undefined) {
    updateData.linked_newsletter_type_id = patch.linkedNewsletterTypeId
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
  // Invalidate home page caches when newsletter link changes
  if (patch.linkedNewsletterTypeId !== undefined) {
    revalidateTag('home-tags')
    revalidateTag('home-posts')
  }
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
  linked_newsletter_type_id: string | null
  linkedNewsletterType: { id: string; name: string; locale: string } | null
} | null> {
  const { siteId } = await getSiteContext()

  const supabase = getSupabaseServiceClient()

  const { data: tag, error } = await supabase
    .from('blog_tags')
    .select('id, name, slug, color, color_dark, badge, sort_order, linked_newsletter_type_id')
    .eq('id', tagId)
    .eq('site_id', siteId)
    .maybeSingle()

  if (error || !tag) return null

  let linkedNewsletterType: { id: string; name: string; locale: string } | null = null
  if (tag.linked_newsletter_type_id) {
    const { data: nlType } = await supabase
      .from('newsletter_types')
      .select('id, name, locale')
      .eq('id', tag.linked_newsletter_type_id)
      .maybeSingle()

    if (nlType) {
      linkedNewsletterType = nlType as { id: string; name: string; locale: string }
    }
  }

  return {
    ...(tag as {
      id: string
      name: string
      slug: string
      color: string
      color_dark: string | null
      badge: string | null
      sort_order: number
      linked_newsletter_type_id: string | null
    }),
    linkedNewsletterType,
  }
}

export async function fetchUnlinkedNewsletterTypes(
  currentTagId?: string,
): Promise<
  Array<{ id: string; name: string; locale: string; color: string | null; color_dark: string | null }>
> {
  const { siteId } = await getSiteContext()
  return getUnlinkedNewsletterTypes(siteId, currentTagId)
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

// ─── Hub Mutations ────────────────────────────────────────────────────────────

export async function createPost(input: {
  title?: string
  locale: string
  tagId?: string | null
  status?: 'idea' | 'draft'
}): Promise<{ ok: true; postId: string } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return { ok: false, error: 'unauthenticated' }

  const supabase = getSupabaseServiceClient()

  // Resolve author row for current user
  const { data: author } = await supabase
    .from('authors')
    .select('id')
    .eq('user_id', user.id)
    .eq('site_id', siteId)
    .maybeSingle()

  const isPt = input.locale === 'pt-BR'
  const defaultTitle = isPt ? 'Sem título' : 'Untitled'
  const title = input.title?.trim() || defaultTitle
  const slug = `${generateTagSlug(title)}-${Date.now()}`

  const { data: post, error: postError } = await supabase
    .from('blog_posts')
    .insert({
      site_id: siteId,
      locale: input.locale,
      status: input.status ?? 'idea',
      tag_id: input.tagId ?? null,
      author_id: author?.id ?? null,
      owner_user_id: user.id,
    })
    .select('id')
    .single()

  if (postError) return { ok: false, error: postError.message }

  const { error: txError } = await supabase
    .from('blog_translations')
    .insert({
      post_id: post.id,
      locale: input.locale,
      title,
      slug,
      content_mdx: '',
    })

  if (txError) {
    // Roll back the orphaned post
    await supabase.from('blog_posts').delete().eq('id', post.id)
    return { ok: false, error: txError.message }
  }

  revalidateBlogHub(siteId)
  return { ok: true, postId: post.id as string }
}

export async function movePost(
  postId: string,
  newStatus: string,
  scheduledFor?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data: current, error: fetchError } = await supabase
    .from('blog_posts')
    .select('id, status, site_id, tag_id, blog_translations(locale, slug)')
    .eq('id', postId)
    .eq('site_id', siteId)
    .single()

  if (fetchError || !current) return { ok: false, error: 'not_found' }
  if (!isValidTransition(current.status as string, newStatus)) {
    return { ok: false, error: 'invalid_transition' }
  }

  if ((newStatus === 'ready' || newStatus === 'scheduled') && !current.tag_id) {
    return { ok: false, error: 'tag_required' }
  }

  const patch: Record<string, unknown> = { status: newStatus }
  if (newStatus === 'published') {
    patch.published_at = new Date().toISOString()
  } else if (current.status === 'published') {
    patch.published_at = null
  }
  if (newStatus === 'scheduled') {
    if (!scheduledFor) return { ok: false, error: 'scheduled_for_required' }
    const scheduledDate = new Date(scheduledFor)
    if (isNaN(scheduledDate.getTime())) return { ok: false, error: 'invalid_date' }
    if (scheduledDate.getTime() < Date.now() - 5 * 60 * 1000) return { ok: false, error: 'date_in_past' }
    patch.scheduled_for = scheduledFor
  } else if (current.status === 'scheduled') {
    patch.scheduled_for = null
  }

  // CAS: only update if status hasn't changed since we read it
  const { data: updated, error: updateError } = await supabase
    .from('blog_posts')
    .update(patch)
    .eq('id', postId)
    .eq('site_id', siteId)
    .eq('status', current.status)
    .select('id')

  if (updateError) return { ok: false, error: updateError.message }
  if (!updated || updated.length === 0) return { ok: false, error: 'conflict' }

  const translations = (current as { id: string; status: string; site_id: string; blog_translations: Array<{ locale: string; slug: string }> }).blog_translations ?? []
  for (const tx of translations) {
    revalidateBlogPostSeo(siteId, postId, tx.locale, tx.slug)
  }

  revalidateBlogHub(siteId)
  return { ok: true }
}

export async function deleteHubPost(
  postId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  const { data: post, error: fetchError } = await supabase
    .from('blog_posts')
    .select('id, status, site_id, blog_translations(locale, slug)')
    .eq('id', postId)
    .eq('site_id', siteId)
    .single()

  if (fetchError || !post) return { ok: false, error: 'not_found' }

  const deletableStatuses = ['idea', 'draft', 'archived']
  if (!deletableStatuses.includes(post.status as string)) {
    return { ok: false, error: 'post_not_deletable' }
  }

  // CAS: only delete if status is still deletable
  const { data: deleted, error: deleteError } = await supabase
    .from('blog_posts')
    .delete()
    .eq('id', postId)
    .eq('site_id', siteId)
    .in('status', deletableStatuses)
    .select('id')

  if (deleteError) return { ok: false, error: deleteError.message }
  if (!deleted || deleted.length === 0) return { ok: false, error: 'conflict' }

  const translations = (post as { id: string; status: string; site_id: string; blog_translations: Array<{ locale: string; slug: string }> }).blog_translations ?? []
  for (const tx of translations) {
    revalidateBlogPostSeo(siteId, postId, tx.locale, tx.slug)
  }

  revalidateBlogHub(siteId)
  return { ok: true }
}

export async function reassignTag(
  postId: string,
  tagId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  if (tagId) {
    const { data: tag } = await supabase
      .from('blog_tags')
      .select('id')
      .eq('id', tagId)
      .eq('site_id', siteId)
      .maybeSingle()
    if (!tag) return { ok: false, error: 'tag_not_found' }
  }

  const { error } = await supabase
    .from('blog_posts')
    .update({ tag_id: tagId })
    .eq('id', postId)
    .eq('site_id', siteId)

  if (error) return { ok: false, error: error.message }

  revalidateBlogHub(siteId)
  return { ok: true }
}

export async function addLocale(
  postId: string,
  locale: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const supabase = getSupabaseServiceClient()

  // Fetch existing primary translation for title fallback
  const { data: existing } = await supabase
    .from('blog_translations')
    .select('title')
    .eq('post_id', postId)
    .limit(1)
    .maybeSingle()

  const baseTitle = (existing?.title as string | null) ?? 'Untitled'
  const slug = `${generateTagSlug(baseTitle)}-${locale}-${Date.now()}`

  const { error } = await supabase
    .from('blog_translations')
    .insert({
      post_id: postId,
      locale,
      title: baseTitle,
      slug,
      content_mdx: '',
    })

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'locale_exists' }
    return { ok: false, error: error.message }
  }

  revalidateBlogHub(siteId)
  return { ok: true }
}

export async function duplicatePost(
  postId: string,
): Promise<{ ok: true; newPostId: string } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  const userClient = await getUserClient()
  const { data: { user } } = await userClient.auth.getUser()

  const supabase = getSupabaseServiceClient()

  const { data: source, error: fetchError } = await supabase
    .from('blog_posts')
    .select('id, site_id, locale, author_id, tag_id, blog_translations(locale, title, slug, excerpt, content_mdx, meta_title, meta_description, og_image_url, cover_image_url)')
    .eq('id', postId)
    .eq('site_id', siteId)
    .single()

  if (fetchError || !source) return { ok: false, error: 'not_found' }

  const { data: newPost, error: postError } = await supabase
    .from('blog_posts')
    .insert({
      site_id: source.site_id,
      locale: source.locale,
      status: 'idea',
      tag_id: source.tag_id,
      author_id: source.author_id,
      owner_user_id: user?.id ?? null,
    })
    .select('id')
    .single()

  if (postError) return { ok: false, error: postError.message }

  const translations = (source as { id: string; site_id: string; locale: string; author_id: string | null; tag_id: string | null; blog_translations: Array<{ locale: string; title: string; slug: string; excerpt: string | null; content_mdx: string; meta_title: string | null; meta_description: string | null; og_image_url: string | null; cover_image_url: string | null }> }).blog_translations ?? []

  const txInserts = translations.map((tx) => ({
    post_id: newPost.id as string,
    locale: tx.locale,
    title: `${tx.title} (copy)`,
    slug: `${tx.slug}-copy-${Date.now()}`,
    excerpt: tx.excerpt,
    content_mdx: tx.content_mdx,
    meta_title: tx.meta_title,
    meta_description: tx.meta_description,
    og_image_url: tx.og_image_url,
    cover_image_url: tx.cover_image_url,
  }))

  const { error: txError } = await supabase
    .from('blog_translations')
    .insert(txInserts)

  if (txError) {
    await supabase.from('blog_posts').delete().eq('id', newPost.id)
    return { ok: false, error: txError.message }
  }

  revalidateBlogHub(siteId)
  return { ok: true, newPostId: newPost.id as string }
}

// ─── Cadence Management ───────────────────────────────────────────────────────

export async function updateBlogCadence(
  locale: string,
  patch: {
    cadence_days?: number
    preferred_send_time?: string
    cadence_paused?: boolean
    cadence_start_date?: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { siteId } = await getSiteContext()
  await requireEditScope(siteId)

  if (patch.cadence_days !== undefined) {
    if (!Number.isInteger(patch.cadence_days) || patch.cadence_days < 1 || patch.cadence_days > 365) {
      return { ok: false, error: 'cadence_days_out_of_range' }
    }
  }

  if (patch.preferred_send_time !== undefined) {
    const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/
    if (!timeRe.test(patch.preferred_send_time)) {
      return { ok: false, error: 'invalid_time_format' }
    }
  }

  const supabase = getSupabaseServiceClient()

  const upsertData: Record<string, unknown> = {
    site_id: siteId,
    locale,
    ...patch,
  }

  const { error } = await supabase
    .from('blog_cadence')
    .upsert(upsertData, { onConflict: 'site_id,locale' })

  if (error) return { ok: false, error: error.message }

  revalidateBlogHub(siteId)
  revalidatePath('/cms/blog')
  return { ok: true }
}
