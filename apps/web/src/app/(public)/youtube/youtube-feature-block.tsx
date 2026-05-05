'use client'

import { useState, type CSSProperties } from 'react'
import type { YouTubeVideoView, YouTubeCategoryView } from './youtube-types'
import { Paper, Tape } from '@/components/pinboard'

interface Theme {
  bg: string
  ink: string
  muted: string
  faint: string
  line: string
  accent: string
  marker: string
  yt: string
  paper: string
  paper2: string
  tape: string
  tape2: string
  tapeR: string
  hand: { fontFamily: string; fontWeight: number }
}

interface Props {
  locale: 'pt' | 'en'
  theme: Theme
  featurePick: YouTubeVideoView | null
  featureSidekicks: YouTubeVideoView[]
  categories: YouTubeCategoryView[]
  fmtNum: (n: number) => string
  onCategoryClick: (slug: string) => void
}

/* ── Atoms (copied from hero for co-location) ── */

function FlagBadge({ locale, size = 'md', ink }: { locale: 'pt' | 'en'; size?: 'sm' | 'md'; ink: string }) {
  const colors = locale === 'pt'
    ? { bg: 'rgba(0,156,59,0.18)', border: 'rgba(0,156,59,0.5)', flag: '\u{1F1E7}\u{1F1F7}' }
    : { bg: 'rgba(0,82,165,0.18)', border: 'rgba(0,82,165,0.55)', flag: '\u{1F1FA}\u{1F1F8}' }
  const fontSize = size === 'sm' ? 9 : 10
  const flagSize = size === 'sm' ? 11 : 12
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: size === 'sm' ? '1px 6px' : '2px 7px',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      fontFamily: '"JetBrains Mono", monospace', fontSize,
      letterSpacing: '0.1em', color: ink, fontWeight: 600,
    }}>
      <span style={{ fontSize: flagSize, lineHeight: 1 }}>{colors.flag}</span>
      {locale.toUpperCase()}
    </span>
  )
}

function Stat({ icon, value, muted, yt }: { icon: string; value: string; muted: string; yt: string }) {
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
      color: muted, letterSpacing: '0.04em',
      display: 'inline-flex', gap: 5, alignItems: 'center',
    }}>
      <span style={{ color: yt, fontSize: 10 }}>{icon}</span>
      {value}
    </span>
  )
}

function VideoThumbnail({ video, aspect = '16/9' }: { video: YouTubeVideoView; aspect?: string }) {
  const src = video.thumbnailHqUrl ?? video.thumbnailUrl
  return (
    <div style={{ position: 'relative', aspectRatio: aspect, overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
      {src ? (
        <img
          src={src}
          alt={video.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(135deg, rgba(255,45,32,0.2), rgba(199,112,46,0.15))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 40, height: 28, background: 'rgba(255,45,32,0.8)', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      )}
      <div style={{
        position: 'absolute', bottom: 4, right: 4,
        background: 'rgba(0,0,0,0.85)', color: '#FFF',
        fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
        padding: '1px 5px', lineHeight: 1.4,
      }}>
        {video.duration}
      </div>
    </div>
  )
}

function formatDate(iso: string, locale: 'pt' | 'en'): string {
  const d = new Date(iso)
  if (locale === 'pt') {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ── Sidekick card (with hover) ── */

function SidekickCard({ video, locale, theme }: { video: YouTubeVideoView; locale: 'pt' | 'en'; theme: Theme }) {
  const { ink, faint, muted, yt, paper, line } = theme
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14,
        textDecoration: 'none', color: 'inherit',
        padding: '10px 6px',
        border: `1px solid ${hovered ? line : 'transparent'}`,
        background: hovered ? paper : 'transparent',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        position: 'relative', aspectRatio: '16/9', overflow: 'hidden',
        background: 'rgba(0,0,0,0.3)',
      }}>
        {(video.thumbnailUrl || video.thumbnailHqUrl) ? (
          <img
            src={video.thumbnailHqUrl ?? video.thumbnailUrl ?? ''}
            alt={video.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(255,45,32,0.15), rgba(199,112,46,0.1))' }}/>
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 30, height: 22, background: yt, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div style={{
          position: 'absolute', bottom: 3, right: 3,
          background: 'rgba(0,0,0,0.85)', color: '#FFF',
          fontFamily: '"JetBrains Mono", monospace', fontSize: 9, padding: '1px 4px',
        }}>
          {video.duration}
        </div>
        <div style={{ position: 'absolute', top: 3, left: 3 }}>
          <FlagBadge locale={video.locale} size="sm" ink={ink}/>
        </div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: faint,
          letterSpacing: '0.08em', marginBottom: 4, textTransform: 'uppercase',
        }}>
          {video.categoryName ?? ''} {'·'} {formatDate(video.publishedAt, locale)}
        </div>
        <div style={{
          fontFamily: '"Fraunces", serif', fontSize: 15.5, lineHeight: 1.22,
          color: ink, fontWeight: 500, letterSpacing: '-0.008em',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {video.title}
        </div>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: muted,
          marginTop: 6, letterSpacing: '0.04em',
        }}>
          <Stat icon="▶" value={String(video.viewCount)} muted={muted} yt={yt}/>
          {' '}{'·'}{' '}
          <Stat icon="♥" value={String(video.likeCount)} muted={muted} yt={yt}/>
        </div>
      </div>
    </a>
  )
}

/* ── Feature Block ── */

export function YouTubeFeatureBlock({ locale, theme, featurePick, featureSidekicks, categories, fmtNum, onCategoryClick }: Props) {
  const { ink, muted, faint, line, accent, yt, paper, tape2, hand } = theme
  const L = locale

  if (!featurePick) return null

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 28px 0' }}>
      {/* Kicker */}
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
        letterSpacing: '0.2em', textTransform: 'uppercase',
        color: accent, marginBottom: 12,
      }}>
        {'§ 02 · '}{L === 'pt' ? 'esta semana, em destaque' : "this week's pick"}
      </div>

      {/* Heading + hand annotation */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        marginBottom: 28, flexWrap: 'wrap', gap: 12,
      }}>
        <h2 style={{
          fontFamily: '"Fraunces", serif', fontSize: 40, margin: 0, fontWeight: 500,
          letterSpacing: '-0.022em', textWrap: 'balance' as CSSProperties['textWrap'],
        }}>
          {L === 'pt' ? 'O que vale a pena reservar 20 minutos' : "What's worth setting aside 20 minutes for"}
        </h2>
        <span style={{
          ...hand, fontSize: 18, color: yt,
          transform: 'rotate(-1.5deg)', display: 'inline-block',
        }}>
          {L === 'pt' ? '↓ minha escolha' : '↓ my pick'}
        </span>
      </div>

      {/* Grid: big pick + sidekick column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 32, alignItems: 'start' }} className="keep-2col">
        {/* Big featured card */}
        <a
          href={`https://www.youtube.com/watch?v=${featurePick.youtubeVideoId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            textDecoration: 'none', color: 'inherit',
            display: 'block', position: 'relative', paddingTop: 18,
          }}
        >
          <Paper tint={paper} padding="0" rotation={-0.3}>
            <Tape color={tape2} style={{ top: -10, left: '30%', transform: 'rotate(-3deg)', width: 100 }}/>
            <VideoThumbnail video={featurePick} aspect="16/9"/>
            <div style={{ padding: '22px 26px 24px' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <FlagBadge locale={featurePick.locale} size="sm" ink={ink}/>
                {featurePick.categoryName && (
                  <span style={{
                    padding: '2px 7px', background: accent, color: '#FFF',
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
                    letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
                  }}>
                    {featurePick.categoryName}
                  </span>
                )}
                <span style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: faint,
                }}>
                  {'·'} {formatDate(featurePick.publishedAt, L)} {'·'} {featurePick.duration}
                </span>
              </div>
              <h3 style={{
                fontFamily: '"Fraunces", serif', fontSize: 28, margin: '4px 0 12px', fontWeight: 500,
                lineHeight: 1.16, letterSpacing: '-0.014em', color: ink,
                textWrap: 'balance' as CSSProperties['textWrap'],
              }}>
                {featurePick.title}
              </h3>
              <p style={{
                fontSize: 15, lineHeight: 1.6, color: muted,
                fontFamily: '"Source Serif 4", Georgia, serif', margin: 0,
              }}>
                {featurePick.description ?? ''}
              </p>
              <div style={{ display: 'flex', gap: 14, marginTop: 16, flexWrap: 'wrap' }}>
                <Stat icon="▶" value={fmtNum(featurePick.viewCount)} muted={muted} yt={yt}/>
                <Stat icon="♥" value={fmtNum(featurePick.likeCount)} muted={muted} yt={yt}/>
                <Stat icon="✎" value={String(featurePick.commentCount)} muted={muted} yt={yt}/>
              </div>
            </div>
          </Paper>
        </a>

        {/* Right: 3 sidekick cards + series chips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 18 }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: '0.2em',
            textTransform: 'uppercase', color: faint, paddingBottom: 8,
            borderBottom: `1px dashed ${line}`,
          }}>
            {L === 'pt' ? 'também rolaram' : 'also dropped'}
          </div>

          {featureSidekicks.map(v => (
            <SidekickCard key={v.id} video={v} locale={L} theme={theme}/>
          ))}

          {/* Series shortcut chips */}
          {categories.length > 0 && (
            <div style={{ paddingTop: 14, marginTop: 4, borderTop: `1px dashed ${line}` }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: faint, marginBottom: 10,
              }}>
                {L === 'pt' ? 'ir direto pra uma série' : 'jump to a series'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {categories.map(c => (
                  <button
                    key={c.slug}
                    onClick={() => onCategoryClick(c.slug)}
                    style={{
                      padding: '5px 9px',
                      background: 'transparent', color: ink,
                      border: `1px solid ${line}`,
                      fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                      letterSpacing: '0.06em', cursor: 'pointer',
                      display: 'inline-flex', gap: 5, alignItems: 'center',
                    }}
                  >
                    {'▶'} {L === 'pt' ? c.namePt : c.nameEn}{' '}
                    <span style={{ color: faint, fontSize: 9 }}>{c.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
