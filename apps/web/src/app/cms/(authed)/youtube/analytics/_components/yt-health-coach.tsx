/**
 * YtHealthCoach — refactored per spec 4.3.4.
 *
 * Removed: ring/radar duplicate from top.
 * Added: coach-summary banner (gradient accent, sparkles icon, projection "+N pts").
 * Added: severity icons per score (<3 red, <5 amber, >=5 green).
 * Added: coach-action with impact badge + action button.
 */
'use client'

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

function getSeverity(score: number): 'critical' | 'warning' | 'healthy' {
  if (score < 3) return 'critical'
  if (score < 5) return 'warning'
  return 'healthy'
}

const SEVERITY_STYLES = {
  critical: { border: '#ef4444', bg: 'rgba(239,68,68,0.06)', icon: '#ef4444' },
  warning: { border: '#f59e0b', bg: 'rgba(245,158,11,0.06)', icon: '#f59e0b' },
  healthy: { border: '#22c55e', bg: 'rgba(34,197,94,0.06)', icon: '#22c55e' },
} as const

function SeverityIcon({ severity }: { severity: 'critical' | 'warning' | 'healthy' }) {
  const color = SEVERITY_STYLES[severity].icon
  const props = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }

  if (severity === 'critical') {
    return <svg {...props}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
  }
  if (severity === 'warning') {
    return <svg {...props}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
  }
  // healthy
  return <svg {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}

function StalenessIndicator({ lastAt }: { lastAt: string }) {
  const days = Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000)
  const color = days < 7 ? 'bg-[#22c55e]' : days < 14 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-cms-text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      Ultima analise: {days === 0 ? 'hoje' : `${days}d atras`}
    </div>
  )
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
  const sortedCards = [...coachingCards].sort((a, b) => a.score - b.score)

  // Projection: estimate potential score gain from fixing worst areas
  const potentialGain = sortedCards.reduce((sum, c) => {
    const gap = c.benchmark - c.score
    return sum + (gap > 0 ? Math.round(gap * 1.5) : 0)
  }, 0)

  if (videoCount === 0) {
    return (
      <div className="fade-in flex flex-col items-center justify-center gap-3 rounded border border-dashed border-cms-border p-12 text-center">
        <div className="h-24 w-24 rounded-full border-4 border-cms-border" />
        <p className="text-sm text-cms-text-muted">
          Nenhuma analise de inteligencia disponivel ainda.
        </p>
        <p className="max-w-md text-xs text-cms-text-dim">
          O Health Coach usa dados de performance do canal para gerar diagnosticos personalizados.
        </p>
        {onRequestAnalysis && (
          <button
            type="button"
            onClick={onRequestAnalysis}
            disabled={analysisState !== 'idle'}
            className="btn primary mt-2"
          >
            Solicitar Nova Analise
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="fade-in flex flex-col gap-4">
      {/* Coach summary banner */}
      <div
        className="coach-summary flex items-center justify-between rounded-lg p-4"
        style={{
          background: 'linear-gradient(135deg, var(--accent-soft) 0%, var(--surface) 100%)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Sparkles icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-cms-text">
              Health Coach &middot; Score {healthScore}/100
            </p>
            <p className="mt-0.5 text-xs text-cms-text-muted">
              {sortedCards.length > 0
                ? `${sortedCards.length} area${sortedCards.length > 1 ? 's' : ''} para melhorar`
                : 'Canal saudavel em todos os eixos'}
            </p>
          </div>
        </div>
        {potentialGain > 0 && (
          <div className="coach-proj rounded-lg bg-cms-surface px-3 py-1.5">
            <span className="tnum text-sm font-bold text-[#22c55e]">
              +{potentialGain} pts
            </span>
            <p className="text-[9px] text-cms-text-muted">potencial</p>
          </div>
        )}
      </div>

      {lastAnalysisAt && (
        <StalenessIndicator lastAt={lastAnalysisAt} />
      )}

      {/* Coaching Cards */}
      <div className="flex flex-col gap-3">
        {sortedCards.length === 0 && (
          <div className="rounded border border-[#22c55e]/20 bg-[#22c55e]/5 p-4 text-center">
            <p className="text-sm font-medium text-[#22c55e]">Canal saudavel em todos os eixos</p>
            <p className="mt-1 text-xs text-cms-text-muted">
              Todos os indicadores estao acima do benchmark. Continue monitorando.
            </p>
          </div>
        )}
        {sortedCards.map((card, i) => {
          const severity = getSeverity(card.score)
          const styles = SEVERITY_STYLES[severity]

          return (
            <div
              key={card.axis}
              className="coach-item rounded-lg border bg-cms-surface p-4"
              style={{
                borderColor: styles.border,
                borderLeftWidth: 3,
                background: styles.bg,
              }}
            >
              <div className="flex items-start gap-3">
                <SeverityIcon severity={severity} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cms-text">
                      #{i + 1} {AXIS_LABELS[card.axis]}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="tnum text-xs text-cms-text-muted">
                        {brDec(card.score, 1)}/10
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] ${card.source === 'cowork' ? 'bg-cms-purple-soft text-cms-purple' : 'bg-cms-border text-cms-text-muted'}`}>
                        {card.source === 'cowork' ? 'Analise AI' : 'Diagnostico basico'}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-cms-text-muted">{card.diagnosis}</p>

                  {/* Coach action */}
                  <div className="coach-action mt-3 flex items-center justify-between rounded-lg bg-cms-surface p-2">
                    <div className="flex items-center gap-2">
                      <span className="coach-impact rounded bg-[#22c55e]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#22c55e]">
                        impacto {card.score < 3 ? 'alto' : card.score < 5 ? 'medio' : 'baixo'}
                      </span>
                      <span className="text-xs text-cms-text">{card.action}</span>
                    </div>
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={() => toast.success(`Acao "${AXIS_LABELS[card.axis]}" enviada ao pipeline.`)}
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Request Analysis Button */}
      {onRequestAnalysis && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onRequestAnalysis}
            disabled={analysisState !== 'idle'}
            className="btn sm"
          >
            {analysisState === 'pending'
              ? 'Em fila...'
              : analysisState === 'cooldown'
                ? 'Disponivel em breve'
                : analysisState === 'success'
                  ? 'Analise solicitada!'
                  : 'Solicitar Nova Analise'}
          </button>
        </div>
      )}
    </div>
  )
}
