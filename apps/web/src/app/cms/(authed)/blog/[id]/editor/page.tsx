import { notFound } from 'next/navigation'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getPipelineItemForPost } from '@/lib/pipeline/blog-link'
import { buildInitialState } from './reducer'
import type { PostStatus } from './types'
import { EditorClient } from './editor-client'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BlogEditorPage({ params }: Props) {
  const { id } = await params
  const ctx = await getSiteContext()
  const supabase = getSupabaseServiceClient()

  // 1. Load post
  const { data: post, error: postError } = await supabase
    .from('blog_posts')
    .select('id, site_id, status, cover_image_url, category, tag_id')
    .eq('id', id)
    .single()

  if (!post || postError || post.site_id !== ctx.siteId) notFound()

  // 2. Load translation (default locale first, fallback to any)
  const { data: translations } = await supabase
    .from('blog_translations')
    .select('locale, title, slug, excerpt, content_json, content_html, meta_title, meta_description, og_image_url, reading_time_min, key_points, pull_quote, notes, colophon')
    .eq('post_id', id)

  if (!translations?.length) notFound()
  const tx = translations[0]!

  // 3. Parallel fetches for remaining data
  const [tagsResult, hashtagResult, pipelineItem] = await Promise.all([
    supabase.from('blog_tags').select('id, name, color').eq('site_id', ctx.siteId).order('sort_order'),
    supabase.from('post_hashtags').select('hashtags(id, name, slug)').eq('post_id', id),
    getPipelineItemForPost(id).catch(() => null),
  ])

  // 4. Build initial state
  const initialState = buildInitialState({
    postId: id,
    code: pipelineItem?.code ?? `post-${id.slice(0, 4)}`,
    siteId: ctx.siteId,
    siteTimezone: ctx.timezone,
    locale: tx.locale,
    title: tx.title,
    slug: tx.slug,
    excerpt: tx.excerpt ?? '',
    status: post.status as PostStatus,
    contentJson: tx.content_json as Record<string, unknown> | null,
    contentHtml: tx.content_html as string | null,
    coverImageUrl: post.cover_image_url,
    metaTitle: tx.meta_title ?? '',
    metaDesc: tx.meta_description ?? '',
    ogImageUrl: tx.og_image_url,
    keyPoints: (tx.key_points as string[]) ?? [],
    pullQuote: (tx.pull_quote as string) ?? '',
    notes: (tx.notes as string[]) ?? [],
    colophon: (tx.colophon as string) ?? '',
    previousPostId: null,
    continuesInNext: false,
    hashtags: ((hashtagResult.data ?? []) as unknown as Array<{ hashtags: { id: string; name: string; slug: string } | null }>)
      .map(r => r.hashtags)
      .filter((h): h is { id: string; name: string; slug: string } => h !== null),
    tags: (tagsResult.data ?? []).map((t: { id: string; name: string; color: string }) => t.name),
    hook: pipelineItem?.title_pt ?? '',
    synopsis: '',
    plevel: `P${pipelineItem?.priority ?? 3}`,
    history: [],
    category: post.category,
    tagId: post.tag_id,
  })

  return <EditorClient initialState={initialState} />
}
