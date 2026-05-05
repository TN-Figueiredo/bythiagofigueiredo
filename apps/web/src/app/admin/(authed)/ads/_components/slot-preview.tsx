'use client'

interface PreviewData {
  headline: string
  body: string
  ctaText: string
  ctaUrl: string
  brandColor: string
  logoUrl: string | null
  imageUrl: string | null
}

interface SlotPreviewProps {
  slotKey: string
  data: PreviewData
}

const theme = {
  bg: '#1E1A12',
  paper: '#262117',
  paper2: '#2B261C',
  ink: '#EFE6D2',
  muted: '#958A75',
  faint: '#6B634F',
  line: '#2E2718',
  accent: '#FF8240',
  tape: '#E8C44A',
}

function DoormanPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ background: data.brandColor, color: '#FFF', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <span style={{ fontSize: 8, letterSpacing: '0.16em', fontWeight: 700, padding: '2px 6px', background: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', fontFamily: 'monospace' }}>AD</span>
      <span style={{ flex: 1, fontWeight: 600 }}>{data.headline || 'Headline'}</span>
      <span style={{ fontSize: 9, letterSpacing: '0.1em', fontWeight: 600, padding: '6px 10px', border: '1px solid rgba(255,255,255,0.5)', textTransform: 'uppercase', fontFamily: 'monospace' }}>{data.ctaText || 'CTA'}</span>
    </div>
  )
}

function AnchorPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ padding: '12px', border: `1px solid ${theme.line}`, background: theme.paper2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 8, letterSpacing: '0.18em', fontWeight: 700, color: '#FFFCEE', background: data.brandColor, padding: '2px 6px', fontFamily: 'monospace', textTransform: 'uppercase' }}>AD</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        {data.logoUrl && (
          <div style={{ width: 28, height: 28, borderRadius: 3, background: data.brandColor, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={data.logoUrl} alt="" width={20} height={20} style={{ objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: theme.muted }}>
          <div style={{ fontWeight: 600, color: theme.ink, fontSize: 9, marginBottom: 1 }}>{(data.headline || 'Brand').split(' ').slice(0, 3).join(' ')}</div>
        </div>
      </div>
      <div style={{ fontFamily: 'serif', fontSize: 13, fontWeight: 500, color: theme.ink, lineHeight: 1.22, marginBottom: 4 }}>{data.headline || 'Headline'}</div>
      <div style={{ fontFamily: 'serif', fontSize: 11, color: theme.muted, lineHeight: 1.5, marginBottom: 8 }}>{data.body || 'Body text'}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.06em', color: data.brandColor, fontWeight: 600, paddingTop: 8, borderTop: `1px dashed ${theme.line}` }}>{data.ctaText || 'CTA'}</div>
    </div>
  )
}

function BookmarkLightPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ position: 'relative', background: '#FFFCEE', color: '#1A140C', padding: '16px 18px', boxShadow: '0 4px 12px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(0,0,0,0.04)', transform: 'rotate(-0.2deg)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%) rotate(2deg)', width: 52, height: 13, background: 'rgba(255,180,120,0.72)' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 8, letterSpacing: '0.18em', fontWeight: 700, color: '#FFFCEE', background: data.brandColor, padding: '2px 6px', fontFamily: 'monospace', textTransform: 'uppercase' }}>AD</span>
      </div>
      {data.logoUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 3, background: data.brandColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={data.logoUrl} alt="" width={22} height={22} style={{ objectFit: 'contain' }} />
          </div>
        </div>
      )}
      <div style={{ fontFamily: 'serif', fontSize: 14, fontWeight: 500, color: '#1A140C', lineHeight: 1.22, marginBottom: 6 }}>{data.headline || 'Headline'}</div>
      <div style={{ fontFamily: 'serif', fontSize: 11, color: '#3A2E22', lineHeight: 1.5, marginBottom: 10 }}>{data.body || 'Body text'}</div>
      <span style={{ display: 'inline-block', padding: '6px 12px', background: '#1A140C', color: '#FFFCEE', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'monospace' }}>{data.ctaText || 'CTA'}</span>
    </div>
  )
}

function BookmarkDarkPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ position: 'relative', background: theme.paper, padding: '16px 16px 18px', boxShadow: '0 4px 12px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.03)', transform: 'rotate(0.5deg)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%) rotate(2deg)', width: 48, height: 11, background: theme.tape, opacity: 0.75 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: data.brandColor, display: 'inline-block' }} />
        <span style={{ fontFamily: 'monospace', fontSize: 7, letterSpacing: '0.18em', color: theme.muted, textTransform: 'uppercase', fontWeight: 600 }}>PATROCINADO</span>
      </div>
      <div style={{ fontFamily: 'serif', fontSize: 13, fontWeight: 500, color: theme.ink, lineHeight: 1.25, marginBottom: 6 }}>{data.headline || 'Headline'}</div>
      <div style={{ fontFamily: 'serif', fontSize: 10, color: theme.muted, lineHeight: 1.5, marginBottom: 10 }}>{data.body || 'Body text'}</div>
      <span style={{ display: 'inline-block', padding: '5px 10px', border: `1px solid ${data.brandColor}`, color: data.brandColor, fontSize: 8, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'monospace' }}>{data.ctaText || 'CTA'}</span>
    </div>
  )
}

function CodaPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ padding: '20px 20px 18px', border: `1px solid ${theme.line}`, borderTop: `3px solid ${data.brandColor}`, background: 'rgba(0,0,0,0.012)' }}>
      <div style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 8, letterSpacing: '0.18em', fontWeight: 700, color: '#FFFCEE', background: data.brandColor, padding: '2px 7px', fontFamily: 'monospace', textTransform: 'uppercase' }}>AD</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'start' }}>
        {data.logoUrl && (
          <div style={{ padding: 10, background: 'rgba(0,0,0,0.025)', border: `1px solid ${theme.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={data.logoUrl} alt="" width={28} height={28} style={{ objectFit: 'contain' }} />
          </div>
        )}
        <div>
          <div style={{ fontFamily: 'serif', fontSize: 18, fontWeight: 500, color: theme.ink, lineHeight: 1.15, marginBottom: 8 }}>{data.headline || 'Headline'}</div>
          <div style={{ fontFamily: 'serif', fontSize: 12, color: theme.ink, lineHeight: 1.55, opacity: 0.9, marginBottom: 14 }}>{data.body || 'Body text'}</div>
          <span style={{ display: 'inline-block', padding: '8px 14px', background: data.brandColor, color: '#FFF', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'monospace' }}>{data.ctaText || 'CTA'}</span>
        </div>
      </div>
    </div>
  )
}

function HorizontalAnchorPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ background: theme.bg, borderTop: `1px dashed ${theme.line}`, borderBottom: `1px dashed ${theme.line}`, padding: '14px 16px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 16, borderRight: `1px dashed ${theme.line}` }}>
        {data.logoUrl && (
          <div style={{ width: 28, height: 28, borderRadius: 3, background: data.brandColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src={data.logoUrl} alt="" width={18} height={18} style={{ objectFit: 'contain' }} />
          </div>
        )}
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 7, letterSpacing: '0.18em', color: theme.muted, textTransform: 'uppercase', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: data.brandColor, display: 'inline-block' }} />
            AD
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 600, color: theme.ink }}>{(data.headline || 'Brand').split(' ').slice(0, 3).join(' ')}</div>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'serif', fontSize: 14, fontWeight: 500, color: theme.ink, lineHeight: 1.25, marginBottom: 3 }}>{data.headline || 'Headline'}</div>
        <div style={{ fontFamily: 'serif', fontSize: 10, color: theme.muted, lineHeight: 1.5 }}>{data.body || 'Body text'}</div>
      </div>
      <span style={{ padding: '6px 10px', border: `1px solid ${data.brandColor}`, color: data.brandColor, fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{data.ctaText || 'CTA'}</span>
    </div>
  )
}

function MarginaliaPreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ maxWidth: 500, padding: '14px 18px', background: theme.paper2, borderTop: `1px dashed ${theme.line}`, borderBottom: `1px dashed ${theme.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: data.brandColor, display: 'inline-block' }} />
        <span style={{ fontFamily: 'monospace', fontSize: 7, letterSpacing: '0.16em', color: theme.muted, textTransform: 'uppercase', fontWeight: 700 }}>PATROCINADO</span>
      </div>
      <div style={{ fontFamily: 'serif', fontSize: 12, fontWeight: 500, color: theme.ink, lineHeight: 1.25, marginBottom: 4 }}>{data.headline || 'Headline'}</div>
      <div style={{ fontFamily: 'serif', fontSize: 10, color: theme.muted, lineHeight: 1.5, marginBottom: 8 }}>{data.body || 'Body text'}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.06em', color: data.brandColor, fontWeight: 600 }}>{data.ctaText || 'CTA'} →</div>
    </div>
  )
}

function BowtiePreview({ data }: { data: PreviewData }) {
  return (
    <div style={{ padding: '20px 20px 18px', background: theme.paper, borderTop: `1px dashed ${theme.line}`, borderBottom: `1px dashed ${theme.line}` }}>
      <div style={{ fontFamily: 'cursive', fontSize: 20, fontWeight: 600, color: theme.ink, lineHeight: 1.15, marginBottom: 6 }}>{data.headline || 'Receba o próximo ensaio antes de virar público'}</div>
      <div style={{ fontFamily: 'serif', fontSize: 11, color: theme.muted, lineHeight: 1.5, marginBottom: 14, maxWidth: 400 }}>{data.body || 'Uma vez por semana, direto no email.'}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, padding: '8px 10px', fontSize: 11, border: `1px solid ${theme.faint}`, background: theme.bg, color: theme.muted, fontFamily: 'sans-serif' }}>voce@email.com</div>
        <span style={{ padding: '8px 14px', background: data.brandColor || theme.accent, color: theme.bg, fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>{data.ctaText || 'ASSINAR'}</span>
      </div>
    </div>
  )
}

const PREVIEW_MAP: Record<string, { component: React.FC<{ data: PreviewData }>; label: string; device: string }> = {
  'post:top:banner':           { component: DoormanPreview,          label: 'DoormanAd',        device: 'desktop full-width' },
  'post:rail:anchor-left':     { component: AnchorPreview,           label: 'MarginaliaAd',     device: 'sidebar 160px' },
  'post:rail:anchor':          { component: AnchorPreview,           label: 'AnchorAd',         device: 'sidebar 300px' },
  'post:body:bookmark':        { component: BookmarkLightPreview,    label: 'BookmarkAd',       device: 'inline 540px' },
  'post:footer:coda':          { component: CodaPreview,             label: 'CodaAd',           device: 'full-width' },
  'archive:top:doorman':       { component: DoormanPreview,          label: 'DoormanAd',        device: 'desktop full-width' },
  'archive:break:anchor':      { component: HorizontalAnchorPreview, label: 'HorizontalAnchor', device: '3-col grid break' },
  'archive:grid:bookmark':     { component: BookmarkDarkPreview,     label: 'BookmarkAd (dark)',device: 'grid card' },
  'archive:footer:marginalia': { component: MarginaliaPreview,       label: 'MarginaliaAd',     device: 'max-w 720' },
  'archive:footer:bowtie':     { component: BowtiePreview,           label: 'BowtieAd',         device: 'full-width' },
}

export function SlotPreview({ slotKey, data }: SlotPreviewProps) {
  const config = PREVIEW_MAP[slotKey]
  if (!config) return <div style={{ color: '#666', fontSize: 12 }}>No preview available</div>

  const { component: Component, label, device } = config

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Preview — {label}
        </span>
        <span className="text-[10px] text-muted-foreground/60">
          {device}
        </span>
      </div>
      <div
        className="overflow-hidden rounded-md border border-border"
        style={{ background: theme.bg, padding: 16 }}
      >
        <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '117.6%' }}>
          <Component data={data} />
        </div>
      </div>
    </div>
  )
}
