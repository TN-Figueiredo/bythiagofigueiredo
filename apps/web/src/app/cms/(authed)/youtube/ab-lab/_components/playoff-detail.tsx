'use client'

import type { AbTestPlayoffView } from '@/lib/youtube/ab-types'
import { formatPercent } from './ab-constants'
import { DetailHeader } from './detail-header'
import { PlayoffBanner } from './playoff-banner'
import { CredibleInterval } from './credible-interval'
import { RankBars } from './rank-bars'
import { VariantTable } from './variant-table'
import { Copy, Archive, Download, Info, LayoutGrid, Target } from 'lucide-react'

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
              Round {view.totalRounds > 1 ? view.totalRounds - 1 : 1} fechou sem vencedor claro
            </div>
            <div className="text-[12.5px] text-cms-text-dim mt-[3px] leading-[1.5] max-w-[680px]">
              Atingiu {view.durationDays} dias com {formatPercent(view.confidenceReached, 0)} de confiança — abaixo dos {formatPercent(view.confidenceTarget * 100, 0)}. Quatro variantes brigando diluem os dados. Em vez de descartar, o sistema afunila.
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

      {/* 4. "Por que empatou" + "P(top 2)" — two separate cards side by side */}
      <section className="mb-[30px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
          {/* Left: Por que empatou */}
          <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
            <div className="flex items-end justify-between gap-[14px] mb-[16px]">
              <div>
                <div className="flex items-center gap-[9px]">
                  <Target size={17} className="text-cms-accent" aria-hidden="true" />
                  <h3 className="text-[19px] font-semibold text-cms-text m-0">Por que empatou</h3>
                </div>
                <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
                  As faixas de CTR de B e D se sobrepõem demais — não dá pra cravar. Por isso o playoff.
                </p>
              </div>
            </div>
            <CredibleInterval variants={view.variants} />
          </div>

          {/* Right: P(top 2) por variante */}
          <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
            <div className="flex items-end justify-between gap-[14px] mb-[16px]">
              <div>
                <div className="flex items-center gap-[9px]">
                  <LayoutGrid size={17} className="text-cms-accent" aria-hidden="true" />
                  <h3 className="text-[19px] font-semibold text-cms-text m-0">
                    P(top 2) por variante
                    <span className="relative inline-flex align-middle ml-[5px]">
                      <span className="size-[15px] rounded-full border border-cms-border text-cms-text-muted text-[9.5px] font-bold inline-flex items-center justify-center cursor-help font-mono">?</span>
                    </span>
                  </h3>
                </div>
                <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
                  Probabilidade de estar entre as 2 melhores — o critério do playoff.
                </p>
              </div>
            </div>
            <div className="mt-[6px]">
              <RankBars variants={view.variants} metric="pTop2" />
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
          finalists={view.finalists.map(f => f.label)}
          thumbs={view.variantThumbs}
          videoTitle={view.videoTitle}
        />
      </section>
    </div>
  )
}
