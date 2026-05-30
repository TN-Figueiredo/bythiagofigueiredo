'use client'

import type { AbTestWinnerView } from '@/lib/youtube/ab-types'
import { DetailHeader } from './detail-header'
import { WinnerBanner } from './winner-banner'
import { LiveMonitorCard } from './live-monitor'
import { CredibleInterval } from './credible-interval'
import { RankBars } from './rank-bars'
import { ConfidenceChart } from './confidence-chart'
import { VariantTable } from './variant-table'
import { GatesPanel } from './gates-panel'
import { SectionLabel } from './ab-primitives'
import { Copy, Archive, Download } from 'lucide-react'

export interface WinnerDetailProps {
  view: AbTestWinnerView
}

const BTN = 'inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] border border-cms-border whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim hover:text-cms-text focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none'

export function WinnerDetail({ view }: WinnerDetailProps) {
  return (
    <div data-testid="winner-detail">
      {/* 1. DetailHeader */}
      <div className="mb-[22px]">
        <DetailHeader
          title={view.videoTitle}
          flag={view.flag}
          status={view.status}
          outcome="winner"
          roundNumber={view.totalRounds}
          totalRounds={view.totalRounds}
          hasPlayoff={view.hasPlayoff}
          actions={
            <div className="flex gap-[9px] shrink-0">
              <button type="button" className={BTN}>
                <Copy size={14} aria-hidden="true" />
                Duplicar
              </button>
              <button type="button" className={BTN}>
                <Archive size={14} aria-hidden="true" />
                Arquivar
              </button>
              <button type="button" aria-label="Download" className={BTN}>
                <Download size={14} aria-hidden="true" />
              </button>
            </div>
          }
        />
      </div>

      {/* 2. WinnerBanner — 28px margin-bottom per design */}
      <div className="mb-[28px]">
        <WinnerBanner
          winnerLabel={view.winnerLabel}
          winnerColor={view.winnerColor}
          lift={view.lift}
          confidence={view.confidence}
          stats={view.resultMeta}
        />
      </div>

      {/* 3. "Por que {winner} venceu" */}
      <section data-testid="why-won" className="mb-[28px]">
        <SectionLabel>Por que {view.winnerLabel} venceu</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-cms-border bg-cms-bg p-4">
            <p className="text-2xs text-cms-text-dim mb-2 font-medium">
              Faixa provável de CTR
            </p>
            <CredibleInterval
              variants={view.variants}
              leader={view.winnerLabel}
            />
          </div>
          <div className="rounded-lg border border-cms-border bg-cms-bg p-4">
            <p className="text-2xs text-cms-text-dim mb-2 font-medium">
              Chance de vencer
            </p>
            <RankBars variants={view.variants} metric="pBest" />
          </div>
        </div>
      </section>

      {/* 4. LiveMonitorCard (conditional) */}
      {view.monitor && <div className="mb-[28px]"><LiveMonitorCard monitor={view.monitor} /></div>}

      {/* 5. ConfidenceChart + learning card */}
      <section data-testid="confidence-section" className="mb-[28px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-cms-border bg-cms-bg p-4">
            <SectionLabel>Confiança ao longo do tempo</SectionLabel>
            <ConfidenceChart
              data={view.confTrend}
              target={view.confidenceTarget * 100}
            />
          </div>
          <div className="rounded-lg border border-cms-border bg-cms-bg p-4">
            <SectionLabel>O aprendizado</SectionLabel>
            {view.learning ? (
              <p className="text-xs text-cms-text-muted italic" data-testid="learning-text">
                {view.learning}
              </p>
            ) : (
              <p className="text-xs text-cms-text-dim">Nenhum aprendizado registrado.</p>
            )}
          </div>
        </div>
      </section>

      {/* 6. Placar final */}
      <section data-testid="scoreboard" className="mb-[28px]">
        <SectionLabel>Placar final</SectionLabel>
        <VariantTable
          variants={view.variants}
          metric="pBest"
          winnerId={view.winnerLabel}
          thumbs={view.variantThumbs}
        />
      </section>

      {/* 7. GatesPanel */}
      <section data-testid="gates-section" className="mb-[28px]">
        <SectionLabel>Critérios de resolução</SectionLabel>
        <GatesPanel gates={view.gates} />
      </section>

      {/* 8. Placeholder for Click Moment */}
      <div data-click-moment aria-hidden="true" />
    </div>
  )
}
