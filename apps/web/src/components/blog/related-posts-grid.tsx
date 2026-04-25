import Link from 'next/link'
import type { RelatedPost } from '@/lib/blog/related-posts'
import { Tape } from '@/app/(public)/components/Tape'

type Props = {
  posts: RelatedPost[]
  locale: string
  category: string | null
}

const categoryColors: Record<string, string> = {
  code: '#D65B1F',
  tech: '#D65B1F',
  vida: '#8A4A8F',
  viagem: '#2F6B22',
  crescimento: '#5B6E2B',
  negocio: '#B87333',
}

function paperTint(index: number) {
  return index % 3 === 1 ? '#312A1E' : '#2A241A'
}

function paperRotation(index: number) {
  return ((index * 37) % 7 - 3) * 0.5
}

function paperLift(index: number) {
  return ((index * 53) % 5 - 2) * 2
}

function tapeRotation(index: number) {
  return (index * 11) % 12 - 6
}

export function RelatedPostsGrid({ posts, locale, category }: Props) {
  if (posts.length === 0) return null

  const catColor = category ? categoryColors[category] ?? 'var(--pb-accent)' : 'var(--pb-accent)'

  return (
    <section
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '48px 28px 80px',
        borderTop: '1px dashed var(--pb-line)',
      }}
    >
      <div
        style={{
          marginBottom: 40,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2
            className="font-fraunces"
            style={{
              fontSize: 34,
              fontWeight: 500,
              margin: '0 0 6px',
              color: 'var(--pb-ink)',
              letterSpacing: '-0.015em',
            }}
          >
            Textos relacionados
          </h2>
          <div
            className="font-jetbrains"
            style={{
              fontSize: 13,
              color: 'var(--pb-muted)',
              letterSpacing: '0.04em',
            }}
          >
            Mais na mesma categoria ·{' '}
            {category && (
              <Link
                href={`/blog/${locale}?category=${encodeURIComponent(category)}`}
                className="no-underline"
                style={{ color: catColor, fontWeight: 600 }}
              >
                {category}
              </Link>
            )}
          </div>
        </div>
        {category && (
          <Link
            href={`/blog/${locale}?category=${encodeURIComponent(category)}`}
            className="font-caveat no-underline"
            style={{
              fontSize: 20,
              color: 'var(--pb-accent)',
              transform: 'rotate(-1deg)',
              display: 'inline-block',
            }}
          >
            <em>Ver categoria</em> →
          </Link>
        )}
      </div>

      <div
        className="related-posts-grid"
        style={{
          display: 'grid',
          gridTemplateColumns:
            posts.length === 1
              ? '1fr'
              : posts.length === 2
                ? 'repeat(2, 1fr)'
                : 'repeat(3, 1fr)',
          gap: 40,
          rowGap: 48,
          maxWidth: posts.length === 1 ? 400 : posts.length === 2 ? 840 : undefined,
          margin: posts.length < 3 ? '0 auto' : undefined,
        }}
      >
        {posts.map((post, i) => (
          <WritingCard key={post.id} post={post} locale={locale} index={i} />
        ))}
      </div>
    </section>
  )
}

function WritingCard({ post, locale, index }: { post: RelatedPost; locale: string; index: number }) {
  const rot = paperRotation(index)
  const lift = paperLift(index)
  const tint = paperTint(index)
  const tapeRot = tapeRotation(index)
  const catColor = post.category ? categoryColors[post.category] ?? 'var(--pb-accent)' : 'var(--pb-accent)'

  return (
    <div style={{ position: 'relative', paddingTop: 16 }}>
      <div
        style={{
          background: tint,
          padding: 0,
          position: 'relative',
          transform: `rotate(${rot}deg) translateY(${lift}px)`,
          boxShadow: '0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)',
        }}
      >
        <Tape
          variant={index % 2 ? 'tape2' : 'tape'}
          className={index % 2 ? 'left-[28%]' : 'right-[28%]'}
          rotate={tapeRot}
        />

        <Link
          href={`/blog/${locale}/${encodeURIComponent(post.slug)}`}
          className="no-underline block"
          style={{ color: 'inherit' }}
        >
          <div style={{ position: 'relative' }}>
            <div
              style={{
                aspectRatio: '16 / 10',
                background: `linear-gradient(135deg, hsl(${(index * 40 + 120) % 360}, 25%, 22%), hsl(${(index * 40 + 140) % 360}, 20%, 15%))`,
                overflow: 'hidden',
              }}
            />
            <div
              className="font-jetbrains"
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                background: 'var(--pb-ink)',
                color: '#FFF',
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                fontWeight: 600,
              }}
            >
              ▤ texto
            </div>
          </div>

          <div style={{ padding: '16px 18px 18px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
                flexWrap: 'wrap',
              }}
            >
              <span
                className="font-jetbrains"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: catColor,
                  fontWeight: 500,
                }}
              >
                {post.category ?? 'Blog'}
              </span>
              <span
                className="font-jetbrains"
                style={{
                  fontSize: 10,
                  color: 'var(--pb-faint)',
                  letterSpacing: '0.08em',
                }}
              >
                {new Date(post.publishedAt).toLocaleDateString(
                  locale === 'pt-BR' ? 'pt-BR' : 'en',
                  { day: '2-digit', month: 'short', year: 'numeric' },
                )}
              </span>
            </div>

            <h3
              className="font-fraunces"
              style={{
                fontSize: 19,
                lineHeight: 1.2,
                margin: '6px 0 8px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--pb-ink)',
              }}
            >
              {post.title}
            </h3>

            <div
              className="font-jetbrains"
              style={{
                fontSize: 12,
                color: 'var(--pb-muted)',
                letterSpacing: '0.04em',
              }}
            >
              {post.readingTimeMin} min · leitura
            </div>

            {post.category && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                <span
                  className="font-jetbrains"
                  style={{
                    fontSize: 9.5,
                    color: 'var(--pb-faint)',
                    letterSpacing: '0.04em',
                    padding: '2px 6px',
                    background: 'rgba(0,0,0,0.04)',
                  }}
                >
                  #{post.category}
                </span>
              </div>
            )}
          </div>
        </Link>
      </div>
    </div>
  )
}
