'use client'

import { useRouter } from 'next/navigation'
import type { AbTestWinnerView } from '@/lib/youtube/ab-types'
import { DetailHeader } from './detail-header'
import { WinnerBanner } from './winner-banner'
import { LiveMonitorCard } from './live-monitor'
import { CredibleInterval } from './credible-interval'
import { RankBars } from './rank-bars'
import { ConfidenceChart } from './confidence-chart'
import { ClickMoment } from './click-moment'
import { VariantTable } from './variant-table'
import { GatesPanel } from './gates-panel'
import { SectionLabel } from './ab-primitives'
import { revertWinner, archiveAbTest } from '../actions'
import { Copy, Archive, Download, Trophy, TrendingUp, Sparkles, LayoutGrid, Undo2 } from 'lucide-react'

export interface WinnerDetailProps {
  view: AbTestWinnerView
}

const BTN = 'inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] border border-cms-border whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim hover:text-cms-text focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none'

export function WinnerDetail({ view }: WinnerDetailProps) {
  const router = useRouter()
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
              <button type="button" onClick={async () => {
                if (!confirm('Arquivar este teste? Os dados serão preservados mas o teste sairá da lista principal.')) return
                const result = await archiveAbTest(view.id)
                if (!result.ok) alert(result.error)
                else router.push('/cms/youtube/ab-lab')
              }} className={BTN}>
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

      {/* Revert Banner — visible during 7-day revert window */}
      {view.winnerAppliedAt && view.revertExpiresAt && new Date(view.revertExpiresAt) > new Date() && (
        <div className="mx-0 mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-300">
                Vencedor aplicado — você pode reverter em até{' '}
                {Math.max(0, Math.ceil((new Date(view.revertExpiresAt).getTime() - Date.now()) / 86400000))} dias
              </p>
              <p className="text-xs text-blue-400/70 mt-0.5">
                Restaura o thumbnail/título/descrição original no YouTube.
              </p>
            </div>
            <button
              onClick={async () => {
                if (!confirm('Reverter para o original? Isso desfaz a aplicação do vencedor no YouTube.')) return
                const result = await revertWinner(view.id)
                if (!result.ok) alert(result.error)
                else router.refresh()
              }}
              className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
            >
              <Undo2 size={12} aria-hidden="true" />
              Reverter
            </button>
          </div>
        </div>
      )}

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

      {/* 5. Confiança final + O aprendizado — grid 1fr 1fr */}
      <section data-testid="confidence-section" className="mb-[30px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
          {/* Confiança final */}
          <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
            <div className="flex items-end justify-between gap-[14px] mb-[16px]">
              <div className="flex items-center gap-[9px]">
                <TrendingUp size={17} className="text-cms-accent" aria-hidden="true" />
                <h3 className="text-[19px] font-semibold text-cms-text m-0">Confiança final</h3>
              </div>
            </div>
            <ConfidenceChart
              data={view.confTrend}
              target={view.confidenceTarget * 100}
            />
          </div>

          {/* O aprendizado */}
          <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
            <div className="flex items-end justify-between gap-[14px] mb-[16px]">
              <div className="flex items-center gap-[9px]">
                <Sparkles size={17} className="text-cms-accent" aria-hidden="true" />
                <h3 className="text-[19px] font-semibold text-cms-text m-0">O aprendizado</h3>
              </div>
            </div>
            {view.learning ? (
              <>
                <div className="text-[14px] text-cms-text leading-[1.55] py-[14px] px-[16px] bg-cms-accent-subtle rounded-[10px]" data-testid="learning-text">
                  {view.learning}
                </div>
                <p className="text-[12px] text-cms-text-muted mt-[12px] leading-[1.5]">
                  Esse padrão foi adicionado à sua base de aprendizados e vai influenciar as próximas sugestões da IA.
                </p>
              </>
            ) : (
              <p className="text-[12px] text-cms-text-dim">Nenhum aprendizado registrado.</p>
            )}
          </div>
        </div>
      </section>

      {/* 6. Placar final */}
      <section data-testid="scoreboard" className="mb-[36px]">
        <div className="flex items-end justify-between gap-[14px] mb-[16px]">
          <div>
            <div className="flex items-center gap-[9px]">
              <LayoutGrid size={17} className="text-cms-accent" aria-hidden="true" />
              <h3 className="text-[19px] font-semibold text-cms-text m-0">Placar final</h3>
            </div>
            <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
              O resultado de cada variante no teste.
            </p>
          </div>
        </div>
        <VariantTable
          variants={view.variants}
          metric="pBest"
          winnerId={view.winnerLabel}
          videoTitle={view.videoTitle}
          thumbs={view.variantThumbs}
        />
      </section>

      {/* 7. GatesPanel — removed, design doesn't show it in winner detail */}

      {/* 8. O momento de clique */}
      <ClickMoment
        videoTitle={view.videoTitle}
        winnerLabel={view.winnerLabel}
        winnerColor={view.winnerColor}
        variants={view.variants.map(v => ({
          label: v.label,
          color: v.color,
          ctr: v.ctr * 100,
          thumbUrl: view.variantThumbs.find(t => t.label === v.label)?.thumbUrl ?? null,
        }))}
      />
    </div>
  )
}
