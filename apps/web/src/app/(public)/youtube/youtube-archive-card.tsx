'use client'

import type { CSSProperties } from 'react'
import type { YouTubeVideoView } from './youtube-types'
import { Paper, Tape, rot, lift } from '@/components/pinboard'
import { type Theme, FlagBadge, VideoThumbnail, formatDate } from './youtube-atoms'
import { VideoLightbox } from '../components/VideoLightbox'

interface ArchiveCardProps {
  video: YouTubeVideoView
  index: number
  locale: 'pt' | 'en'
  theme: Theme
  fmtNum: (n: number) => string
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
        <VideoLightbox youtubeVideoId={video.youtubeVideoId}>
          <div style={{ position: 'relative' }}>
            <VideoThumbnail video={video} lazy={true}/>
            <div style={{ position: 'absolute', top: 8, right: 8 }}>
              <FlagBadge locale={video.locale} size="sm" ink={ink}/>
            </div>
          </div>

          <div style={{ paddingTop: 14, paddingLeft: 4, paddingRight: 4 }}>
            {/* Category + date row */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              {video.categoryName && (
                <span style={{
                  padding: '2px 7px', background: video.categoryColor ?? yt, color: '#FFF',
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
        </VideoLightbox>
      </Paper>
    </div>
  )
}
