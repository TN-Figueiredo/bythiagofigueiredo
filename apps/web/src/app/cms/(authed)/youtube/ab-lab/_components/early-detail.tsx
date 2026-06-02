'use client'

import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import { DetailHeader } from './detail-header'
import { EarlyBand } from './early-band'
import { EarlyHero } from './early-hero'
import { EarlyVariantTable } from './early-variant-table'
import { EmptyChart } from './empty-chart'
import type { EarlyCheckpoint } from './early-types'
import { LayoutGrid } from 'lucide-react'

export interface EarlyDetailProps {
  view: AbTestActiveView
}

/** Default checkpoints for early state — computed from view data. */
function buildCheckpoints(view: AbTestActiveView): EarlyCheckpoint[] {
  const cyclesDone = view.cycles.done
  const confidence = view.confirmedData.confidence

  return [
    {
      label: 'Primeiro ciclo ABBA',
      reached: cyclesDone >= 1,
      eta: cyclesDone >= 1 ? null : '~6h',
      reachedAt: null,
      isSoon: cyclesDone < 1,
    },
    {
      label: 'Burn-in completo',
      reached: cyclesDone >= 4,
      eta: cyclesDone >= 4 ? null : '~48h',
      reachedAt: null,
      isSoon: cyclesDone >= 1 && cyclesDone < 4,
    },
    {
      label: 'Confianca minima (5%)',
      reached: confidence >= 5,
      eta: confidence >= 5 ? null : '~7 dias',
      reachedAt: null,
      isSoon: cyclesDone >= 4 && confidence < 5,
    },
  ]
}

export function EarlyDetail({ view }: EarlyDetailProps) {
  const checkpoints = buildCheckpoints(view)

  // Build early variant table data from the view
  const earlyVariants = view.variants.map(v => {
    const thumb = view.variantThumbs.find(t => t.label === v.label)
    return {
      label: v.label,
      color: v.color,
      thumbUrl: thumb?.thumbUrl ?? null,
      titleText: view.videoTitle,
      ctr: null as null,
      isOriginal: thumb?.isOriginal ?? v.label === 'A',
    }
  })

  return (
    <div data-testid="early-detail" className="fade-in">
      {/* Header */}
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

      {/* Early Band */}
      <div className="mb-[16px]">
        <EarlyBand
          dayOf={view.cycles.done}
          totalDays={view.durationDays}
        />
      </div>

      {/* Early Hero */}
      <div className="mb-[28px]">
        <EarlyHero
          checkpoints={checkpoints}
        />
      </div>

      {/* Variant Table (early) */}
      <section data-section="variant-performance" className="mb-[36px]">
        <div className="flex items-end justify-between gap-[14px] mb-[16px]">
          <div>
            <div className="flex items-center gap-[9px]">
              <LayoutGrid size={17} className="text-cms-accent" aria-hidden="true" />
              <h3 className="text-[19px] font-semibold text-cms-text m-0">Placar das variantes</h3>
            </div>
            <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
              CTR e chance de vencer aparecem apos o primeiro ciclo ABBA completo.
            </p>
          </div>
        </div>
        <EarlyVariantTable
          variants={earlyVariants}
          videoTitle={view.videoTitle}
        />
      </section>

      {/* 4x Empty Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] mb-[36px]">
        <EmptyChart
          icon="TrendingUp"
          title="Confianca ao longo do tempo"
          message="O grafico aparece quando o motor acumular dados suficientes dos ciclos ABBA."
          eta="~48h"
        />
        <EmptyChart
          icon="Crosshair"
          title="Raio-X das variantes"
          message="O radar comparativo precisa de pelo menos um ciclo completo por variante."
          eta="~48h"
        />
        <EmptyChart
          icon="BarChart3"
          title="Faixa provavel de CTR"
          message="O intervalo credivel Bayesiano requer dados de impressoes e cliques."
          eta="~7 dias"
        />
        <EmptyChart
          icon="LineChart"
          title="CTR diario por variante"
          message="Historico diario aparece apos o segundo dia de rotacao."
          eta="~48h"
        />
      </div>
    </div>
  )
}
