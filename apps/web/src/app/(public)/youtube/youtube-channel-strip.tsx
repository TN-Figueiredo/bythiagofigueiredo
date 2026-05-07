'use client'

import { useState } from 'react'
import type { YouTubeChannelView } from './youtube-types'
import { type Theme } from './youtube-atoms'
import type { YouTubeStrings } from '@/lib/content/types'

interface Props {
  locale: 'pt' | 'en'
  theme: Theme
  strings: YouTubeStrings
  channels: YouTubeChannelView[]
}

function ChannelCard({ channel, locale, theme, strings }: { channel: YouTubeChannelView; locale: 'pt' | 'en'; theme: Theme; strings: YouTubeStrings }) {
  const { ink, muted, yt, line, paper } = theme
  const [hovered, setHovered] = useState(false)
  const L = locale

  const gradient = channel.locale === 'pt'
    ? 'linear-gradient(135deg,#009C3B,#FEDF00)'
    : 'linear-gradient(135deg,#0052A5,#BF0A30)'

  const flag = channel.locale === 'pt' ? '\u{1F1E7}\u{1F1F7}' : '\u{1F1FA}\u{1F1F8}'

  const fmtSubs = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', L === 'pt' ? ',' : '.') + 'k'
    return String(n)
  }

  const subsLabel = strings.channel_subs
  const videosLabel = strings.channel_videos

  return (
    <a
      href={channel.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        textDecoration: 'none', color: 'inherit',
        display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16,
        alignItems: 'center', padding: '16px 20px',
        border: `1.5px solid ${hovered ? yt : line}`,
        background: hovered ? paper : 'transparent',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, color: '#FFF', boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
      }}>
        {flag}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: '"Fraunces", serif', fontSize: 17, fontWeight: 500, color: ink, letterSpacing: '-0.005em' }}>
          {channel.name}
        </div>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: muted, marginTop: 4, letterSpacing: '0.06em' }}>
          {fmtSubs(channel.subscriberCount)} {subsLabel} {'·'} {channel.videoCount} {videosLabel}
        </div>
      </div>
      <span style={{
        padding: '6px 11px', background: yt, color: '#FFF',
        fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
        letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap',
      }}>
        {'▶'} {strings.channel_open}
      </span>
    </a>
  )
}

export function YouTubeChannelStrip({ locale, theme, strings, channels }: Props) {
  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '8px 28px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {channels.map(c => (
          <ChannelCard key={c.id} channel={c} locale={locale} theme={theme} strings={strings}/>
        ))}
      </div>
    </section>
  )
}
