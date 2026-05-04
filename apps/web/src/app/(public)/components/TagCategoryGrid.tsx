import Link from 'next/link'
import { PaperCard } from './PaperCard'
import type { HomePost, HomeTag } from '../../../../lib/home/types'

type TagGroup = {
  tag: HomeTag
  posts: HomePost[]
}

type Props = {
  tagGroups: TagGroup[]
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function TagCategoryGrid({ tagGroups, locale, t }: Props) {
  if (tagGroups.length === 0) return null
  const blogBase = locale === 'pt-BR' ? '/pt/blog' : '/blog'
  const gridCols = tagGroups.length >= 2 ? 'md:grid-cols-2' : ''
  const isPt = locale === 'pt-BR'

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--pb-accent)', marginBottom: 8, display: 'block' }}>
          § 04
        </span>
        <h2 className="font-fraunces italic" style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--pb-ink)', margin: 0 }}>
          {isPt ? 'Por categoria' : 'By category'}
        </h2>
      </div>

      <div className={`grid grid-cols-1 ${gridCols}`} style={{ gap: 28 }}>
        {tagGroups.map((group, gi) => (
          <div key={group.tag.id} style={{ position: 'relative', paddingTop: 12 }}>
            <span
              className="font-mono"
              style={{
                position: 'absolute',
                top: -2,
                left: 18,
                zIndex: 2,
                background: group.tag.color,
                color: '#FFF',
                padding: '5px 16px',
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 500,
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              {group.tag.name}
            </span>
            <PaperCard index={gi + 20} variant="paper" className="overflow-hidden">
              <div style={{ padding: '26px 20px 18px' }}>
                {group.posts.map((post, pi) => (
                  <Link
                    key={post.id}
                    href={`${blogBase}/${post.slug}`}
                    className="block group"
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      paddingBottom: pi < group.posts.length - 1 ? 12 : 0,
                      paddingTop: pi > 0 ? 12 : 0,
                      borderBottom: pi < group.posts.length - 1 ? '1px dashed var(--pb-line)' : 'none',
                    }}
                  >
                    <h3 className="font-fraunces" style={{ fontSize: 15, lineHeight: 1.2, margin: 0, fontWeight: 500, letterSpacing: '-0.005em', color: 'var(--pb-ink)' }}>
                      {post.title}
                    </h3>
                    <p className="font-mono" style={{ fontSize: 10, color: 'var(--pb-faint)', marginTop: 4, letterSpacing: '0.06em' }}>
                      {new Date(post.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })} · {post.readingTimeMin} min
                    </p>
                  </Link>
                ))}
              </div>
            </PaperCard>
          </div>
        ))}
      </div>
    </div>
  )
}
