'use client'

import type { YouTubeCuratedCommentView } from './youtube-types'
import type { YouTubeStrings } from '@/lib/content/types'
import { t } from '@/lib/content/template'
import { Paper, Tape } from '@/components/pinboard'
import { type Theme, FlagBadge } from './youtube-atoms'

interface Props {
  locale: 'pt' | 'en'
  theme: Theme
  comments: YouTubeCuratedCommentView[]
  strings: YouTubeStrings
}

/* ── Atoms ── */

function formatRelativeTime(iso: string | null, strings: YouTubeStrings): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (days < 1) return strings.comments_relative_today
  if (days < 7) return t(strings.comments_relative_days, { n: days })
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return t(strings.comments_relative_weeks, { n: weeks })
  const months = Math.floor(days / 30)
  if (months < 12) return t(strings.comments_relative_months, { n: months })
  const years = Math.floor(days / 365)
  return t(strings.comments_relative_years, { n: years })
}

function fmtNum(n: number, locale: 'pt' | 'en'): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', locale === 'pt' ? ',' : '.') + 'k'
  return String(n)
}

/* ── Comment Card ── */

function CommentCard({
  comment, index, locale, theme, strings,
}: {
  comment: YouTubeCuratedCommentView
  index: number
  locale: 'pt' | 'en'
  theme: Theme
  strings: YouTubeStrings
}) {
  const { ink, muted, faint, line, yt, paper, paper2, tape, tape2, tapeR } = theme
  const L = locale
  const text = L === 'pt' ? comment.textPt : comment.textEn
  const tilt = (index % 4 - 1.5) * 0.7

  const tapeColor = index % 3 === 0 ? tape : index % 3 === 1 ? tape2 : tapeR
  const tapeLeft = index % 2 ? '20%' : '62%'
  const tapeDeg = (index * 11) % 14 - 7

  const borderColor = comment.channelLocale === 'pt'
    ? 'rgba(0,156,59,0.6)'
    : 'rgba(0,82,165,0.6)'

  const gradient = comment.channelLocale === 'pt'
    ? 'linear-gradient(135deg, rgba(0,156,59,0.25), rgba(254,223,0,0.2))'
    : 'linear-gradient(135deg, rgba(0,82,165,0.25), rgba(191,10,48,0.2))'

  return (
    <div style={{ position: 'relative', paddingTop: 14 }}>
      <Paper tint={index % 2 ? paper2 : paper} padding="0" rotation={tilt}>
        <Tape
          color={tapeColor}
          style={{ top: -10, left: tapeLeft, transform: `rotate(${tapeDeg}deg)`, width: 80 }}
        />
        <div style={{ padding: '20px 22px 18px' }}>
          {/* Author */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              border: `1.5px solid ${borderColor}`,
              overflow: 'hidden',
              background: gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {comment.authorAvatarUrl ? (
                <img
                  src={comment.authorAvatarUrl}
                  alt={comment.authorHandle}
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 14,
                  fontWeight: 700, color: ink, opacity: 0.6,
                }}>
                  {comment.authorHandle.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
                fontWeight: 600, color: ink, letterSpacing: '0.02em',
              }}>
                @{comment.authorHandle}
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: faint,
                marginTop: 2, letterSpacing: '0.06em',
                display: 'flex', gap: 6, alignItems: 'center',
              }}>
                {formatRelativeTime(comment.publishedAt, strings)}
                {' · '}
                <FlagBadge locale={comment.channelLocale} size="sm" ink={ink}/>
              </div>
            </div>
          </div>

          {/* Quote */}
          <div style={{
            fontFamily: '"Fraunces", serif', fontSize: 18, lineHeight: 1.42,
            color: ink, marginBottom: 16, letterSpacing: '-0.008em',
            fontStyle: 'italic', position: 'relative', paddingLeft: 18,
          }}>
            <span style={{
              position: 'absolute', left: 0, top: -6,
              fontSize: 36, color: yt, fontFamily: 'Georgia, serif',
              lineHeight: 1, opacity: 0.8,
            }}>{'"'}</span>
            {text}
          </div>

          {/* Footer: video link + like count */}
          <a
            href={`https://www.youtube.com/watch?v=${comment.videoYoutubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingTop: 12, borderTop: `1px dashed ${line}`,
              textDecoration: 'none', color: 'inherit',
            }}
          >
            <span style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              color: muted, letterSpacing: '0.04em',
              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {'▶'} {comment.videoTitle}
            </span>
            <span style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              color: yt, fontWeight: 600, marginLeft: 10, whiteSpace: 'nowrap',
            }}>
              {'♥'} {fmtNum(comment.likeCount, L)}
            </span>
          </a>
        </div>
      </Paper>
    </div>
  )
}

/* ── Comments Wall ── */

export function YouTubeCommentsWall({ locale, theme, comments, strings }: Props) {
  const { ink, muted, yt, hand } = theme
  const L = locale

  // Take top 4 (already sorted server-side by display_order then like_count)
  const top = comments.slice(0, 4)

  if (top.length === 0) return null

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '92px 28px 0' }}>
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 60, alignItems: 'start' }}
        className="keep-2col"
      >
        {/* Left: editorial intro */}
        <div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: yt, marginBottom: 12,
          }}>
            {'§ 03 · '}{strings.comments_section_label}
          </div>

          <h2 style={{
            fontFamily: '"Fraunces", serif', fontSize: 36, margin: '0 0 14px', fontWeight: 500,
            letterSpacing: '-0.022em', textWrap: 'balance' as React.CSSProperties['textWrap'],
            color: ink, lineHeight: 1.1,
          }}>
            {strings.comments_headline}
          </h2>

          <p style={{
            fontSize: 14.5, color: muted,
            fontFamily: '"Source Serif 4", Georgia, serif',
            maxWidth: 360, margin: 0, lineHeight: 1.55,
          }}>
            {strings.comments_description}
          </p>

          <div style={{
            ...hand, fontSize: 22, color: yt,
            transform: 'rotate(-3deg)', marginTop: 32, display: 'inline-block',
          }}>
            {'→ '}{strings.comments_scroll_annotation}
          </div>
        </div>

        {/* Right: 2x2 grid of comment cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'start' }}>
          {top.map((c, i) => (
            <CommentCard key={c.id} comment={c} index={i} locale={L} theme={theme} strings={strings}/>
          ))}
        </div>
      </div>
    </section>
  )
}
