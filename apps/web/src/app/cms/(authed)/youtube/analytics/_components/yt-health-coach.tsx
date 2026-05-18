'use client'

import { YtHealthRing } from './yt-health-ring'
import { YtRadarChart } from './yt-radar-chart'
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
  analysisState: 'idle' | 'pending' | 'running' | 'cooldown'
}

export function YtHealthCoach({
  healthScore,
  radarData,
  coachingCards,
  videoCount,
  lastAnalysisAt,
  onRequestAnalysis,
  analysisState,
}: Props) {
  const sortedCards = [...coachingCards].sort((a, b) => a.score - b.score)

  if (videoCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded border border-dashed border-cms-border p-12 text-center">
        <div className="h-24 w-24 rounded-full border-4 border-cms-border" />
        <p className="text-sm text-cms-text-muted">
          Nenhuma análise de inteligência disponível ainda.
        </p>
        <p className="max-w-md text-xs text-cms-text-dim">
          O Health Coach usa dados de performance do canal para gerar diagnósticos personalizados.
        </p>
        {onRequestAnalysis && (
          <button
            onClick={onRequestAnalysis}
            disabled={analysisState !== 'idle'}
            className="mt-2 rounded bg-cms-accent px-4 py-2 text-sm font-medium text-white hover:bg-[#FF9A60] disabled:opacity-50"
          >
            Solicitar Nova Análise
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Row: Ring + Radar */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col items-center gap-2">
          <YtHealthRing score={healthScore} />
          <p className="text-xs text-cms-text-muted">Score geral do canal</p>
          {lastAnalysisAt && (
            <StalenessIndicator lastAt={lastAnalysisAt} />
          )}
        </div>
        <div>
          {videoCount >= 3 ? (
            <YtRadarChart axes={radarData} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-cms-text-muted">
              Mínimo 3 vídeos para radar
            </div>
          )}
          {videoCount >= 3 && videoCount < 10 && (
            <p className="mt-1 text-center text-[10px] text-cms-text-dim">
              Score se estabiliza com 10+ vídeos
            </p>
          )}
        </div>
      </div>

      {/* Coaching Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-cms-text">Áreas de Melhoria</h3>
        {sortedCards.map((card, i) => (
          <div key={card.axis} className="rounded border border-cms-border bg-cms-surface p-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-medium text-cms-text">
                  #{i + 1} {AXIS_LABELS[card.axis]}
                </span>
                <span className="ml-2 text-xs text-cms-text-muted">
                  — {card.score.toFixed(1)}/10
                </span>
              </div>
              <span className={`rounded px-1.5 py-0.5 text-[9px] ${card.source === 'cowork' ? 'bg-[#8b5cf6]/10 text-[#8b5cf6]' : 'bg-cms-border text-cms-text-muted'}`}>
                {card.source === 'cowork' ? 'Análise AI' : 'Diagnóstico básico'}
              </span>
            </div>
            <p className="mt-2 text-xs text-cms-text-muted">{card.diagnosis}</p>
            <p className="mt-1 text-xs text-cms-text">{card.action}</p>
          </div>
        ))}
      </div>

      {/* Request Analysis Button */}
      {onRequestAnalysis && (
        <div className="flex justify-center">
          <button
            onClick={onRequestAnalysis}
            disabled={analysisState !== 'idle'}
            className="rounded border border-cms-border px-4 py-2 text-xs text-cms-text-muted hover:bg-cms-surface disabled:opacity-50"
          >
            {analysisState === 'pending' ? 'Em fila...' :
             analysisState === 'running' ? 'Analisando...' :
             analysisState === 'cooldown' ? 'Disponível em breve' :
             'Solicitar Nova Análise'}
          </button>
        </div>
      )}
    </div>
  )
}

function StalenessIndicator({ lastAt }: { lastAt: string }) {
  const days = Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000)
  const color = days < 7 ? 'bg-[#22c55e]' : days < 14 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-cms-text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      Última análise: {days === 0 ? 'hoje' : `${days}d atrás`}
    </div>
  )
}
