import { notFound } from 'next/navigation'
import { PostEditor } from '@tn-figueiredo/cms'
import { postRepo } from '@/lib/cms/repositories'
import { blogRegistry } from '@/lib/cms/registry'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { computeDisplayId } from '../../_hub/hub-utils'
import { savePost, publishPost, unpublishPost, archivePost, compilePreview, uploadAsset } from './actions'

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

  // Query tag info and compute displayId from post rank by creation date
  const supabase = getSupabaseServiceClient()
  const [tagResult, countResult] = await Promise.all([
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
  ])

  const tagRow = tagResult.data as { tag_id: string | null; blog_tags: { name: string; color: string } | null } | null
  const tag = tagRow?.blog_tags ?? null
  const displayId = computeDisplayId(countResult.count ?? 1)

  return (
    <main>
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280' }}>{displayId}</span>
          {tag && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.125rem 0.5rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 500,
              backgroundColor: tag.color + '22',
              color: tag.color,
              border: `1px solid ${tag.color}44`,
            }}>
              {tag.name}
            </span>
          )}
          <h1 style={{ margin: 0 }}>Editando: {tx.title}</h1>
        </div>
      </header>
      <PostEditor
        postId={id}
        initialContent={tx.content_mdx}
        initialTitle={tx.title}
        initialSlug={tx.slug}
        initialExcerpt={tx.excerpt}
        initialMetaTitle={tx.meta_title}
        initialMetaDescription={tx.meta_description}
        initialOgImageUrl={tx.og_image_url}
        initialCoverImageUrl={post.cover_image_url}
        locale={tx.locale}
        componentNames={Object.keys(blogRegistry)}
        onSave={async (input) => {
          const result = await savePost(id, tx.locale, input)
          // Adapter: Sprint 5b PR-C added `invalid_seo_extras` to savePost's
          // result union, but @tn-figueiredo/cms@0.2.0's PostEditor SaveResult
          // type doesn't know about it. Project it onto the editor's existing
          // `validation_failed` shape so the error surfaces under the content
          // field (the frontmatter lives in the MDX body).
          if (!result.ok && result.error === 'invalid_seo_extras') {
            return {
              ok: false,
              error: 'validation_failed',
              fields: {
                content_mdx: result.details[0]?.message ?? 'invalid seo_extras frontmatter',
              },
            }
          }
          return result
        }}
        onPreview={async (source) => compilePreview(source)}
        onUpload={async (file) => uploadAsset(file, id)}
      />
      <div>
        {post.status !== 'published' && (
          <form action={async () => { 'use server'; await publishPost(id) }}>
            <button type="submit">Publicar</button>
          </form>
        )}
        {post.status === 'published' && (
          <form action={async () => { 'use server'; await unpublishPost(id) }}>
            <button type="submit">Despublicar</button>
          </form>
        )}
        <form action={async () => { 'use server'; await archivePost(id) }}>
          <button type="submit">Arquivar</button>
        </form>
      </div>
    </main>
  )
}
