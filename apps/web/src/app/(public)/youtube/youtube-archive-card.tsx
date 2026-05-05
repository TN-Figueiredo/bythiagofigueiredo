'use client'

import type { CSSProperties } from 'react'
import type { YouTubeVideoView } from './youtube-types'
import { Paper, Tape, rot, lift } from '@/components/pinboard'

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

interface ArchiveCardProps {
  video: YouTubeVideoView
  index: number
  locale: 'pt' | 'en'
  theme: Theme
  fmtNum: (n: number) => string
}

function FlagBadge({ locale, ink }: { locale: 'pt' | 'en'; ink: string }) {
  const colors = locale === 'pt'
    ? { bg: 'rgba(0,156,59,0.18)', border: 'rgba(0,156,59,0.5)', flag: '\u{1F1E7}\u{1F1F7}' }
    : { bg: 'rgba(0,82,165,0.18)', border: 'rgba(0,82,165,0.55)', flag: '\u{1F1FA}\u{1F1F8}' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '1px 6px',
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
      letterSpacing: '0.1em', color: ink, fontWeight: 600,
    }}>
      <span style={{ fontSize: 11, lineHeight: 1 }}>{colors.flag}</span>
      {locale.toUpperCase()}
    </span>
  )
}

function VideoThumbnail({ video }: { video: YouTubeVideoView }) {
  const src = video.thumbnailHqUrl ?? video.thumbnailUrl
  return (
    <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
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
  if (locale === 'pt') return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function YouTubeArchiveCard({ video, index, locale, theme, fmtNum }: ArchiveCardProps) {
  const { ink, muted, faint, yt, paper, tapeR } = theme
  const tapeRotation = (index * 7) % 10 - 5

  return (
    <div style={{ position: 'relative', paddingTop: 16 }}>
      <Paper
        tint={paper}
        padding="12px 12px 18px"
        rotation={rot(index + 11)}
        translateY={lift(index + 11)}
      >
        <Tape
          color={tapeR}
          style={{ top: -9, left: '40%', transform: `rotate(${tapeRotation}deg)` }}
        />
        <a
          href={`https://www.youtube.com/watch?v=${video.youtubeVideoId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
        >
          <div style={{ position: 'relative' }}>
            <VideoThumbnail video={video}/>
            <div style={{ position: 'absolute', top: 8, right: 8 }}>
              <FlagBadge locale={video.locale} ink={ink}/>
            </div>
          </div>

          <div style={{ paddingTop: 14, paddingLeft: 4, paddingRight: 4 }}>
            {/* Category + date row */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              {video.categoryName && (
                <span style={{
                  padding: '2px 7px', background: yt, color: '#FFF',
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
                  letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700,
                }}>
                  {video.categoryName}
                </span>
              )}
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                color: faint, letterSpacing: '0.06em',
              }}>
                {formatDate(video.publishedAt, locale)}
              </span>
            </div>

            {/* Title */}
            <h3 style={{
              fontFamily: '"Fraunces", serif', fontSize: 18, margin: '4px 0 8px', fontWeight: 500,
              lineHeight: 1.22, letterSpacing: '-0.008em', color: ink,
              textWrap: 'balance' as CSSProperties['textWrap'],
            }}>
              {video.title}
            </h3>

            {/* Description */}
            <p style={{
              fontSize: 12.5, lineHeight: 1.5, color: muted,
              fontFamily: '"Source Serif 4", Georgia, serif', margin: '0 0 10px',
            }}>
              {video.description ?? ''}
            </p>

            {/* Duration + views */}
            <div style={{
              display: 'flex', gap: 12,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
              color: muted, letterSpacing: '0.04em', flexWrap: 'wrap',
            }}>
              <span>{video.duration}</span>
              <span>·</span>
              <span>{fmtNum(video.viewCount)} views</span>
            </div>

            {/* Tags */}
            {video.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
                {video.tags.slice(0, 3).map(tag => (
                  <span key={tag} style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
                    color: faint, letterSpacing: '0.04em',
                    padding: '2px 6px', background: 'rgba(0,0,0,0.04)',
                  }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </a>
      </Paper>
    </div>
  )
}
