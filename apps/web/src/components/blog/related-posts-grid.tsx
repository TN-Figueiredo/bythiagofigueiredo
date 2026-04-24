import Link from 'next/link'
import type { RelatedPost } from '@/lib/blog/related-posts'
import { PaperCard } from '@/app/(public)/components/PaperCard'
import { Tape } from '@/app/(public)/components/Tape'

type Props = {
  posts: RelatedPost[]
  locale: string
  category: string | null
}

export function RelatedPostsGrid({ posts, locale, category }: Props) {
  if (posts.length === 0) return null

  return (
    <section className="max-w-[1100px] mx-auto my-12 px-10">
      <div className="h-px bg-[--pb-line] mb-10" />
      <div className="flex justify-between items-baseline mb-6">
        <div>
          <h2 className="font-fraunces text-[28px] font-bold">Textos relacionados</h2>
          <p className="text-sm text-pb-muted mt-1">
            Mais na mesma categoria ·{' '}
            {category && (
              <Link href={`/blog/${locale}?category=${encodeURIComponent(category)}`} className="text-pb-accent no-underline">
                {category}
              </Link>
            )}
          </p>
        </div>
        {category && (
          <Link href={`/blog/${locale}?category=${encodeURIComponent(category)}`} className="font-caveat text-base text-pb-accent no-underline">
            <em>Ver categoria</em> →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map((post, i) => (
          <Link key={post.id} href={`/blog/${locale}/${encodeURIComponent(post.slug)}`} className="no-underline">
            <PaperCard index={i}>
              <div className="relative h-[200px] overflow-hidden rounded-t-sm" style={{ background: `linear-gradient(135deg, hsl(${(i * 40 + 120) % 360}, 25%, 22%), hsl(${(i * 40 + 140) % 360}, 20%, 15%))` }}>
                <Tape variant={i % 2 === 0 ? 'tape' : 'tape2'} className="top-[-6px] left-5" rotate={-3} />
              </div>
              <div className="p-4">
                <div className="text-[11px] mb-2 flex gap-2 items-center">
                  <span className="font-jetbrains text-pb-accent uppercase tracking-wider">{post.category ?? 'Blog'}</span>
                  <span className="text-pb-muted">
                    {new Date(post.publishedAt).toLocaleDateString(locale === 'pt-BR' ? 'pt-BR' : 'en', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <h3 className="font-fraunces text-lg font-bold leading-tight mb-2 text-pb-ink">{post.title}</h3>
                <p className="text-xs text-pb-muted">{post.readingTimeMin} min · leitura</p>
              </div>
            </PaperCard>
          </Link>
        ))}
      </div>
    </section>
  )
}
