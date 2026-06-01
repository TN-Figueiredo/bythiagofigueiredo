'use client'

import type { YouTubeVideoView } from './youtube-types'

export interface Theme {
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

export function FlagBadge({ locale, size = 'md', ink }: { locale: 'pt' | 'en'; size?: 'sm' | 'md'; ink: string }) {
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

export function VideoThumbnail({ video, aspect = '16/9', lazy = false }: { video: YouTubeVideoView; aspect?: string; lazy?: boolean }) {
  const src = video.thumbnailHqUrl ?? video.thumbnailUrl
  return (
    <div style={{ position: 'relative', aspectRatio: aspect, overflow: 'hidden', background: 'rgba(0,0,0,0.3)' }}>
      {src ? (
        <img
          src={src}
          alt={video.title}
          loading={lazy ? 'lazy' : undefined}
          referrerPolicy="no-referrer"
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

export function formatDate(iso: string, locale: 'pt' | 'en'): string {
  const d = new Date(iso)
  if (locale === 'pt') return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
