'use client'

import { type Theme } from './youtube-atoms'
import type { YouTubeStrings } from '@/lib/content/types'

interface Props {
  theme: Theme
  strings: YouTubeStrings
  videoCount: number
  hoursTotal: string
  totalComments: number
  mostWatchedViews: number
  fmtNum: (n: number) => string
}

export function YouTubeStatsStrip({ theme, strings, videoCount, hoursTotal, totalComments, mostWatchedViews, fmtNum }: Props) {
  const { ink, faint, line } = theme

  const stats = [
    { label: strings.stats_videos_published, value: String(videoCount) },
    { label: strings.stats_hours_of_content, value: hoursTotal + ' h' },
    { label: strings.stats_comments_answered, value: fmtNum(totalComments) },
    { label: strings.stats_most_watched, value: fmtNum(mostWatchedViews) },
  ]

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 28px 0' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0,
        padding: '22px 0',
        borderTop: `1px dashed ${line}`, borderBottom: `1px dashed ${line}`,
      }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            padding: '0 24px',
            borderRight: i < 3 ? `1px dashed ${line}` : 'none',
            position: 'relative',
          }}>
            <div style={{
              fontFamily: '"Fraunces", serif', fontSize: 32, fontWeight: 500,
              color: ink, letterSpacing: '-0.014em', lineHeight: 1.05,
            }}>
              {s.value}
            </div>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              letterSpacing: '0.16em', textTransform: 'uppercase', color: faint,
              marginTop: 8,
            }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
