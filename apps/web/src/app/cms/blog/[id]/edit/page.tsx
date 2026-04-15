import { notFound } from 'next/navigation'
import { PostEditor } from '@tn-figueiredo/cms'
import { postRepo } from '../../../../../../lib/cms/repositories'
import { blogRegistry } from '../../../../../../lib/cms/registry'
import { getSiteContext } from '../../../../../../lib/cms/site-context'
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

  return (
    <main>
      <header>
        <h1>Editando: {tx.title}</h1>
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
        onSave={async (input) => savePost(id, tx.locale, input)}
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
