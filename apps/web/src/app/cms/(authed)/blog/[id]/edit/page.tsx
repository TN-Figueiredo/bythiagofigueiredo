import { notFound } from 'next/navigation'
import { postRepo } from '@/lib/cms/repositories'
import { blogRegistry } from '@/lib/cms/registry'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { computeDisplayId } from '../../_hub/hub-utils'
import { publishPost, unpublishPost, archivePost } from './actions'
import { EditPostClient } from './edit-post-client'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditPostPage({ params }: Props) {
  const { id } = await params
  const post = await postRepo().getById(id)
  if (!post) notFound()
  const ctx = await getSiteContext()
  if (post.site_id !== ctx.siteId) {
    // Post belongs to a different site — surface as 404 to avoid leaking existence.
    // Cross-ring admin access will land in Sprint 3 under /cms/{siteSlug}/blog/[id]/edit.
    notFound()
  }
  const tx = post.translations[0]
  if (!tx) notFound()

  // Query tag info, displayId, and blog overhaul structured columns
  const supabase = getSupabaseServiceClient()
  const [tagResult, countResult, hashtagResult, txExtraResult, postExtraResult] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('tag_id, blog_tags(name, color)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('blog_posts')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', ctx.siteId)
      .lte('created_at', post.created_at),
    supabase
      .from('post_hashtags')
      .select('hashtags(id, name, slug)')
      .eq('post_id', id),
    supabase
      .from('blog_translations')
      .select('key_points, pull_quote, notes, colophon')
      .eq('post_id', id)
      .eq('locale', tx.locale)
      .maybeSingle(),
    supabase
      .from('blog_posts')
      .select('previous_post_id, continues_in_next')
      .eq('id', id)
      .maybeSingle(),
  ])

  const tagRow = tagResult.data as { tag_id: string | null; blog_tags: { name: string; color: string } | null } | null
  const tag = tagRow?.blog_tags ?? null
  const displayId = computeDisplayId(countResult.count ?? 1)

  const postHashtags = ((hashtagResult.data ?? []) as unknown as Array<{ hashtags: { id: string; name: string; slug: string } | null }>)
    .map(r => r.hashtags)
    .filter((h): h is { id: string; name: string; slug: string } => h !== null)

  const txExtra = txExtraResult.data ?? {}
  const postExtra = postExtraResult.data ?? {}

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:px-7">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs text-gray-500">{displayId}</span>
        {tag && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: tag.color + '22',
              color: tag.color,
              border: `1px solid ${tag.color}44`,
            }}
          >
            {tag.name}
          </span>
        )}
        <h1 className="text-base font-semibold text-gray-200">Editando: {tx.title}</h1>
      </div>

      <EditPostClient
        postId={id}
        locale={tx.locale}
        siteId={ctx.siteId}
        initialContent={tx.content_mdx}
        initialTitle={tx.title}
        initialSlug={tx.slug}
        initialExcerpt={tx.excerpt}
        initialMetaTitle={tx.meta_title}
        initialMetaDescription={tx.meta_description}
        initialOgImageUrl={tx.og_image_url}
        initialCoverImageUrl={post.cover_image_url}
        componentNames={Object.keys(blogRegistry)}
        initialKeyPoints={(txExtra as { key_points?: string[] }).key_points ?? []}
        initialPullQuote={(txExtra as { pull_quote?: string | null }).pull_quote ?? ''}
        initialNotes={(txExtra as { notes?: string[] }).notes ?? []}
        initialColophon={(txExtra as { colophon?: string | null }).colophon ?? ''}
        initialPreviousPostId={(postExtra as { previous_post_id?: string | null }).previous_post_id ?? null}
        initialContinuesInNext={(postExtra as { continues_in_next?: boolean }).continues_in_next ?? false}
        initialHashtags={postHashtags}
      />

      <div className="flex items-center gap-2 border-t border-gray-800 pt-4">
        {post.status !== 'published' && (
          <form action={async () => { 'use server'; await publishPost(id) }}>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500">
              Publicar
            </button>
          </form>
        )}
        {post.status === 'published' && (
          <form action={async () => { 'use server'; await unpublishPost(id) }}>
            <button type="submit" className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700">
              Despublicar
            </button>
          </form>
        )}
        <form action={async () => { 'use server'; await archivePost(id) }}>
          <button type="submit" className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-400 hover:bg-gray-700 hover:text-gray-200">
            Arquivar
          </button>
        </form>
      </div>
    </div>
  )
}
