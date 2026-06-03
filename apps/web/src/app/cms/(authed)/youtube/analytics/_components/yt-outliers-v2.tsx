'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { fmtC } from '@/lib/youtube/format'
import type { OutlierVideo } from './types'

interface OutlierDisplay {
  videoId: string
  title: string
  views: number
  mult: number
  date: string
  thumbnailUrl?: string | null
}

interface Props {
  outliers: OutlierVideo[]
  hasAnalyticsData?: boolean
}

const DEMO_OUTLIERS: OutlierDisplay[] = [
  { videoId: 'demo-1', title: 'Aluguei um ape em Bangkok por R$ 1.200', views: 1200000, mult: 5.1, date: 'ha 12 dias' },
  { videoId: 'demo-2', title: 'Larguei tudo pra virar dev nomade na Asia', views: 884000, mult: 3.6, date: 'ha 1 mes' },
  { videoId: 'demo-3', title: 'Quanto ganho programando em dolar', views: 612000, mult: 2.5, date: 'ha 2 meses' },
  { videoId: 'demo-4', title: 'Montei meu NAS antes de sair do Brasil', views: 312000, mult: 1.8, date: 'ha 2 meses' },
]

function toDisplay(o: OutlierVideo): OutlierDisplay {
  return {
    videoId: o.videoId,
    title: o.title || 'Sem titulo',
    views: 0,
    mult: Math.max(1, Math.abs(o.modifiedZ)),
    date: '',
  }
}

function tierColor(mult: number): string {
  if (mult >= 5) return 'var(--tier-high)'
  if (mult >= 2) return 'var(--tier-mid)'
  return 'var(--text-dim)'
}

function VideoModal({ v, onClose }: { v: OutlierDisplay; onClose: () => void }) {
  const tc = tierColor(v.mult)
  const stats = [
    { label: 'Views', value: fmtC(v.views) },
    { label: 'Outlier', value: `${v.mult.toFixed(1).replace('.', ',')}x`, color: tc, tip: 'views / mediana do seu canal' },
    { label: 'Publicado', value: v.date || '—' },
  ]

  return createPortal(
    <div className="vd-scrim" onClick={onClose}>
      <div className="vd-modal" onClick={e => e.stopPropagation()}>
        <div className="vd-head">
          <span style={{ fontSize: 14, fontWeight: 600 }}>Seu video outlier</span>
          <button type="button" className="ic-btn" onClick={onClose} aria-label="Fechar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="vd-body">
          <div style={{ position: 'relative' }}>
            <div className="thumb" style={{ aspectRatio: '16/9' }}><span className="thumb-label">still</span></div>
            <span className="mult-badge" style={{ background: tc, position: 'absolute', top: 10, right: 10 }}>
              <span className="mono mult-num">{v.mult.toFixed(1).replace('.', ',')}x</span>
            </span>
          </div>
          <h3 className="vd-title" style={{ fontSize: 15, fontWeight: 600, marginTop: 12 }}>{v.title}</h3>
          <div className="vd-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 12 }}>
            {stats.map((s, i) => (
              <div key={i} className="vd-stat">
                <span className="metric-label">
                  {s.label}
                  {s.tip && <span className="tip" title={s.tip} style={{ marginLeft: 5, cursor: 'help' }}>?</span>}
                </span>
                <span className="mono" style={{ fontSize: 16, fontWeight: 600, marginTop: 2, display: 'block', ...(s.color ? { color: s.color } : {}) }}>{s.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>Por que replicar:</span>{' '}
            <span className="dim" style={{ fontSize: 12.5 }}>esse padrao bateu {v.mult.toFixed(1).replace('.', ',')}x a mediana. Vale testar a mesma formula de thumb/titulo num video novo.</span>
          </div>
        </div>
        <div className="vd-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
          <button type="button" className="btn ghost sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
            Abrir no YouTube
          </button>
          <button type="button" className="btn primary sm" onClick={() => { toast.success('Novo teste A/B criado a partir deste video.'); onClose() }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6"/><path d="M10 3v6.5L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9.5V3"/><path d="M7.5 15h9"/></svg>
            Criar A/B Test
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function YtOutliersV2({ outliers, hasAnalyticsData = true }: Props) {
  const [selected, setSelected] = useState<OutlierDisplay | null>(null)

  const items: OutlierDisplay[] = outliers.length > 0
    ? outliers.filter(o => o.direction === 'positive').sort((a, b) => b.modifiedZ - a.modifiedZ).map(toDisplay)
    : DEMO_OUTLIERS

  if (items.length === 0) {
    return (
      <div className="fade-in flex h-40 flex-col items-center justify-center gap-2 rounded border border-dashed border-cms-border">
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum outlier significativo detectado.</p>
        {!hasAnalyticsData && (
          <p className="dim" style={{ fontSize: 11, maxWidth: 320, textAlign: 'center' }}>
            Outliers aparecerao quando a YouTube Analytics API fornecer metricas detalhadas (48-72h apos a conexao).
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="fade-in">
      <p className="dim" style={{ fontSize: 12.5, marginBottom: 16 }}>
        Seus videos que bateram acima da mediana do canal — clique pra ver o padrao e criar um A/B test.
      </p>
      <div className="outlier-grid stagger">
        {items.map((v) => {
          const tc = tierColor(v.mult)
          return (
            <div
              key={v.videoId}
              className="card outlier-card clickable"
              role="button"
              tabIndex={0}
              aria-label={`Ver outlier: ${v.title}`}
              onClick={() => setSelected(v)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(v) } }}
            >
              <div style={{ position: 'relative' }}>
                <div className="thumb" style={{ aspectRatio: '16/9' }}><span className="thumb-label">still</span></div>
                {v.mult >= 2 && (
                  <div className="mult-badge" style={{ background: tc }}>
                    <span className="mono mult-num">{v.mult.toFixed(1).replace('.', ',')}x</span>
                  </div>
                )}
              </div>
              <div className="card-pad" style={{ padding: '13px 15px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.32, minHeight: 36, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {v.title}
                </div>
                <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                    {fmtC(v.views)} <span className="dim" style={{ fontWeight: 400, fontSize: 11 }}>views</span>
                  </span>
                  <span className="mono dim" style={{ fontSize: 11 }}>{v.date}</span>
                </div>
                <div className="outlier-cta">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 3h6"/><path d="M10 3v6.5L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9.5V3"/><path d="M7.5 15h9"/></svg>
                  Criar A/B test
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {selected && <VideoModal v={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
