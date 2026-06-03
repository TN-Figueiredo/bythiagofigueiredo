'use client'

import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { brDec } from '@/lib/youtube/format'
import type { Axis } from '@/lib/youtube/scoring-types'
import { AXIS_LABELS } from '@/lib/youtube/scoring-types'

interface CoachingCard {
  axis: Axis
  score: number
  benchmark: number
  channelValue: number
  diagnosis: string
  action: string
  source: 'cowork' | 'fallback'
}

interface Props {
  healthScore: number
  radarData: Array<{ label: string; value: number; grade: string }>
  coachingCards: CoachingCard[]
  videoCount: number
  lastAnalysisAt: string | null
  onRequestAnalysis?: () => void
  analysisState: 'idle' | 'pending' | 'cooldown' | 'success'
}

const SEV_COLORS = {
  critical: 'var(--red)',
  warning: 'var(--amber)',
  healthy: 'var(--green)',
} as const

function getSeverity(score: number): 'critical' | 'warning' | 'healthy' {
  if (score < 3) return 'critical'
  if (score < 5) return 'warning'
  return 'healthy'
}

function SeverityIcon({ severity }: { severity: 'critical' | 'warning' | 'healthy' }) {
  const props = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  if (severity === 'critical')
    return <svg {...props}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
  if (severity === 'warning')
    return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
  return <svg {...props}><path d="M20 6L9 17l-5-5"/></svg>
}

export function YtHealthCoach({
  healthScore,
  radarData: _radarData,
  coachingCards,
  videoCount,
  lastAnalysisAt,
  onRequestAnalysis,
  analysisState,
}: Props) {
  const router = useRouter()
  const sortedCards = [...coachingCards].sort((a, b) => a.score - b.score)

  const potentialScore = sortedCards.length > 0
    ? Math.min(100, healthScore + sortedCards.reduce((sum, c) => sum + Math.max(0, Math.round((c.benchmark - c.score) * 1.5)), 0))
    : healthScore
  const potentialGain = potentialScore - healthScore

  if (videoCount === 0) {
    return (
      <div className="fade-in flex flex-col items-center justify-center gap-3 rounded border border-dashed border-cms-border p-12 text-center">
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Nenhuma analise de inteligencia disponivel ainda.
        </p>
        <p className="dim" style={{ fontSize: 12, maxWidth: 400 }}>
          O Health Coach usa dados de performance do canal para gerar diagnosticos personalizados.
        </p>
        {onRequestAnalysis && (
          <button type="button" onClick={onRequestAnalysis} disabled={analysisState !== 'idle'} className="btn primary mt-2">
            Solicitar Nova Analise
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="fade-in flex flex-col" style={{ gap: 16 }}>
      {/* Coach summary banner */}
      <div className="card coach-summary">
        <div className="coach-sum-ico">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>
            <path d="M5 18l.7 1.8L7.5 20l-1.8.7L5 22l-.7-1.3L2.5 20l1.8-.2z"/>
          </svg>
        </div>
        <div className="flex-1">
          <span className="section-label">Diagnostico do Cowork</span>
          <p style={{ fontSize: 14, lineHeight: 1.55, marginTop: 6 }}>
            {sortedCards.length > 0
              ? `O canal esta em ${healthScore}/100. ${sortedCards.length} eixo${sortedCards.length > 1 ? 's' : ''} puxa${sortedCards.length > 1 ? 'm' : ''} pra baixo. Resolver levaria o score pra ~${potentialScore}.`
              : 'Canal saudavel em todos os eixos — continue monitorando.'}
          </p>
        </div>
        {potentialGain > 0 && (
          <div className="coach-proj">
            <span className="metric-label">Potencial</span>
            <span className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{potentialScore}</span>
            <span className="kpi-delta up">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 7l-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>
              +{potentialGain} pts
            </span>
          </div>
        )}
      </div>

      {/* Coaching Cards */}
      {sortedCards.map((card) => {
        const severity = getSeverity(card.score)
        const color = SEV_COLORS[severity]
        const impactPts = Math.max(0, Math.round((card.benchmark - card.score) * 1.5))
        const actionLabel = card.action.length > 35 ? card.action.slice(0, 32) + '...' : card.action

        return (
          <div key={card.axis} className="card coach-item">
            <div className="coach-item-ico" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
              <SeverityIcon severity={severity} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center" style={{ gap: 9, marginBottom: 5 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{AXIS_LABELS[card.axis]}</span>
                <span
                  className="rounded-full px-2 py-0.5"
                  style={{ fontSize: 11, fontWeight: 600, color, background: `color-mix(in srgb, ${color} 14%, transparent)`, borderColor: 'transparent', whiteSpace: 'nowrap' }}
                >
                  {severity === 'critical' ? 'Alta' : severity === 'warning' ? 'Media' : 'Baixa'}
                </span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                {card.diagnosis}
              </p>
            </div>
            <div className="coach-action">
              <button
                type="button"
                className="btn sm"
                title={card.action}
                onClick={() => {
                  if (card.axis === 'ctr') {
                    router.push('/cms/youtube/ab-lab/new')
                  } else {
                    toast.success(`Ação anotada: "${card.action}"`)
                  }
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                {card.axis === 'ctr' ? 'Criar A/B Test' : actionLabel}
              </button>
              {impactPts > 0 && <span className="mono coach-impact">+{impactPts} pts</span>}
            </div>
          </div>
        )
      })}

      {sortedCards.length === 0 && (
        <div className="card" style={{ padding: 16, textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>Canal saudavel em todos os eixos</p>
          <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>
            Todos os indicadores estao acima do benchmark. Continue monitorando.
          </p>
        </div>
      )}

      {/* Request Analysis Button */}
      {onRequestAnalysis && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onRequestAnalysis}
            disabled={analysisState !== 'idle'}
            className="btn sm"
          >
            {analysisState === 'pending' ? 'Em fila...'
              : analysisState === 'cooldown' ? 'Disponivel em breve'
              : analysisState === 'success' ? 'Analise solicitada!'
              : 'Solicitar Nova Analise'}
          </button>
        </div>
      )}
    </div>
  )
}
