import { getSupabaseServiceClient } from '@/lib/supabase/service'

export interface LinkedPipelineItem {
  id: string
  code: string
  title_pt: string | null
  title_en: string | null
  stage: string
  format: string
  priority: number
}

export async function getPipelineItemForPost(postId: string): Promise<LinkedPipelineItem | null> {
  const svc = getSupabaseServiceClient()
  const { data } = await svc
    .from('content_pipeline')
    .select('id, code, title_pt, title_en, stage, format, priority')
    .eq('blog_post_id', postId)
    .maybeSingle()
  return data as LinkedPipelineItem | null
}

export async function linkPostToItem(
  itemId: string,
  postId: string,
  siteId: string,
  userId: string | null,
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const svc = getSupabaseServiceClient()

  const { data: item, error: fetchErr } = await svc
    .from('content_pipeline')
    .select('id, blog_post_id, code')
    .eq('id', itemId)
    .eq('site_id', siteId)
    .single()

  if (fetchErr || !item) return { ok: false, error: 'Pipeline item not found', code: 'NOT_FOUND' }
  if (item.blog_post_id) return { ok: false, error: 'Item already linked to a blog post', code: 'ALREADY_LINKED' }

  const { data: post, error: postErr } = await svc
    .from('blog_posts')
    .select('id, site_id, status')
    .eq('id', postId)
    .single()

  if (postErr || !post) return { ok: false, error: 'Blog post not found', code: 'NOT_FOUND' }
  if (post.site_id !== siteId) return { ok: false, error: 'Blog post belongs to a different site', code: 'FORBIDDEN' }

  const { error: updateErr } = await svc
    .from('content_pipeline')
    .update({ blog_post_id: postId })
    .eq('id', itemId)

  if (updateErr) {
    if (updateErr.code === '23505') {
      const { data: existing } = await svc
        .from('content_pipeline')
        .select('code')
        .eq('blog_post_id', postId)
        .maybeSingle()
      return { ok: false, error: `Post already linked to item ${existing?.code ?? 'unknown'}`, code: 'DUPLICATE' }
    }
    return { ok: false, error: updateErr.message }
  }

  await svc.from('content_pipeline_history').insert({
    pipeline_id: itemId,
    event_type: 'linked',
    to_value: postId,
    changed_by: userId,
  })

  if (post.status === 'published') {
    const { syncPipelineOnPostStatusChange } = await import('./blog-sync')
    await syncPipelineOnPostStatusChange(postId, 'published', 'draft').catch((err) =>
      console.error('[blog-link] sync after link-to-published failed', err),
    )
  }

  return { ok: true }
}

export async function unlinkPostFromItem(
  itemId: string,
  siteId: string,
  userId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const svc = getSupabaseServiceClient()

  const { data: item } = await svc
    .from('content_pipeline')
    .select('id, blog_post_id')
    .eq('id', itemId)
    .eq('site_id', siteId)
    .single()

  if (!item) return { ok: false, error: 'Pipeline item not found' }
  if (!item.blog_post_id) return { ok: true }

  const previousPostId = item.blog_post_id

  await svc
    .from('content_pipeline')
    .update({ blog_post_id: null })
    .eq('id', itemId)

  await svc.from('content_pipeline_history').insert({
    pipeline_id: itemId,
    event_type: 'unlinked',
    from_value: previousPostId,
    changed_by: userId,
  })

  return { ok: true }
}

export async function searchBlogPostsForLink(
  siteId: string,
  query: string,
): Promise<Array<{
  id: string
  title: string
  locale: string
  status: string
  linked_to_code: string | null
}>> {
  const svc = getSupabaseServiceClient()

  const { data: translations } = await svc
    .from('blog_translations')
    .select('post_id, title, locale, blog_posts!inner(id, site_id, status)')
    .eq('blog_posts.site_id', siteId)
    .ilike('title', `%${query}%`)
    .limit(10)

  if (!translations) return []

  interface TranslationRow { post_id: string; title: string; locale: string; blog_posts: { status: string } | null }
  const rows = translations as unknown as TranslationRow[]
  const postIds = rows.map(t => t.post_id)

  const { data: linkedItems } = await svc
    .from('content_pipeline')
    .select('blog_post_id, code')
    .in('blog_post_id', postIds)

  interface LinkRow { blog_post_id: string; code: string }
  const linkMap = new Map(((linkedItems ?? []) as unknown as LinkRow[]).map(l => [l.blog_post_id, l.code]))

  return rows.map(t => ({
    id: t.post_id,
    title: t.title,
    locale: t.locale,
    status: t.blog_posts?.status ?? 'draft',
    linked_to_code: linkMap.get(t.post_id) ?? null,
  }))
}
