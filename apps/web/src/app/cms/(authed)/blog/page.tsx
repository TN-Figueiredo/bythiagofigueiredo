import Link from 'next/link'
import type { ContentStatus } from '@tn-figueiredo/cms'
import { postRepo } from '../../../../../lib/cms/repositories'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import { deletePost } from './[id]/edit/actions'
import { DeletePostButton } from './_components/delete-post-button'

interface Props {
  searchParams: Promise<{ status?: string; locale?: string; search?: string }>
}

export default async function CmsBlogListPage({ searchParams }: Props) {
  const sp = await searchParams
  const ctx = await getSiteContext()
  const status = (sp.status as ContentStatus | undefined) ?? undefined
  const locale = sp.locale ?? ctx.defaultLocale
  const search = sp.search

  const posts = await postRepo().list({
    siteId: ctx.siteId,
    locale,
    status,
    search,
    perPage: 50,
  })

  return (
    <main>
      <header>
        <h1>Blog Posts</h1>
        <Link href="/cms/blog/new">+ Novo</Link>
      </header>
      <form method="get">
        <select name="status" defaultValue={status ?? ''} aria-label="status filter">
          <option value="">Todos</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select name="locale" defaultValue={locale} aria-label="locale filter">
          <option value="pt-BR">pt-BR</option>
          <option value="en">en</option>
        </select>
        <input
          type="search"
          name="search"
          placeholder="Buscar..."
          defaultValue={search ?? ''}
          aria-label="title search"
        />
        <button type="submit">Filtrar</button>
      </form>
      {posts.length === 0 ? (
        <p>Nenhum post encontrado.</p>
      ) : (
        <ul>
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/cms/blog/${p.id}/edit`}>
                <span data-status={p.status}>{p.status}</span>
                <strong>{p.translation.title}</strong>
                <span>{p.translation.locale}</span>
                <span>{p.available_locales.join(', ')}</span>
                {p.published_at && <time>{p.published_at}</time>}
              </Link>
              {(p.status === 'draft' || p.status === 'archived') && (
                <DeletePostButton
                  postId={p.id}
                  postTitle={p.translation.title}
                  onDelete={deletePost}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

export const dynamic = 'force-dynamic'
