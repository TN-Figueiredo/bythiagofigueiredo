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
  isDark: boolean
}

export function DualHero({ post, video, locale, t, isDark }: Props) {
  const blogBase = locale === 'pt-BR' ? '/blog/pt-BR' : '/blog/en'
  const isPt = locale === 'pt-BR'

  const paper   = isDark ? '#2A241A' : '#FBF6E8'
  const ink     = isDark ? '#EFE6D2' : '#161208'
  const muted   = isDark ? '#958A75' : '#6A5F48'
  const line    = isDark ? '#2E2718' : '#CEBFA0'
  const accent  = isDark ? '#FF8240' : '#C14513'
  const cat     = isDark ? '#5B9BD5' : '#1E4D7A'
  const yt      = '#FF3333'
  const tape1   = isDark ? 'rgba(255,226,140,0.42)' : 'rgba(255,226,140,0.75)'
  const tape2   = isDark ? 'rgba(209,224,255,0.36)' : 'rgba(200,220,255,0.7)'
  const tapeR   = isDark ? 'rgba(255,120,120,0.40)' : 'rgba(255,150,150,0.7)'
  const shadow  = isDark
    ? '0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)'
    : '0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03)'

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

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px 40px' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 36 }}>
        <div style={{ fontFamily: '"Caveat", cursive', color: accent, fontSize: 30, transform: 'rotate(-1.5deg)', display: 'inline-block', whiteSpace: 'nowrap' }}>
          ★ {isPt ? 'o destaque da semana' : "this week's highlight"}
        </div>
        <div style={{ flex: 1, height: 1, background: line }} />
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: muted, letterSpacing: '0.14em', whiteSpace: 'nowrap' }}>
          {isPt ? 'SEM' : 'WK'} {weekNum} · {year}
        </span>
      </div>

      {/* Two-column grid — stacks on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 40 }}>

        {/* ── Post card ── */}
        {post && (
          <div style={{ position: 'relative', paddingTop: 20 }}>
            <div
              className="dh-card"
              style={{ background: paper, position: 'relative', transform: 'rotate(-0.8deg)', boxShadow: shadow }}
            >
              {/* Tapes — sticking over the top edge */}
              <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: tape1, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, left: '18%', transform: 'rotate(-4deg)' }} />
              <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: tape2, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, right: '18%', transform: 'rotate(5deg)' }} />

              <Link href={`${blogBase}/${post.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                {/* Cover */}
                <div style={{ position: 'relative', overflow: 'hidden', background: coverGradient(post.category, isDark), aspectRatio: '16 / 9' }}>
                  <div style={{ position: 'absolute', top: 8, left: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: ink, color: isDark ? '#14110B' : '#FBF6E8', fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>
                      ▤ {isPt ? 'texto' : 'post'}
                    </span>
                  </div>
                </div>
                {/* Body */}
                <div style={{ padding: '22px 26px 26px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    {post.category && (
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: cat, fontWeight: 500 }}>
                        {post.category}
                      </span>
                    )}
                    {postDate && (
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: muted, letterSpacing: '0.1em' }}>
                        {postDate} · {post.readingTimeMin} min
                      </span>
                    )}
                  </div>
                  <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: 'clamp(22px, 2.6vw, 34px)', lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, fontWeight: 500, color: ink }}>
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p style={{ fontSize: 14.5, color: muted, lineHeight: 1.55, marginTop: 12, marginBottom: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {post.excerpt}
                    </p>
                  )}
                  <div style={{ marginTop: 16, fontFamily: '"Caveat", cursive', color: accent, fontSize: 20, transform: 'rotate(-2deg)', display: 'inline-block' }}>
                    {t['hero.post.mustRead'] ?? (isPt ? '← leitura obrigatória' : '← must-read')}
                  </div>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* ── Video card ── */}
        {video && (
          <div style={{ position: 'relative', paddingTop: 20 }}>
            <div
              className="dh-card dh-card-video"
              style={{ background: paper, position: 'relative', transform: 'rotate(0.8deg)', boxShadow: shadow }}
            >
              <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: tapeR, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, left: '22%', transform: 'rotate(4deg)' }} />
              <div aria-hidden="true" style={{ position: 'absolute', width: 80, height: 18, background: tape1, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.2)', top: -10, right: '15%', transform: 'rotate(-3deg)' }} />

              <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                {/* Thumbnail */}
                <div style={{ position: 'relative', aspectRatio: '16 / 9', overflow: 'hidden', background: 'linear-gradient(135deg, #51201F 0%, #142229 100%)' }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.55))' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 68, height: 48, background: yt, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,51,51,0.4)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z" /></svg>
                    </div>
                  </div>
                  <div style={{ position: 'absolute', top: 8, left: 8, background: yt, color: '#FFF', fontFamily: '"JetBrains Mono", monospace', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, padding: '3px 7px' }}>
                    ▶ YouTube
                  </div>
                  <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.85)', color: '#FFF', fontFamily: '"JetBrains Mono", monospace', fontSize: 11, padding: '2px 7px' }}>
                    {video.duration}
                  </div>
                </div>
                {/* Body */}
                <div style={{ padding: '22px 26px 26px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', background: yt, color: '#FFF', fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
                      {video.series}
                    </span>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: muted, letterSpacing: '0.1em' }}>
                      {video.viewCount !== '—' ? `${video.viewCount} · ` : ''}{videoDate}
                    </span>
                  </div>
                  <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: 'clamp(22px, 2.6vw, 34px)', lineHeight: 1.08, letterSpacing: '-0.02em', margin: 0, fontWeight: 500, color: ink }}>
                    {video.title}
                  </h2>
                  <p style={{ fontSize: 14.5, color: muted, lineHeight: 1.55, marginTop: 12, marginBottom: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {video.description}
                  </p>
                  <div style={{ marginTop: 16, fontFamily: '"Caveat", cursive', color: accent, fontSize: 20, transform: 'rotate(2deg)', display: 'inline-block' }}>
                    {t['hero.video.fresh'] ?? (isPt ? 'novo no canal →' : 'fresh on the channel →')}
                  </div>
                </div>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Breathing room */}
      <div style={{ height: 16 }} />
    </section>
  )
}
