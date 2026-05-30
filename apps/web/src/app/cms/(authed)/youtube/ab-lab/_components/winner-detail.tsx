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
import { Copy, Archive, MoreVertical } from 'lucide-react'

export interface WinnerDetailProps {
  view: AbTestWinnerView
}

export function WinnerDetail({ view }: WinnerDetailProps) {
  return (
    <div className="space-y-8" data-testid="winner-detail">
      {/* 1. DetailHeader (no toggle, Duplicate/Archive actions) */}
      <DetailHeader
        title={view.videoTitle}
        flag={view.flag}
        status={view.status}
        outcome="winner"
        roundNumber={view.totalRounds}
        totalRounds={view.totalRounds}
        hasPlayoff={view.hasPlayoff}
        actions={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-cms-text-muted hover:text-cms-text transition-colors rounded-lg border border-cms-border hover:border-cms-border-hover focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
            >
              <Copy size={13} aria-hidden="true" />
              Duplicar
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-cms-text-muted hover:text-cms-text transition-colors rounded-lg border border-cms-border hover:border-cms-border-hover focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
            >
              <Archive size={13} aria-hidden="true" />
              Arquivar
            </button>
            <button
              type="button"
              aria-label="Mais ações"
              className="inline-flex items-center justify-center size-8 text-cms-text-muted hover:text-cms-text transition-colors rounded-lg border border-cms-border hover:border-cms-border-hover focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
            >
              <MoreVertical size={14} aria-hidden="true" />
            </button>
          </div>
        }
      />

      {/* 2. WinnerBanner */}
      <WinnerBanner
        winnerLabel={view.winnerLabel}
        winnerColor={view.winnerColor}
        lift={view.lift}
        confidence={view.confidence}
        stats={view.resultMeta}
      />

      {/* 3. "Por que {winner} venceu" — CredibleInterval + RankBars side by side */}
      <section data-testid="why-won">
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
      {view.monitor && <LiveMonitorCard monitor={view.monitor} />}

      {/* 5. ConfidenceChart + learning card side by side */}
      <section data-testid="confidence-section">
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

      {/* 6. Placar final — VariantTable with winnerId */}
      <section data-testid="scoreboard">
        <SectionLabel>Placar final</SectionLabel>
        <VariantTable
          variants={view.variants}
          metric="pBest"
          winnerId={view.winnerLabel}
          thumbs={view.variantThumbs}
        />
      </section>

      {/* 7. GatesPanel */}
      <section data-testid="gates-section">
        <SectionLabel>Critérios de resolução</SectionLabel>
        <GatesPanel gates={view.gates} />
      </section>

      {/* 8. Placeholder for Click Moment */}
      <div data-click-moment aria-hidden="true" />
    </div>
  )
}
