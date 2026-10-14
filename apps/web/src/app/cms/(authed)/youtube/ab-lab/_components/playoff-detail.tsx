'use client'

import type { AbTestPlayoffView } from '@/lib/youtube/ab-types'
import { SEM_MEDICAO_DE_ENTREGA } from './ab-constants'
import { DetailHeader } from './detail-header'
import { PlayoffBanner } from './playoff-banner'
import { VariantTable } from './variant-table'
import { Copy, Archive, Download, Info, LayoutGrid } from 'lucide-react'

export interface PlayoffDetailProps {
  view: AbTestPlayoffView
}

const BTN = 'inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] border border-cms-border whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim hover:text-cms-text focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none'

export function PlayoffDetail({ view }: PlayoffDetailProps) {
  // Só há playoff de verdade quando existe um teste de playoff (a criação automática foi retirada).
  const temPlayoff = view.playoffTestId !== ''
  return (
    <div data-testid="playoff-detail">
      {/* 1. DetailHeader */}
      <div className="mb-[22px]">
        <DetailHeader
          title={view.videoTitle}
          flag={view.flag}
          status={view.status}
          outcome="playoff"
          roundNumber={Math.max(1, view.totalRounds - 1)}
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

      {/* 2. Inconclusive Banner */}
      <div className="mb-[16px]">
        <div
          data-testid="inconclusive-banner"
          className="flex gap-[13px] py-[16px] px-[20px] bg-cms-amber-subtle rounded-[14px]"
          style={{ border: '1px solid rgba(224, 162, 60, 0.3)' }}
        >
          <Info
            size={20}
            className="text-cms-amber shrink-0"
            aria-hidden="true"
          />
          <div>
            <div className="text-[14px] font-semibold text-cms-text">
              {temPlayoff
                ? `Round ${view.totalRounds > 1 ? view.totalRounds - 1 : 1} fechou sem vencedor claro`
                : 'Encerrado sem vencedor'}
            </div>
            <div className="text-[12.5px] text-cms-text mt-[3px] leading-[1.5] max-w-[680px]">
              {temPlayoff
                ? SEM_MEDICAO_DE_ENTREGA
                : 'Você não escolheu uma variante e não há CTR medido para decidir. Para testar de novo, use Duplicar.'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. PlayoffBanner: só com playoff real */}
      {temPlayoff && (
        <div className="mb-[28px]">
          <PlayoffBanner
            finalists={view.finalists}
            allVariants={view.variants.map((v) => ({
              label: v.label,
              isFinalist: view.finalists.some((f) => f.label === v.label),
              thumbnailUrl:
                view.variantThumbs.find((t) => t.label === v.label)?.thumbUrl ?? null,
            }))}
            startsIn={view.startsIn}
            reason={view.reason}
          />
        </div>
      )}

      {/* 5. Placar das variantes */}
      <section className="mb-[36px]">
        <VariantTable
          variants={view.variants}
          finalists={view.finalists.map(f => f.label)}
          thumbs={view.variantThumbs}
          videoTitle={view.videoTitle}
          semChance
        />
      </section>
    </div>
  )
}
