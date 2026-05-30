'use client'

import type { AbTestPlayoffView } from '@/lib/youtube/ab-types'
import { formatPercent } from './ab-constants'
import { DetailHeader } from './detail-header'
import { PlayoffBanner } from './playoff-banner'
import { CredibleInterval } from './credible-interval'
import { RankBars } from './rank-bars'
import { VariantTable } from './variant-table'
import { Copy, Archive, Download, Info, Trophy, LayoutGrid, HelpCircle } from 'lucide-react'

export interface PlayoffDetailProps {
  view: AbTestPlayoffView
}

const BTN = 'inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] border border-cms-border whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim hover:text-cms-text focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none'

export function PlayoffDetail({ view }: PlayoffDetailProps) {
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
          className="rounded-lg border border-cms-amber bg-cms-amber/5 p-[20px]"
        >
          <div className="flex items-start gap-[12px]">
            <Info
              size={18}
              className="text-cms-amber shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="text-[13px] font-semibold text-cms-text m-0">
                Round {view.totalRounds > 1 ? view.totalRounds - 1 : 1} fechou sem vencedor claro
              </p>
              <p className="text-[12.5px] text-cms-text-dim mt-[4px] m-0 max-w-[600px]">
                Atingiu {view.durationDays} dias com {formatPercent(view.confidenceReached, 0)} de confiança — abaixo dos {formatPercent(view.confidenceTarget * 100, 0)}. Quatro variantes brigando diluem os dados. Em vez de descartar, o sistema afunila.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PlayoffBanner */}
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

      {/* 4. "Por que empatou" — single card with header + grid */}
      <section className="mb-[16px]">
        <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
          <div className="flex items-end justify-between gap-[14px] mb-[16px]">
            <div>
              <div className="flex items-center gap-[9px]">
                <HelpCircle size={17} className="text-cms-accent" aria-hidden="true" />
                <h3 className="text-[19px] font-semibold text-cms-text m-0">Por que empatou</h3>
              </div>
              <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
                As faixas de CTR de B e D se sobrepõem demais — não dá pra cravar. Por isso o playoff.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[1.2fr_1fr] gap-[28px] items-center">
            <div>
              <div className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[12px]">Faixa provável de CTR</div>
              <CredibleInterval variants={view.variants} />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[12px]">P(top 2) por variante</div>
              <RankBars variants={view.variants} metric="pTop2" />
              <p className="text-[11.5px] text-cms-text-dim mt-[12px] leading-[1.5]">
                Probabilidade de estar entre as 2 melhores — o critério do playoff.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Placar das variantes */}
      <section className="mb-[36px]">
        <div className="flex items-end justify-between gap-[14px] mb-[16px]">
          <div>
            <div className="flex items-center gap-[9px]">
              <LayoutGrid size={17} className="text-cms-accent" aria-hidden="true" />
              <h3 className="text-[19px] font-semibold text-cms-text m-0">Placar das variantes</h3>
            </div>
            <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
              O resultado de cada variante no teste.
            </p>
          </div>
        </div>
        <VariantTable
          variants={view.variants}
          metric="pTop2"
          thumbs={view.variantThumbs}
          videoTitle={view.videoTitle}
        />
      </section>
    </div>
  )
}
