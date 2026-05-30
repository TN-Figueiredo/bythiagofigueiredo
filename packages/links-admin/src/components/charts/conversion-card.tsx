import { CARD_STYLE } from './tokens'

interface ConversionCardProps {
  name: string
  rate: number
  progress: number
  label: string
  views: number
  conversions: number
}

export function ConversionCard({ name, rate, progress, label, views, conversions }: ConversionCardProps) {
  return (
    <div data-conversion style={{ padding: 16, ...CARD_STYLE }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #ECE6DA)' }}>{name}</span>
        <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono, monospace)', color: 'var(--accent, #FF8240)' }}>{label}</span>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: 'var(--surface-2, #272219)', overflow: 'hidden', marginBottom: 12 }}>
        <div data-progress-fill role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} style={{ width: `${Math.min(progress * 100, 100)}%`, height: '100%', borderRadius: 99, background: 'var(--accent, #FF8240)', transition: 'width .5s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-faint, #6E685D)' }}>
        <span>{views} views</span>
        <span>{conversions} conversoes</span>
      </div>
    </div>
  )
}
