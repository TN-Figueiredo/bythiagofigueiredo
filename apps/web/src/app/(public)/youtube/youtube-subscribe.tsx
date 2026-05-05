'use client'

import { useState } from 'react'
import type { YouTubeChannelView } from './youtube-types'
import { type Theme } from './youtube-atoms'

interface Props {
  locale: 'pt' | 'en'
  theme: Theme
  channels: YouTubeChannelView[]
}

/* ── Channel subscribe card with hover ── */

function ChannelSubscribeCard({ channel, locale, theme }: { channel: YouTubeChannelView; locale: 'pt' | 'en'; theme: Theme }) {
  const { ink, muted, yt, paper, line } = theme
  const L = locale
  const [hovered, setHovered] = useState(false)

  const flag = channel.locale === 'pt' ? '\u{1F1E7}\u{1F1F7}' : '\u{1F1FA}\u{1F1F8}'

  const fmtSubs = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', L === 'pt' ? ',' : '.') + 'k'
    return String(n)
  }

  const subsLabel = L === 'pt' ? 'inscritos' : 'subs'

  return (
    <a
      href={channel.url + '?sub_confirmation=1'}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        padding: '22px 16px', textDecoration: 'none', color: 'inherit',
        background: paper, border: `1px solid ${hovered ? yt : line}`,
        transition: 'transform 0.15s, border-color 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ fontSize: 32 }}>{flag}</div>
      <div style={{
        fontFamily: '"Fraunces", serif', fontSize: 17,
        fontWeight: 500, color: ink,
      }}>
        {channel.name}
      </div>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
        color: muted, letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.5,
      }}>
        {fmtSubs(channel.subscriberCount)} {subsLabel}
        <br/>
        {channel.description ?? ''}
      </div>
      <span style={{
        marginTop: 6, padding: '8px 16px',
        background: yt, color: '#FFF',
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
        letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700,
      }}>
        {'▶'} {L === 'pt' ? 'inscrever' : 'subscribe'}
      </span>
    </a>
  )
}

/* ── Subscribe section ── */

export function YouTubeSubscribe({ locale, theme, channels }: Props) {
  const { muted, yt } = theme
  const L = locale

  return (
    <section style={{ maxWidth: 1280, margin: '0 auto', padding: '92px 28px 40px' }}>
      <div style={{
        position: 'relative',
        background: 'rgba(255,51,51,0.07)',
        border: `1.5px solid ${yt}`,
        padding: '48px 36px 40px',
        textAlign: 'center',
      }}>
        {/* Floating label */}
        <span style={{
          position: 'absolute', top: -14, left: '50%',
          transform: 'translateX(-50%) rotate(-1deg)',
          padding: '5px 14px', background: yt, color: '#FFF',
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700,
        }}>
          {'▶'} {L === 'pt' ? 'se inscreva' : 'subscribe'}
        </span>

        {/* Heading */}
        <h2 style={{
          fontFamily: '"Fraunces", serif', fontSize: 40, margin: '0 0 12px', fontWeight: 500,
          letterSpacing: '-0.025em',
          textWrap: 'balance' as React.CSSProperties['textWrap'],
          lineHeight: 1.05,
        }}>
          {L === 'pt' ? 'Assistir é grátis. Voltar é o difícil.' : 'Watching is free. Coming back is the hard part.'}
        </h2>

        {/* Description */}
        <p style={{
          fontSize: 15, color: muted, maxWidth: 600,
          margin: '0 auto 32px',
          fontFamily: '"Source Serif 4", Georgia, serif', lineHeight: 1.55,
        }}>
          {L === 'pt'
            ? 'Inscreva-se nos dois — o feed do YouTube cuida do resto. PT é onde eu falo de carreira e setup; EN é onde eu codifico em público.'
            : 'Subscribe to both — the YouTube feed takes care of the rest. PT covers career and setup; EN is live-coding.'}
        </p>

        {/* Channel cards grid */}
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 720, margin: '0 auto' }}
          className="keep-2col"
        >
          {channels.map(c => (
            <ChannelSubscribeCard key={c.id} channel={c} locale={locale} theme={theme}/>
          ))}
        </div>
      </div>
    </section>
  )
}
