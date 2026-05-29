'use client'

import type { AbTestPlayoffView } from '@/lib/youtube/ab-types'
import { formatPercent } from './ab-constants'
import { DetailHeader } from './detail-header'
import { PlayoffBanner } from './playoff-banner'
import { CredibleInterval } from './credible-interval'
import { RankBars } from './rank-bars'
import { VariantTable } from './variant-table'
import { Badge, SectionLabel } from './ab-primitives'
import { Info } from 'lucide-react'

export interface PlayoffDetailProps {
  view: AbTestPlayoffView
}

export function PlayoffDetail({ view }: PlayoffDetailProps) {
  return (
    <div className="space-y-6" data-testid="playoff-detail">
      {/* 1. DetailHeader (amber Inconclusive badge, no toggle) */}
      <DetailHeader
        title={view.videoTitle}
        flag={view.flag}
        status={view.status}
        roundNumber={view.totalRounds}
        totalRounds={view.totalRounds}
        hasPlayoff={view.hasPlayoff}
        actions={<Badge tone="amber">Inconclusive</Badge>}
      />

      {/* 2. Inconclusive Banner */}
      <div
        data-testid="inconclusive-banner"
        className="rounded-[var(--cms-radius)] border border-cms-amber bg-cms-amber/5 p-4 flex items-start gap-3"
      >
        <Info
          size={18}
          className="text-cms-amber shrink-0 mt-0.5"
          data-testid="icon-Info"
          aria-hidden="true"
        />
        <div>
          <p className="text-xs font-medium text-cms-text">
            Test ended inconclusive
          </p>
          <p className="text-2xs text-cms-text-muted mt-0.5">
            Confidence reached {formatPercent(view.confidenceReached, 1)} vs{' '}
            {formatPercent(view.confidenceTarget * 100, 0)} target
          </p>
        </div>
      </div>

      {/* 3. PlayoffBanner */}
      <PlayoffBanner
        finalists={view.finalists}
        allVariants={view.variants.map((v) => ({
          label: v.label,
          isFinalist: view.finalists.some((f) => f.label === v.label),
          thumbnailUrl:
            view.variantThumbs.find((t) => t.label === v.label)?.thumbUrl ??
            null,
        }))}
        startsIn={view.startsIn}
        reason={view.reason}
      />

      {/* 4. "Why inconclusive" — CredibleInterval + RankBars with pTop2 */}
      <section data-testid="why-inconclusive">
        <SectionLabel>Why inconclusive</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-4">
            <p className="text-2xs text-cms-text-dim mb-2 uppercase tracking-wider font-medium">
              Overlapping Intervals
            </p>
            <CredibleInterval variants={view.variants} />
          </div>
          <div className="rounded-[var(--cms-radius)] border border-cms-border bg-cms-bg p-4">
            <p className="text-2xs text-cms-text-dim mb-2 uppercase tracking-wider font-medium">
              Top 2 Probability
            </p>
            <RankBars variants={view.variants} metric="pTop2" />
          </div>
        </div>
      </section>

      {/* 5. VariantTable with metric="pTop2" */}
      <section data-testid="variant-section">
        <SectionLabel>Variant Comparison</SectionLabel>
        <VariantTable
          variants={view.variants}
          metric="pTop2"
          thumbs={view.variantThumbs}
        />
      </section>
    </div>
  )
}
