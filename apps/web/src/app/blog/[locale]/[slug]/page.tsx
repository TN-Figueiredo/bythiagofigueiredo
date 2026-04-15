import { notFound } from 'next/navigation'
import { compileMdx, MdxRunner } from '@tn-figueiredo/cms'
import { postRepo } from '../../../../../lib/cms/repositories'
import { getSiteContext } from '../../../../../lib/cms/site-context'
import { blogRegistry } from '../../../../../lib/cms/registry'

export const revalidate = 3600

interface Props {
  params: Promise<{ locale: string; slug: string }>
}

export default async function BlogDetailPage({ params }: Props) {
  const { locale, slug } = await params
  const ctx = await getSiteContext()

  const post = await postRepo().getBySlug({ siteId: ctx.siteId, locale, slug })
  if (!post) notFound()
  const tx = post.translations[0]
  if (!tx) notFound()

  // Pre-compiled output from admin save (fast path).
  // NULL → runtime compile fallback (slower, used for legacy posts from Sprint 1 seed).
  let compiledSource = tx.content_compiled
  if (!compiledSource) {
    const compiled = await compileMdx(tx.content_mdx, blogRegistry)
    compiledSource = compiled.compiledSource
  }

  return (
    <main>
      <article>
        <header>
          <h1>{tx.title}</h1>
          {tx.excerpt && <p>{tx.excerpt}</p>}
          <p>{tx.reading_time_min} min de leitura</p>
        </header>
        <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
      </article>
      {tx.content_toc.length > 0 && (
        <aside aria-label="Sumário">
          <ul>
            {tx.content_toc.map((entry) => (
              <li key={entry.slug} style={{ marginLeft: entry.depth * 8 }}>
                <a href={`#${entry.slug}`}>{entry.text}</a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </main>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const ctx = await getSiteContext().catch(() => null)
  if (!ctx) return {}
  const post = await postRepo().getBySlug({ siteId: ctx.siteId, locale, slug })
  const tx = post?.translations[0]
  if (!tx) return {}
  return {
    title: tx.title,
    description: tx.excerpt ?? undefined,
    alternates: { canonical: `/blog/${locale}/${slug}` },
  }
}
