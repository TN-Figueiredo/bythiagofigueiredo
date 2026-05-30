'use client'

import { useState } from 'react'
import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import { VARIANT_COLORS } from './ab-constants'
import { DetailHeader } from './detail-header'
import { LockCountdown } from './lock-countdown'
import { HeroBand } from './hero-band'
import { VariantTable } from './variant-table'
import { GatesPanel } from './gates-panel'
import { ConfidenceChart } from './confidence-chart'
import { RadarChart } from './radar-chart'
import { CredibleInterval } from './credible-interval'
import { RankBars } from './rank-bars'
import { MultiLine } from './multi-line'
import { ABBATimeline } from './abba-timeline'
import { FunnelRow } from './funnel-row'

export interface ActiveDetailProps {
  view: AbTestActiveView
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-cms-text mb-2">
      {children}
    </h3>
  )
}

export function ActiveDetail({ view }: ActiveDetailProps) {
  const [signal, setSignal] = useState<'confirmed' | 'live'>('confirmed')

  const data = signal === 'confirmed' ? view.confirmedData : (view.liveData ?? view.confirmedData)

  // Compute trend from last 2 confTrend values
  const trend: 'up' | 'flat' | 'down' = (() => {
    const len = view.confTrend.length
    if (len < 2) return 'flat'
    const prev = view.confTrend[len - 2]!
    const curr = view.confTrend[len - 1]!
    if (curr > prev + 1) return 'up'
    if (curr < prev - 1) return 'down'
    return 'flat'
  })()

  // Build ABBA color map from variants
  const abbaColors: Record<string, string> = {}
  for (const v of view.variants) {
    abbaColors[v.label] = v.color
  }

  // Build funnel rows from variants
  const funnelVariants = view.variants.map(v => ({
    impressions: v.impressions,
    clicks: v.clicks,
    linkClicks: v.linkClicks,
    color: v.color,
  }))

  return (
    <div className="space-y-6">
      {/* Section 1: Header with signal toggle */}
      <div data-section="header">
        <DetailHeader
          title={view.videoTitle}
          flag={view.flag}
          status={view.status}
          roundNumber={1}
          totalRounds={view.totalRounds}
          hasPlayoff={view.hasPlayoff}
          signalToggle={{
            mode: signal,
            onToggle: () => setSignal(s => (s === 'confirmed' ? 'live' : 'confirmed')),
          }}
        />
      </div>

      {/* Section 2: Lock Countdown */}
      <div data-section="lock-countdown">
        <LockCountdown
          dayOf={view.cycles.done}
          durationDays={view.durationDays}
          confidence={data.confidence}
          confidenceTarget={view.confidenceTarget * 100}
          cyclesCompleted={view.cycles.done}
        />
      </div>

      {/* Section 3: Hero Band */}
      <div data-section="hero-band">
        <HeroBand
          confidence={data.confidence}
          confidenceTarget={view.confidenceTarget * 100}
          leader={{ label: data.leader, color: data.leaderColor }}
          lift={data.lift}
          trend={trend}
        />
      </div>

      {/* Section 4: Placar das variantes */}
      <div data-section="variant-performance">
        <SectionLabel>Placar das variantes</SectionLabel>
        <VariantTable
          variants={view.variants}
          metric="pBest"
          thumbs={view.variantThumbs}
        />
      </div>

      {/* Section 5: Confiança + Raio-X */}
      <div data-section="charts-confidence-radar" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionLabel>Confiança ao longo do tempo</SectionLabel>
          <ConfidenceChart
            data={view.confTrend}
            target={view.confidenceTarget * 100}
          />
        </div>
        <div>
          <SectionLabel>Raio-X das variantes</SectionLabel>
          <RadarChart variants={view.variants} />
        </div>
      </div>

      {/* Section 6: Faixa provável + Chance de vencer */}
      <div data-section="charts-ci-rank" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionLabel>Faixa provável de CTR</SectionLabel>
          <CredibleInterval variants={view.variants} leader={data.leader} />
        </div>
        <div>
          <SectionLabel>Chance de vencer</SectionLabel>
          <RankBars variants={view.variants} metric="pBest" />
        </div>
      </div>

      {/* Section 7: CTR diário */}
      <div data-section="daily-ctr">
        <SectionLabel>CTR diário por variante</SectionLabel>
        <MultiLine series={view.daily} colors={VARIANT_COLORS} />
      </div>

      {/* Section 8: Rotação ABBA + Funil */}
      <div data-section="timeline-funnel" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <SectionLabel>Rotação ABBA</SectionLabel>
          <ABBATimeline
            seq={view.abbaSeq}
            total={view.cycles.total}
            done={view.cycles.done}
            colors={abbaColors}
          />
        </div>
        <div>
          <SectionLabel>Funil por variante</SectionLabel>
          <div className="space-y-3">
            {funnelVariants.map((fv, i) => (
              <FunnelRow key={view.variants[i]?.label ?? i} variant={fv} />
            ))}
          </div>
        </div>
      </div>

      {/* Section 9: Critérios de resolução */}
      <div data-section="gates">
        <SectionLabel>Critérios de resolução automática</SectionLabel>
        <GatesPanel gates={view.gates} />
      </div>

      {/* Section 10: ClickMoment placeholder (Phase 5) */}
      <div data-click-moment aria-hidden="true" />
    </div>
  )
}
