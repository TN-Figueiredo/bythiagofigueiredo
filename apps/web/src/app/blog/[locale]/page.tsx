import Link from 'next/link'
import { postRepo } from '../../../../lib/cms/repositories'
import { getSiteContext } from '../../../../lib/cms/site-context'

export const revalidate = 3600

interface Props {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ page?: string }>
}

// NOTE (Sprint 2): UI strings hardcoded as pt-BR intentionally.
// i18n lands in Sprint 3; user currently only has pt-BR + en sites.
export default async function BlogListPage({ params, searchParams }: Props) {
  const { locale } = await params
  const sp = await searchParams
  const ctx = await getSiteContext()
  const page = Number.parseInt(sp.page ?? '1', 10)

  const posts = await postRepo().list({
    siteId: ctx.siteId,
    locale,
    status: 'published',
    page,
    perPage: 12,
  })

  return (
    <main>
      <h1>Blog</h1>
      {posts.length === 0 && <p>Nenhum post ainda.</p>}
      <ul>
        {posts.map((p) => (
          <li key={p.id}>
            <Link href={`/blog/${locale}/${p.translation.slug}`}>
              <h2>{p.translation.title}</h2>
              {p.translation.excerpt && <p>{p.translation.excerpt}</p>}
              <small>{p.translation.reading_time_min} min de leitura</small>
            </Link>
          </li>
        ))}
      </ul>
      <nav>
        {page > 1 && <Link href={`?page=${page - 1}`}>Anterior</Link>}
        {posts.length === 12 && <Link href={`?page=${page + 1}`}>Próximo</Link>}
      </nav>
    </main>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return {
    title: 'Blog',
    description: 'Últimos posts do blog.',
    alternates: { canonical: `/blog/${locale}` },
  }
}
