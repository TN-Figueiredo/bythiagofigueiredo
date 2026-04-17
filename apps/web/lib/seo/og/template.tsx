/* eslint-disable @next/next/no-img-element */
import * as React from 'react'

export function BlogOgTemplate({
  title,
  author,
  locale,
  brandColor,
  logoUrl,
}: {
  title: string
  author: string
  locale: string
  brandColor: string
  logoUrl: string | null
}) {
  const darker = darkenHex(brandColor, 30)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: `linear-gradient(135deg, ${brandColor}, ${darker})`,
        color: '#fff',
        fontFamily: 'Inter',
        padding: 80,
      }}
    >
      {logoUrl && (
        <img src={logoUrl} width={64} height={64} style={{ borderRadius: 12 }} alt="" />
      )}
      <h1
        style={{
          fontSize: title.length > 60 ? 56 : 64,
          lineHeight: 1.1,
          marginTop: 'auto',
          maxWidth: 1040,
          fontWeight: 700,
        }}
      >
        {truncate(title, 100)}
      </h1>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 32,
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 28, opacity: 0.9 }}>{author}</span>
        <span style={{ fontSize: 24, opacity: 0.7 }}>{locale.toUpperCase()}</span>
      </div>
    </div>
  )
}

export function CampaignOgTemplate(props: React.ComponentProps<typeof BlogOgTemplate>) {
  // Same visual as Blog for now; distinct export so future divergence stays
  // localized to its own template.
  return <BlogOgTemplate {...props} />
}

export function GenericOgTemplate({
  title,
  siteName,
  brandColor,
}: {
  title: string
  siteName: string
  brandColor: string
}) {
  const darker = darkenHex(brandColor, 30)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${brandColor}, ${darker})`,
        color: '#fff',
        fontFamily: 'Inter',
        padding: 80,
      }}
    >
      <h1 style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>{truncate(title, 80)}</h1>
      <div style={{ fontSize: 28, opacity: 0.8, marginTop: 32 }}>{siteName}</div>
    </div>
  )
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…'
}

function darkenHex(hex: string, pct: number): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return hex
  const r = Math.max(0, Math.round((parseInt(m[1]!, 16) * (100 - pct)) / 100))
  const g = Math.max(0, Math.round((parseInt(m[2]!, 16) * (100 - pct)) / 100))
  const b = Math.max(0, Math.round((parseInt(m[3]!, 16) * (100 - pct)) / 100))
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}
