import { notFound } from 'next/navigation'
import { postRepo } from '@/lib/cms/repositories'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { PostEditionEditor } from '../../new/post-edition-editor'
import { getPipelineItemForPost } from '@/lib/pipeline/blog-link'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditPostPage({ params }: Props) {
  const { id } = await params
  const post = await postRepo().getById(id)
  if (!post) notFound()
  const ctx = await getSiteContext()
  if (post.site_id !== ctx.siteId) notFound()
  const tx = post.translations[0]
  if (!tx) notFound()
  const existingLocales = post.translations.map(t => t.locale)

  const supabase = getSupabaseServiceClient()
  const [tagsResult, siteResult, hashtagResult, txExtraResult, postExtraResult, pipelineItem] = await Promise.all([
    supabase
      .from('blog_tags')
      .select('id, name, color, name_translations')
      .eq('site_id', ctx.siteId)
      .order('sort_order'),
    supabase
      .from('sites')
      .select('supported_locales')
      .eq('id', ctx.siteId)
      .single(),
    supabase
      .from('post_hashtags')
      .select('hashtags(id, name, slug)')
      .eq('post_id', id),
    supabase
      .from('blog_translations')
      .select('key_points, pull_quote, notes, colophon, content_json, content_html')
      .eq('post_id', id)
      .eq('locale', tx.locale)
      .maybeSingle(),
    supabase
      .from('blog_posts')
      .select('previous_post_id, continues_in_next, status, tag_id')
      .eq('id', id)
      .maybeSingle(),
    getPipelineItemForPost(id),
  ])

  const tags = (tagsResult.data ?? []).map((t: { id: string; name: string; color: string; name_translations?: Record<string, string> | null }) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    nameTranslations: t.name_translations ?? null,
  }))
  const supportedLocales = (siteResult.data?.supported_locales as string[] | null) ?? [ctx.defaultLocale]

  const postHashtags = ((hashtagResult.data ?? []) as unknown as Array<{ hashtags: { id: string; name: string; slug: string } | null }>)
    .map(r => r.hashtags)
    .filter((h): h is { id: string; name: string; slug: string } => h !== null)

  const txExtra = txExtraResult.data ?? {}
  const postExtra = postExtraResult.data ?? {}

  return (
    <PostEditionEditor
      locale={tx.locale}
      tagId={(postExtra as { tag_id?: string | null }).tag_id ?? null}
      defaultLocale={ctx.defaultLocale}
      tags={tags}
      supportedLocales={supportedLocales}
      siteId={ctx.siteId}
      existingPostId={id}
      initialTitle={tx.title}
      initialSlug={tx.slug}
      initialExcerpt={tx.excerpt ?? ''}
      initialContent={tx.content_mdx}
      initialContentJson={(txExtra as { content_json?: Record<string, unknown> | null }).content_json ?? null}
      initialContentHtml={(txExtra as { content_html?: string | null }).content_html ?? null}
      initialCoverImageUrl={post.cover_image_url}
      initialMetaTitle={tx.meta_title ?? ''}
      initialMetaDescription={tx.meta_description ?? ''}
      initialOgImageUrl={tx.og_image_url ?? ''}
      initialKeyPoints={(txExtra as { key_points?: string[] }).key_points ?? []}
      initialPullQuote={(txExtra as { pull_quote?: string | null }).pull_quote ?? ''}
      initialNotes={(txExtra as { notes?: string[] }).notes ?? []}
      initialColophon={(txExtra as { colophon?: string | null }).colophon ?? ''}
      initialPreviousPostId={(postExtra as { previous_post_id?: string | null }).previous_post_id ?? null}
      initialContinuesInNext={(postExtra as { continues_in_next?: boolean }).continues_in_next ?? false}
      initialHashtags={postHashtags}
      initialStatus={(postExtra as { status?: string }).status ?? 'draft'}
      existingLocales={existingLocales}
      initialPipelineItem={pipelineItem}
    />
  )
}
