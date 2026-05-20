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

export function NewsletterOgTemplate({
  name,
  description,
  cadenceLabel,
  accentColor,
  author,
  domain,
}: {
  name: string
  description: string | null
  cadenceLabel: string | null
  accentColor: string
  author: string
  domain: string
}) {
  const luminance = relativeLuminance(accentColor)
  const badgeStyle = luminance > 0.5
    ? { background: `${accentColor}22`, color: accentColor }
    : { background: accentColor, color: '#fff' }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa',
        fontFamily: 'Inter',
        padding: '50px 60px',
      }}
    >
      <div style={{ width: '100%', height: 6, background: accentColor, borderRadius: 3, marginBottom: 32 }} />
      <div style={{ fontSize: 16, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 16 }}>
        NEWSLETTER
      </div>
      <h1 style={{ fontSize: name.length > 30 ? 48 : 56, fontWeight: 700, color: '#111', lineHeight: 1.1, maxWidth: 1080, marginBottom: 16 }}>
        {truncate(name, 60)}
      </h1>
      {description && (
        <p style={{ fontSize: 24, color: '#555', lineHeight: 1.4, maxWidth: 900, marginBottom: 'auto' }}>
          {truncate(description, 120)}
        </p>
      )}
      {cadenceLabel && (
        <div style={{ display: 'flex', marginBottom: 24, marginTop: description ? 0 : 'auto' }}>
          <span style={{ ...badgeStyle, padding: '6px 16px', borderRadius: 6, fontSize: 16, fontWeight: 600 }}>
            {cadenceLabel}
          </span>
        </div>
      )}
      <div style={{ borderTop: '1px solid #eee', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 18, color: '#888' }}>{author}</span>
        <span style={{ fontSize: 18, color: '#888' }}>{domain}</span>
      </div>
    </div>
  )
}

export function LinktreeOgTemplate({
  name,
  tagline,
  domain,
  brandColor,
  avatarUrl,
}: {
  name: string
  tagline: string
  domain: string
  brandColor: string
  avatarUrl: string | null
}) {
  const darker = darkenHex(brandColor, 40)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        background: `linear-gradient(135deg, ${brandColor}, ${darker})`,
        fontFamily: 'Inter',
        padding: '0 80px',
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: '3px solid rgba(255,255,255,0.3)',
          fontSize: 36,
          fontFamily: 'Georgia, serif',
          color: '#fff',
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} width={74} height={74} style={{ borderRadius: '50%', objectFit: 'cover' }} alt="" />
        ) : (
          <span>
            <span style={{ fontWeight: 500 }}>T</span>
            <span style={{ fontStyle: 'italic', opacity: 0.9 }}>F</span>
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 48, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
          {truncate(name, 40)}
        </div>
        <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.65)', marginTop: 8 }}>
          {truncate(tagline, 60)}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginTop: 12, fontFamily: 'monospace' }}>
          {domain}
        </div>
      </div>
    </div>
  )
}

function toLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const r = toLinear(parseInt(hex.slice(1, 3), 16) / 255)
  const g = toLinear(parseInt(hex.slice(3, 5), 16) / 255)
  const b = toLinear(parseInt(hex.slice(5, 7), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
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
