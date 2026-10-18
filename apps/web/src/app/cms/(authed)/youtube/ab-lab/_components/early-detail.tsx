'use client'

import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import { DetailHeader } from './detail-header'
import { EarlyBand } from './early-band'
import { EarlyHero } from './early-hero'
import { EarlyVariantTable } from './early-variant-table'
import type { EarlyCheckpoint } from './early-types'
import { LayoutGrid } from 'lucide-react'
import type { OpcaoEncerrar, ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { AcoesDeSaida, useAvisoDePagina } from './acoes-de-saida'

export interface EarlyDetailProps {
  view: AbTestActiveView
  /** `endAbTest` e `pauseAbTest` com o id do teste, montadas na página (mesmas do ActiveDetail). */
  encerrar: (o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida>
  pausar: (seqVisto: number) => Promise<ResultadoAcaoSaida>
}

/** Default checkpoints for early state — computed from view data. */
function buildCheckpoints(view: AbTestActiveView): EarlyCheckpoint[] {
  const cyclesDone = view.cycles.done

  return [
    {
      label: 'Primeira troca de thumbnail',
      reached: cyclesDone >= 1,
      eta: cyclesDone >= 1 ? null : '~6h',
      reachedAt: null,
      isSoon: cyclesDone < 1,
    },
    {
      label: 'Fim do período inicial',
      reached: cyclesDone >= 4,
      eta: cyclesDone >= 4 ? null : '~48h',
      reachedAt: null,
      isSoon: cyclesDone >= 1 && cyclesDone < 4,
    },
  ]
}

export function EarlyDetail({ view, encerrar, pausar }: EarlyDetailProps) {
  const { setAviso, avisoNode } = useAvisoDePagina()
  const checkpoints = buildCheckpoints(view)

  // Build early variant table data from the view
  const earlyVariants = view.variants.map(v => {
    const thumb = view.variantThumbs.find(t => t.label === v.label)
    return {
      label: v.label,
      color: v.color,
      thumbUrl: thumb?.thumbUrl ?? null,
      titleText: thumb?.titleText ?? view.videoTitle,
      ctr: null as null,
      isOriginal: thumb?.isOriginal ?? v.label === 'A',
    }
  })

  return (
    <div data-testid="early-detail" className="fade-in">
      {avisoNode}
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
          actions={<AcoesDeSaida view={view} encerrar={encerrar} pausar={pausar} onAviso={setAviso} />}
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
          </div>
        </div>
        <EarlyVariantTable
          variants={earlyVariants}
          videoTitle={view.videoTitle}
        />
      </section>
    </div>
  )
}
