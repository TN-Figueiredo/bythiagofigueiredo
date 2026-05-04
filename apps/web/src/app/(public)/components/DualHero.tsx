import Link from 'next/link'
import { coverGradient } from '../../../../lib/home/cover-image'
import type { HomePost, HomeVideo } from '../../../../lib/home/types'

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

type Props = {
  post: HomePost | null
  video: HomeVideo | null
  locale: 'en' | 'pt-BR'
  t: Record<string, string>
}

export function DualHero({ post, video, locale, t }: Props) {
  const blogBase = locale === 'pt-BR' ? '/pt/blog' : '/blog'
  const isPt = locale === 'pt-BR'

  const now = new Date()
  const weekNum = getWeekNumber(now)
  const year = now.getFullYear()

  const postDate = post
    ? new Date(post.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const videoDate = video
    ? new Date(video.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  const hasContent = post || video
  if (!hasContent) return null

  const cols = post && video ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto'

  return (
    <section className="px-[18px] md:px-7" style={{ maxWidth: 1280, margin: '0 auto', paddingTop: 56, paddingBottom: 24 }}>
      <h2 id="hero-heading" className="sr-only">
        {isPt ? 'Destaque da semana' : "This week's picks"}
      </h2>

      {/* Section header */}
      <div aria-labelledby="hero-heading" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
        <div className="font-caveat" style={{ color: 'var(--pb-accent)', fontSize: 30, transform: 'rotate(-1.5deg)', display: 'inline-block', whiteSpace: 'nowrap' }}>
          ★ {isPt ? 'o destaque da semana' : "this week's picks"}
        </div>
        <div style={{ flex: 1, height: 1, background: 'var(--pb-line)' }} />
        <span className="font-mono" style={{ fontSize: 11, color: 'var(--pb-muted)', letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
          {isPt ? 'SEM' : 'WK'} {weekNum} · {year}
        </span>
      </div>

      {/* Two-column grid — stacks on mobile */}
      <div className={`grid ${cols} gap-7 md:gap-10`}>

        {/* ── Post card ── */}
        {post && (
          <div style={{ position: 'relative', paddingTop: 20, paddingBottom: 28 }}>
            <div
              className="dh-card"
              style={{ background: 'var(--pb-paper)', position: 'relative', transform: 'rotate(-0.8deg)', boxShadow: 'var(--pb-shadow-card)' }}
            >
              {/* Tapes — sticking over the top edge */}
              <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: 'var(--pb-tape)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, left: '18%', transform: 'rotate(-4deg)' }} />
              <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: 'var(--pb-tape2)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, right: '18%', transform: 'rotate(5deg)' }} />

              <Link href={`${blogBase}/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                {/* Cover */}
                <div style={{ position: 'relative', overflow: 'hidden', background: coverGradient(post.tagName ?? post.category, false, post.tagColor), aspectRatio: '16 / 9' }}>
                  <div style={{ position: 'absolute', top: 8, left: 8 }}>
                    <span className="font-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: 'var(--pb-ink)', color: 'var(--pb-paper)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
                      ▤ {isPt ? 'texto' : 'post'}
                    </span>
                  </div>
                </div>
                {/* Body */}
                <div style={{ padding: '22px 26px 26px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    {(post.tagName ?? post.category) && (
                      <span className="font-mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: post.tagColor ?? 'var(--pb-accent)', fontWeight: 500 }}>
                        {post.tagName ?? post.category}
                      </span>
                    )}
                    {postDate && (
                      <span className="font-mono" style={{ fontSize: 10, color: 'var(--pb-muted)', letterSpacing: '0.1em' }}>
                        {postDate} · {post.readingTimeMin} min
                      </span>
                    )}
                  </div>
                  <h3 className="font-fraunces" style={{ fontSize: 'clamp(24px, 2.8vw, 34px)', lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, fontWeight: 500, color: 'var(--pb-ink)' }}>
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p style={{ fontSize: 14.5, color: 'var(--pb-muted)', lineHeight: 1.55, marginTop: 12, marginBottom: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            </div>
            <div className="font-caveat hidden md:block" style={{ position: 'absolute', bottom: -22, left: 32, color: 'var(--pb-accent)', fontSize: 20, transform: 'rotate(-2deg)' }}>
              {t['hero.post.mustRead'] ?? (isPt ? '← leitura obrigatória' : '← must-read')}
            </div>
          </div>
        )}

        {/* ── Video card ── */}
        {video && (
          <div style={{ position: 'relative', paddingTop: 20, paddingBottom: 28 }}>
            <div
              className="dh-card dh-card-video"
              style={{ background: 'var(--pb-paper)', position: 'relative', transform: 'rotate(0.8deg)', boxShadow: 'var(--pb-shadow-card)' }}
            >
              <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: 'var(--pb-tapeR)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, left: '22%', transform: 'rotate(4deg)' }} />
              <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: 'var(--pb-tape)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, right: '15%', transform: 'rotate(-3deg)' }} />

              <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                {/* Thumbnail */}
                <div style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', background: 'linear-gradient(135deg, #51201F 0%, #142229 100%)' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.55))' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 68, height: 48, background: 'var(--pb-yt)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,51,51,0.4)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                  <div className="font-mono" style={{ position: 'absolute', top: 8, left: 8, background: 'var(--pb-yt)', color: '#FFF', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, padding: '3px 7px' }}>
                    ▶ YouTube
                  </div>
                  <div className="font-mono" style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.85)', color: '#FFF', fontSize: 11, padding: '2px 7px' }}>
                    {video.duration}
                  </div>
                </div>
                {/* Body */}
                <div style={{ padding: '22px 26px 26px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span className="font-mono" style={{ padding: '2px 8px', background: 'var(--pb-yt)', color: '#FFF', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                      {video.series}
                    </span>
                    <span className="font-mono" style={{ fontSize: 10, color: 'var(--pb-muted)', letterSpacing: '0.1em' }}>
                      {video.viewCount !== '—' ? `${video.viewCount} · ` : ''}{videoDate}
                    </span>
                  </div>
                  <h3 className="font-fraunces" style={{ fontSize: 'clamp(24px, 2.8vw, 34px)', lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, fontWeight: 500, color: 'var(--pb-ink)' }}>
                    {video.title}
                  </h3>
                  <p style={{ fontSize: 14.5, color: 'var(--pb-muted)', lineHeight: 1.55, marginTop: 12, marginBottom: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {video.description}
                  </p>
                </div>
              </a>
            </div>
            <div className="font-caveat hidden md:block" style={{ position: 'absolute', bottom: -22, right: 32, color: 'var(--pb-accent)', fontSize: 20, transform: 'rotate(2deg)' }}>
              {t['hero.video.fresh'] ?? (isPt ? 'novo no canal →' : 'fresh on the channel →')}
            </div>
          </div>
        )}
      </div>

    </section>
  )
}
