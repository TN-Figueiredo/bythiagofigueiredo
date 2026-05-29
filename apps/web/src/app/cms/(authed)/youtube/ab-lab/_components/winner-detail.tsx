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
import { Copy, Download } from 'lucide-react'

export interface WinnerDetailProps {
  view: AbTestWinnerView
}

export function WinnerDetail({ view }: WinnerDetailProps) {
  return (
    <div className="space-y-6" data-testid="winner-detail">
      {/* 1. DetailHeader (no toggle, Duplicate/Download actions) */}
      <DetailHeader
        title={view.videoTitle}
        flag={view.flag}
        status={view.status}
        roundNumber={view.totalRounds}
        totalRounds={view.totalRounds}
        hasPlayoff={view.hasPlayoff}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-1 text-2xs text-cms-text-muted hover:text-cms-text transition-colors rounded border border-cms-border focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
            >
              <Copy size={12} aria-hidden="true" />
              Duplicate
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2 py-1 text-2xs text-cms-text-muted hover:text-cms-text transition-colors rounded border border-cms-border focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none"
            >
              <Download size={12} aria-hidden="true" />
              Download
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

      {/* 3. "Why {winner} won" — CredibleInterval + RankBars side by side */}
      <section data-testid="why-won">
        <SectionLabel>Why {view.winnerLabel} won</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-4">
            <p className="text-2xs text-cms-text-dim mb-2 uppercase tracking-wider font-medium">
              Credible Intervals
            </p>
            <CredibleInterval
              variants={view.variants}
              leader={view.winnerLabel}
            />
          </div>
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-4">
            <p className="text-2xs text-cms-text-dim mb-2 uppercase tracking-wider font-medium">
              Win Probability
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
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-4">
            <SectionLabel>Confidence Trend</SectionLabel>
            <ConfidenceChart
              data={view.confTrend}
              target={view.confidenceTarget * 100}
            />
          </div>
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-4">
            <SectionLabel>Learning</SectionLabel>
            {view.learning ? (
              <p className="text-xs text-cms-text-muted italic" data-testid="learning-text">
                {view.learning}
              </p>
            ) : (
              <p className="text-xs text-cms-text-dim">No learning recorded.</p>
            )}
          </div>
        </div>
      </section>

      {/* 6. Final Scoreboard — VariantTable with winnerId */}
      <section data-testid="scoreboard">
        <SectionLabel>Final Scoreboard</SectionLabel>
        <VariantTable
          variants={view.variants}
          metric="pBest"
          winnerId={view.winnerLabel}
          thumbs={view.variantThumbs}
        />
      </section>

      {/* 7. GatesPanel */}
      <section data-testid="gates-section">
        <SectionLabel>Decision Gates</SectionLabel>
        <GatesPanel gates={view.gates} />
      </section>

      {/* 8. Placeholder for Click Moment */}
      <div data-click-moment aria-hidden="true" />
    </div>
  )
}
