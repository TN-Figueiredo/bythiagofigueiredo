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
import {
  Pause, Settings,
  LayoutGrid, TrendingUp, Crosshair, Target, BarChart3, LineChart, RefreshCw, Filter, Shield,
} from 'lucide-react'

export interface ActiveDetailProps {
  view: AbTestActiveView
}

const BTN = 'inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] border border-cms-border whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim hover:text-cms-text focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none'

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
    <div data-testid="active-detail">
      {/* Section 1: Header */}
      <div data-section="header" className="mb-[16px]">
        <DetailHeader
          title={view.videoTitle}
          flag={view.flag}
          status={view.status}
          roundNumber={1}
          totalRounds={view.totalRounds}
          hasPlayoff={view.hasPlayoff}
          dayInfo={{ dayOf: view.cycles.done, total: view.durationDays }}
        />
      </div>

      {/* Toolbar: signal toggle + Pausar + Settings — below title */}
      <div className="flex items-center gap-[8px] mb-[22px]">
        <div className="inline-flex bg-cms-surface-hover rounded-[9px] p-[3px] gap-[2px]">
          {(['confirmed', 'live'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setSignal(m)}
              className="border-none cursor-pointer transition-[0.15s]"
              style={{
                padding: '6px 13px',
                borderRadius: 7,
                fontSize: '12.5px',
                fontWeight: 600,
                background: m === signal ? 'var(--cms-accent)' : 'transparent',
                color: m === signal ? 'rgb(20, 15, 8)' : 'var(--cms-text-dim)',
              }}
            >
              {m === 'confirmed' ? 'Confirmado' : 'Live'}
            </button>
          ))}
        </div>
        <span className="size-[15px] rounded-full border border-cms-border text-cms-text-muted text-[9.5px] font-bold inline-flex items-center justify-center cursor-help font-mono">?</span>
        <button type="button" className={BTN}>
          <Pause size={14} aria-hidden="true" />
          Pausar
        </button>
        <button type="button" aria-label="Configurações" className={BTN}>
          <Settings size={14} aria-hidden="true" />
        </button>
      </div>

      {/* Section 2: Lock Countdown */}
      <div data-section="lock-countdown" className="mb-[16px]">
        <LockCountdown
          dayOf={view.cycles.done}
          durationDays={view.durationDays}
          confidence={data.confidence}
          confidenceTarget={view.confidenceTarget * 100}
          cyclesCompleted={view.cycles.done}
        />
      </div>

      {/* Section 3: Hero Band */}
      <div data-section="hero-band" className="mb-[28px]">
        <HeroBand
          confidence={data.confidence}
          confidenceTarget={view.confidenceTarget * 100}
          leader={{ label: data.leader, color: data.leaderColor }}
          lift={data.lift}
          trend={trend}
        />
      </div>

      {/* Section 4: Placar das variantes */}
      <section data-section="variant-performance" className="mb-[28px]">
        <div className="flex items-end justify-between gap-[14px] mb-[16px]">
          <div>
            <div className="flex items-center gap-[9px]">
              <LayoutGrid size={17} className="text-cms-accent" aria-hidden="true" />
              <h3 className="text-[19px] font-semibold text-cms-text m-0">Placar das variantes</h3>
            </div>
            <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
              Desempenho de cada variante até agora.
            </p>
          </div>
        </div>
        <VariantTable
          variants={view.variants}
          metric="pBest"
          thumbs={view.variantThumbs}
        />
      </section>

      {/* Section 5: Confiança ao longo do tempo + Raio-X das variantes */}
      <section data-section="charts-confidence-radar" className="mb-[16px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
          {/* Left: Confiança ao longo do tempo */}
          <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
            <div className="flex items-end justify-between gap-[14px] mb-[16px]">
              <div className="flex items-center gap-[9px]">
                <TrendingUp size={17} className="text-cms-accent" aria-hidden="true" />
                <h3 className="text-[19px] font-semibold text-cms-text m-0">Confiança ao longo do tempo</h3>
              </div>
            </div>
            <ConfidenceChart
              data={view.confTrend}
              target={view.confidenceTarget * 100}
            />
          </div>

          {/* Right: Raio-X das variantes */}
          <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
            <div className="flex items-end justify-between gap-[14px] mb-[16px]">
              <div className="flex items-center gap-[9px]">
                <Crosshair size={17} className="text-cms-accent" aria-hidden="true" />
                <h3 className="text-[19px] font-semibold text-cms-text m-0">Raio-X das variantes</h3>
              </div>
            </div>
            <RadarChart variants={view.variants} />
          </div>
        </div>
      </section>

      {/* Section 6: Faixa provável de CTR + Chance de vencer */}
      <section data-section="charts-ci-rank" className="mb-[28px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
          {/* Left: Faixa provável de CTR */}
          <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
            <div className="flex items-end justify-between gap-[14px] mb-[16px]">
              <div className="flex items-center gap-[9px]">
                <Target size={17} className="text-cms-accent" aria-hidden="true" />
                <h3 className="text-[19px] font-semibold text-cms-text m-0">Faixa provável de CTR</h3>
              </div>
            </div>
            <CredibleInterval variants={view.variants} leader={data.leader} />
          </div>

          {/* Right: Chance de vencer */}
          <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
            <div className="flex items-end justify-between gap-[14px] mb-[16px]">
              <div className="flex items-center gap-[9px]">
                <BarChart3 size={17} className="text-cms-accent" aria-hidden="true" />
                <h3 className="text-[19px] font-semibold text-cms-text m-0">Chance de vencer</h3>
              </div>
            </div>
            <RankBars variants={view.variants} metric="pBest" />
          </div>
        </div>
      </section>

      {/* Section 7: CTR diário por variante */}
      <section data-section="daily-ctr" className="mb-[28px]">
        <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
          <div className="flex items-end justify-between gap-[14px] mb-[16px]">
            <div className="flex items-center gap-[9px]">
              <LineChart size={17} className="text-cms-accent" aria-hidden="true" />
              <h3 className="text-[19px] font-semibold text-cms-text m-0">CTR diário por variante</h3>
            </div>
          </div>
          <MultiLine series={view.daily} colors={VARIANT_COLORS} />
        </div>
      </section>

      {/* Section 8: Rotação ABBA + Funil por variante */}
      <section data-section="timeline-funnel" className="mb-[28px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
          {/* Left: Rotação ABBA */}
          <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
            <div className="flex items-end justify-between gap-[14px] mb-[16px]">
              <div className="flex items-center gap-[9px]">
                <RefreshCw size={17} className="text-cms-accent" aria-hidden="true" />
                <h3 className="text-[19px] font-semibold text-cms-text m-0">Rotação ABBA</h3>
              </div>
            </div>
            <ABBATimeline
              seq={view.abbaSeq}
              total={view.cycles.total}
              done={view.cycles.done}
              colors={abbaColors}
            />
          </div>

          {/* Right: Funil por variante */}
          <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
            <div className="flex items-end justify-between gap-[14px] mb-[16px]">
              <div className="flex items-center gap-[9px]">
                <Filter size={17} className="text-cms-accent" aria-hidden="true" />
                <h3 className="text-[19px] font-semibold text-cms-text m-0">Funil por variante</h3>
              </div>
            </div>
            <div className="space-y-3">
              {funnelVariants.map((fv, i) => (
                <FunnelRow key={view.variants[i]?.label ?? i} variant={fv} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 9: Critérios de resolução automática */}
      <section data-section="gates" className="mb-[28px]">
        <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
          <div className="flex items-end justify-between gap-[14px] mb-[16px]">
            <div className="flex items-center gap-[9px]">
              <Shield size={17} className="text-cms-accent" aria-hidden="true" />
              <h3 className="text-[19px] font-semibold text-cms-text m-0">Critérios de resolução automática</h3>
            </div>
          </div>
          <GatesPanel gates={view.gates} />
        </div>
      </section>

      {/* Section 10: ClickMoment placeholder (Phase 5) */}
      <div data-click-moment aria-hidden="true" />
    </div>
  )
}
