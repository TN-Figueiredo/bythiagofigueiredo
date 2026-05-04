import Link from 'next/link'
import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { SectionHeader } from './SectionHeader'
import { ReadableCard } from '@/components/blog/readable-card'
import { coverGradient } from '../../../../lib/home/cover-image'
import type { HomePost } from '../../../../lib/home/types'

type Props = {
  posts: HomePost[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
  isDark: boolean
}

const tapeVariants = ['tape', 'tape2', 'tapeR'] as const

export function BlogGrid({ posts, locale, t, isDark }: Props) {
  const blogBase = locale === 'pt-BR' ? '/pt/blog' : '/blog'
  const isPt = locale === 'pt-BR'

  const gridCols =
    posts.length >= 3 ? 'lg:grid-cols-3' :
    posts.length === 2 ? 'md:grid-cols-2' : ''

  return (
    <section id="blog" aria-labelledby="blog-heading" style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 28px 40px', scrollMarginTop: 110 }}>
      <SectionHeader
        number="02"
        label="blog"
        title={t['home.blog.title'] ?? ''}
        subtitle={t['home.blog.subtitle']}
        linkText={t['home.blog.archiveLink']}
        linkHref={blogBase}
        marker={false}
      />
      <h2 id="blog-heading" className="sr-only">{t['home.blog.title']}</h2>

      {posts.length === 0 ? (
        <PaperCard index={0} variant="paper" className="p-8 text-center max-w-md mx-auto">
          <Tape variant="tape" className="-top-2 left-6" rotate={-5} />
          <p className="font-caveat text-2xl" style={{ color: 'var(--pb-accent)' }}>
            {t['home.blog.emptyTitle']}
          </p>
          <p className="font-caveat text-lg mt-1" style={{ color: 'var(--pb-muted)' }}>
            {t['home.blog.emptyBody']}
          </p>
        </PaperCard>
      ) : (
        <>
          <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols}`} style={{ gap: 40, rowGap: 56 }}>
            {posts.map((post, i) => (
              <div key={post.id} style={{ position: 'relative', paddingTop: 16 }}>
                <ReadableCard postId={post.id}>
                  <PaperCard index={i} variant={i % 3 === 1 ? 'paper2' : 'paper'} className="overflow-hidden">
                    <Tape variant={tapeVariants[i % 3]} className="-top-2 left-4" rotate={-7 + (i % 5)} />
                    <Link href={`${blogBase}/${post.slug}`} className="block group" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div style={{ background: post.coverImageUrl ? undefined : coverGradient(post.tagName ?? post.category, isDark, post.tagColor), aspectRatio: '16 / 10', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 8, left: 8 }}>
                          <span className="font-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'var(--pb-ink)', color: 'var(--pb-paper)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
                            ▤ {isPt ? 'texto' : 'post'}
                          </span>
                        </div>
                      </div>
                      <div style={{ padding: '16px 18px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          {post.tagName && (
                            <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: post.tagColor ?? 'var(--pb-accent)' }}>
                              {post.tagName}
                            </span>
                          )}
                          <span className="font-mono" style={{ fontSize: 10, color: 'var(--pb-faint)', letterSpacing: '0.08em' }}>
                            {new Date(post.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <h3 className="font-fraunces" style={{ fontSize: 19, lineHeight: 1.2, letterSpacing: '-0.01em', margin: '6px 0 8px', fontWeight: 500, color: 'var(--pb-ink)' }}>
                          {post.title}
                        </h3>
                        <p className="font-mono" style={{ fontSize: 12, color: 'var(--pb-muted)', letterSpacing: '0.04em' }}>
                          {post.readingTimeMin} min · {isPt ? 'leitura' : 'read'}
                        </p>
                      </div>
                    </Link>
                  </PaperCard>
                </ReadableCard>
                {i === 0 && (
                  <div className="font-caveat" style={{ position: 'absolute', top: -4, right: -6, color: 'var(--pb-accent)', fontSize: 18, transform: 'rotate(12deg)' }}>
                    ⭐ {isPt ? 'top!' : 'yess'}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 48, textAlign: 'center' }}>
            <Link href={blogBase} className="font-mono inline-block uppercase" style={{ fontSize: 12, letterSpacing: '0.16em', color: 'var(--pb-ink)', padding: '12px 26px', border: '1.5px solid var(--pb-line)', textDecoration: 'none', fontWeight: 600 }}>
              {t['home.blog.viewAll']}
            </Link>
          </div>
        </>
      )}
    </section>
  )
}
