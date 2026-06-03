'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, ExternalLink, FlaskConical, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { brDec, fmtC } from '@/lib/youtube/format'
import { YtPortal } from '../../_components/yt-portal'
import { useModalFocusTrap } from '../../../_shared/editor/use-modal-focus-trap'
import type { OutlierVideo } from './types'

/* ── Types ── */

interface OutlierDisplay {
  id: string
  title: string
  thumbnailUrl?: string | null
  videoId?: string
  views: number
  mult: number
  date: string
  tier: 'mid' | 'high' | 'top'
  likes?: number
  comments?: number
  duration?: number
}

interface Props {
  outliers: OutlierVideo[]
  hasAnalyticsData?: boolean
}

/* ── Demo data ── */

const DEMO_OUTLIERS: OutlierDisplay[] = [
  { id: 'demo-1', title: 'Aluguei um ape em Bangkok por R$ 1.200', views: 1200000, mult: 5.1, date: 'ha 12 dias', tier: 'high', likes: 48000, comments: 3200, duration: 782 },
  { id: 'demo-2', title: 'Larguei tudo pra virar dev nomade na Asia', views: 884000, mult: 3.6, date: 'ha 1 mes', tier: 'mid', likes: 31000, comments: 2100, duration: 624 },
  { id: 'demo-3', title: 'Quanto ganho programando em dolar', views: 612000, mult: 2.5, date: 'ha 2 meses', tier: 'mid', likes: 22000, comments: 1800, duration: 540 },
  { id: 'demo-4', title: 'Montei meu NAS antes de sair do Brasil', views: 312000, mult: 1.8, date: 'ha 2 meses', tier: 'mid', likes: 9400, comments: 640, duration: 420 },
]

/* ── Helpers ── */

const TIER_META: Record<string, { color: string }> = {
  mid:  { color: 'var(--tier-mid)' },
  high: { color: 'var(--tier-high)' },
  top:  { color: 'var(--tier-top)' },
}

function toDisplay(o: OutlierVideo): OutlierDisplay {
  const mult = Math.max(1, Math.abs(o.modifiedZ))
  const tier: 'mid' | 'high' | 'top' = mult >= 10 ? 'top' : mult >= 5 ? 'high' : 'mid'
  return { id: `${o.videoId}-${o.axis}`, videoId: o.videoId, title: o.title || 'Sem titulo', views: 0, mult, date: '', tier }
}

function fmtDur(s: number | null | undefined): string {
  if (s == null || s <= 0) return '--:--'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}m ${sec.toString().padStart(2, '0')}s`
}

/* ── Stat Card ── */

function StatCard({ label, value, tooltip, valueColor }: { label: string; value: string; tooltip?: string; valueColor?: string }) {
  return (
    <div className="vd-stat">
      <span className="metric-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {label}
        {tooltip && (
          <span className="tip" title={tooltip} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 13, height: 13, borderRadius: '50%', fontSize: 8.5, fontWeight: 700, background: 'var(--surface-3)', color: 'var(--text-dim)', cursor: 'help' }}>?</span>
        )}
      </span>
      <span className="mono vd-stat-val" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
    </div>
  )
}

/* ── Trend Chart ── */

function TrendChart({ viewCount }: { viewCount: number }) {
  const w = 460, h = 70, padY = 4
  const data: number[] = []
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    data.push(viewCount * (1 / (1 + Math.exp(-10 * (t - 0.35)))))
  }
  const max = Math.max(...data) || 1
  const pts: Array<[number, number]> = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    padY + (1 - v / max) * (h - padY * 2),
  ])
  let d = `M ${pts[0]![0]},${pts[0]![1]}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!; const cur = pts[i]!
    const cpx = (prev[0] + cur[0]) / 2
    d += ` C ${cpx},${prev[1]} ${cpx},${cur[1]} ${cur[0]},${cur[1]}`
  }
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="section-label">Tendencia de views</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block' }}>
        <defs><linearGradient id="vd-trend-perf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} /></linearGradient></defs>
        <path d={`${d} L ${w},${h} L 0,${h} Z`} fill="url(#vd-trend-perf)" />
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinecap="round" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>publicacao</span>
        <span className="mono" style={{ fontSize: 9.5, color: 'var(--text-dim)' }}>hoje</span>
      </div>
    </div>
  )
}

/* ── Video Modal ── */

function VideoModal({ v, onClose }: { v: OutlierDisplay; onClose: () => void }) {
  const router = useRouter()
  const modalRef = useRef<HTMLDivElement>(null)
  const handleClose = useCallback(() => onClose(), [onClose])
  useModalFocusTrap(modalRef, true, handleClose)

  const meta = TIER_META[v.tier] ?? TIER_META.mid!
  const engagement = v.views > 0 && v.likes != null ? (((v.likes ?? 0) + (v.comments ?? 0)) / v.views * 100) : null
  const ctr = Math.min(15, 3.4 + v.mult * 0.7)

  return (
    <YtPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} onClick={handleClose}>
        <div ref={modalRef} role="dialog" aria-modal="true" aria-label={v.title} className="vd-modal" onClick={e => e.stopPropagation()}>
          <div className="vd-head">
            <span style={{ fontSize: 14, fontWeight: 600 }}>Seu video outlier</span>
            <button className="ic-btn" onClick={handleClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
          </div>

          <div className="vd-body">
            <div style={{ position: 'relative' }}>
              {v.thumbnailUrl ? (
                <img src={v.thumbnailUrl} alt={v.title} referrerPolicy="no-referrer" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: '9px 9px 0 0', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '16/9', background: 'linear-gradient(135deg, var(--surface-3), var(--surface-2))', borderRadius: '9px 9px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 12 }}>Sem thumbnail</div>
              )}
              {v.duration != null && v.duration > 0 && (
                <span className="cd-dur" style={{ position: 'absolute', bottom: 10, right: 10 }}>{fmtDur(v.duration)}</span>
              )}
            </div>

            <h3 className="vd-title">{v.title}</h3>

            <div className="vd-stats">
              <StatCard label="views" value={fmtC(v.views)} />
              <StatCard label="outlier" value={`${brDec(v.mult, 1)}x`} tooltip="views / mediana do seu canal" valueColor={meta.color} />
              <StatCard label="ctr estimado" value={`${brDec(ctr, 1)}%`} tooltip="Heuristica baseada no desempenho relativo" />
              <StatCard label="ranking" value="—" tooltip="Posicao por views entre seus videos" />
              <StatCard label="engajamento" value={engagement != null ? `${brDec(engagement, 2)}%` : '—'} />
              <StatCard label="curtidas" value={v.likes ? fmtC(v.likes) : '—'} />
              <StatCard label="comentarios" value={v.comments ? fmtC(v.comments) : '—'} />
              <StatCard label="duracao" value={fmtDur(v.duration)} />
            </div>

            <TrendChart viewCount={v.views} />
          </div>

          <div className="vd-foot">
            <button type="button" className="btn ghost sm" disabled={!v.videoId} onClick={() => {
              if (v.videoId) {
                window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank', 'noopener')
              } else {
                toast.info('YouTube video ID não disponível nesta visualização.')
              }
            }}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Abrir no YouTube
            </button>
            <button type="button" className="btn primary sm" onClick={() => { router.push(`/cms/youtube/ab-lab/new?videoId=${v.videoId ?? v.id}`); handleClose() }}>
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Criar A/B Test
            </button>
          </div>
        </div>
      </div>
    </YtPortal>
  )
}

/* ── Main Component ── */

export function YtOutliersV2({ outliers, hasAnalyticsData = true }: Props) {
  const [selected, setSelected] = useState<OutlierDisplay | null>(null)

  const items: OutlierDisplay[] = useMemo(() => {
    return outliers.filter(o => o.direction === 'positive').sort((a, b) => b.modifiedZ - a.modifiedZ).map(toDisplay)
  }, [outliers])

  if (items.length === 0) {
    return (
      <div className="fade-in text-center py-12" style={{ color: 'var(--text-dim)' }}>
        <p style={{ fontSize: 13 }}>Nenhum outlier significativo detectado.</p>
        {!hasAnalyticsData && (
          <p className="dim" style={{ fontSize: 11, marginTop: 4 }}>
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
        {items.map(v => {
          const meta = TIER_META[v.tier] ?? TIER_META.mid!
          return (
            <div
              key={v.id}
              className="outlier-card clickable"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              aria-label={`Ver outlier: ${v.title}`}
              onClick={() => setSelected(v)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(v) } }}
            >
              <div className="relative">
                {v.thumbnailUrl ? (
                  <img src={v.thumbnailUrl} alt={v.title} referrerPolicy="no-referrer" className="w-full" style={{ aspectRatio: '16/9', objectFit: 'cover' }} loading="lazy" />
                ) : (
                  <div className="w-full flex items-center justify-center" style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg, var(--surface-3), var(--surface-2))', color: 'var(--text-dim)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}><polygon points="6 3 20 12 6 21 6 3"/></svg>
                  </div>
                )}
                {v.mult >= 2 && (
                  <span className="absolute top-2 right-2 rounded-lg px-2 py-1 text-xs font-bold mono" style={{ background: meta.color, color: '#16110b' }}>
                    {brDec(v.mult, 1)}x
                  </span>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs font-medium line-clamp-2" style={{ color: 'var(--text)', minHeight: 32 }}>{v.title}</p>
                <div className="flex items-center justify-between mt-1.5 text-[10px] tnum" style={{ color: 'var(--text-dim)' }}>
                  <span>{fmtC(v.views)} views</span>
                  {v.date && <span>{v.date}</span>}
                </div>
                <div className="outlier-cta">
                  <FlaskConical style={{ width: 12, height: 12 }} aria-hidden="true" />
                  <span>Criar A/B test</span>
                  <ArrowRight style={{ width: 12, height: 12 }} aria-hidden="true" />
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
