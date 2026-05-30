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
import { Copy, Archive, Download, Trophy } from 'lucide-react'

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

      {/* 3. "Por que {winner} venceu" — single card with header + grid */}
      <section data-testid="why-won" className="mb-[16px]">
        <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
          {/* Header row */}
          <div className="flex items-end justify-between gap-[14px] mb-[16px]">
            <div>
              <div className="flex items-center gap-[9px]">
                <Trophy size={17} className="text-cms-accent" aria-hidden="true" />
                <h3 className="text-[19px] font-semibold text-cms-text m-0">Por que {view.winnerLabel} venceu</h3>
              </div>
              <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
                Não foi sorte: a faixa de CTR do vencedor ficou inteira acima da original, e o motor Bayesiano deu 93% de chance dele ser o melhor.
              </p>
            </div>
          </div>

          {/* Charts grid: 1.2fr 1fr */}
          <div className="grid grid-cols-[1.2fr_1fr] gap-[28px] items-center">
            {/* Left: Credible Intervals */}
            <div>
              <div className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[12px]">Faixa provável de CTR</div>
              <CredibleInterval
                variants={view.variants}
                leader={view.winnerLabel}
              />
            </div>

            {/* Right: Rank Bars */}
            <div>
              <div className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[12px]">Chance de ser o melhor</div>
              <RankBars variants={view.variants} metric="pBest" />
              <p className="text-[11.5px] text-cms-text-dim mt-[12px] leading-[1.5]">
                As faixas <b className="text-cms-text">não se sobrepõem</b> — por isso o sistema cravou o vencedor, diferente do empate que vira playoff.
              </p>
            </div>
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
