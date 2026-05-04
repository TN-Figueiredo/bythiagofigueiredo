import Link from 'next/link'
import { PaperCard } from './PaperCard'
import { Tape } from './Tape'
import { ReadableCard } from '@/components/blog/readable-card'
import type { HomePost } from '../../../../lib/home/types'

type Props = {
  posts: HomePost[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function MostReadSidebar({ posts, locale, t }: Props) {
  if (posts.length === 0) return null
  const blogBase = locale === 'pt-BR' ? '/pt/blog' : '/blog'

  return (
    <div style={{ position: 'relative', paddingTop: 12 }}>
      <PaperCard index={7} variant="paper2" className="overflow-hidden" style={{ padding: '24px 26px' }}>
        <Tape variant="tape" className="-top-2 right-4" rotate={4} />
        <div style={{ marginBottom: 4 }}>
          <span className="font-mono" style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--pb-accent)' }}>
            ★ {t['home.mostRead.title']}
          </span>
          <p className="font-caveat" style={{ fontSize: 24, color: 'var(--pb-ink)', marginTop: 4, transform: 'rotate(-0.8deg)', display: 'inline-block' }}>
            {t['home.mostRead.subtitle']}
          </p>
        </div>

        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {posts.map((post, i) => (
            <li key={post.id} style={{
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: 12,
              padding: '11px 0',
              borderTop: i > 0 ? '1px dashed var(--pb-line)' : undefined,
            }}>
              <span className="font-caveat shrink-0" style={{ fontSize: 30, color: 'var(--pb-accent)', lineHeight: 0.9, minWidth: 24 }}>
                {i + 1}.
              </span>
              <ReadableCard postId={post.id} dimTitle={false}>
                <Link href={`${blogBase}/${post.slug}`} className="group" style={{ textDecoration: 'none', color: 'inherit' }}>
                  {post.tagName && (
                    <span className="font-mono" style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: post.tagColor ?? 'var(--pb-accent)' }}>
                      {post.tagName}
                    </span>
                  )}
                  <h3 className="font-fraunces" style={{ fontSize: 15, lineHeight: 1.25, marginTop: 3, fontWeight: 500, letterSpacing: '-0.005em', color: 'var(--pb-ink)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', margin: '2px 0 0' }}>
                    {post.title}
                  </h3>
                </Link>
              </ReadableCard>
            </li>
          ))}
        </ol>
      </PaperCard>
    </div>
  )
}
