'use client'

import { useRouter } from 'next/navigation'
import type { AbTestWinnerView } from '@/lib/youtube/ab-types'
import { DetailHeader } from './detail-header'
import { WinnerBanner } from './winner-banner'
import { LiveMonitorCard } from './live-monitor'
import { ComoEstaAgora } from './como-esta-agora'
import { ClickMoment } from './click-moment'
import { previaPorTipo, descricaoDaPrevia } from './previa-por-tipo'
import { PlacarDoTeste } from './placar-do-teste'
import { SectionLabel } from './ab-primitives'
import { archiveAbTest } from '../actions'
import { Archive, Sparkles, LayoutGrid } from 'lucide-react'
import { BTN_SAIDA } from './acoes-de-saida'
import { dataCurtaSp } from './encerrar-props'
import { linhaFicouNoAr } from './cabecalho-do-teste'

export interface WinnerDetailProps {
  view: AbTestWinnerView
}

export function WinnerDetail({ view }: WinnerDetailProps) {
  const router = useRouter()
  const concluidoEm = view.completedAt ? dataCurtaSp(view.completedAt).slice(0, 5) : undefined
  const ficouNoAr = linhaFicouNoAr(view.noAr, concluidoEm)
  return (
    <div data-testid="winner-detail">
      {/* 1. DetailHeader */}
      <div className="mb-[22px]">
        <DetailHeader
          title={view.tituloNoAr ?? view.videoTitle}
          tituloNaUltimaLeitura={view.tituloNaUltimaLeitura}
          youtubeVideoId={view.youtubeVideoId}
          flag={view.flag}
          status={view.status}
          outcome="winner"
          roundNumber={view.totalRounds}
          totalRounds={view.totalRounds}
          hasPlayoff={view.hasPlayoff}
          lab={{ thumbUrl: view.variantThumbs.find(t => t.isOriginal)?.thumbUrl ?? view.variantThumbs[0]?.thumbUrl ?? null, concluidoEm }}
          actions={
            <button type="button" onClick={async () => {
              if (!confirm('Arquivar este teste? Os dados serão preservados mas o teste sairá da lista principal.')) return
              const result = await archiveAbTest(view.id)
              if (!result.ok) alert(result.error)
              else router.push('/cms/youtube/ab-lab')
            }} className={BTN_SAIDA}>
              <Archive size={14} aria-hidden="true" />
              Arquivar
            </button>
          }
        />
      </div>

      {/* 2. WinnerBanner — 28px margin-bottom per design */}
      <div className="mb-[28px]">
        <WinnerBanner
          winnerLabel={view.winnerLabel}
          winnerColor={view.winnerColor}
          lift={null}
          confidence={null}
          stats={view.resultMeta}
          noAr={view.noAr}
          escolhaDoDono={view.escolhaDoDono}
          semLinhaNoAr={ficouNoAr !== null}
        />
        {ficouNoAr ? <div className="pm4"><p className="pm4-sum" data-testid="ficou-no-ar" style={{ marginTop: 16 }}>{ficouNoAr}</p></div> : null}
      </div>

      {/* 4. ComoEstaAgora + LiveMonitorCard (conditional) */}
      {view.monitor && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] mb-[28px]">
          <ComoEstaAgora monitor={view.monitor} />
          <LiveMonitorCard monitor={view.monitor} />
        </div>
      )}

      {/* 5. O aprendizado (a Confiança final saiu com a avaliação automática) */}
      <section data-testid="confidence-section" className="mb-[30px]">
        <div className="grid grid-cols-1 gap-[16px]">
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
        <PlacarDoTeste
          placar={view.placar ?? null}
          faixaDias={view.faixa_dias ?? []}
          variants={view.variants}
          variantDb={view.variantDb}
          thumbs={view.variantThumbs}
          videoTitle={view.videoTitle}
          status={view.status}
          testType={view.flag}
          inicio={view.startedAt ?? null}
          noArLetra={view.noAr?.letra ?? null}
        />
      </section>

      {/* 7. GatesPanel — removed, design doesn't show it in winner detail */}

      {/* 8. O momento de clique */}
      <ClickMoment
        winnerLabel={view.winnerLabel}
        winnerColor={view.winnerColor}
        semCtr
        meta={{ canal: null, publicadoEm: null, duracao: null }}
        descricao={descricaoDaPrevia(view.flag, view.variants.length)}
        variants={previaPorTipo(
          view.flag,
          view.variants.map(v => {
            const t = view.variantThumbs.find(x => x.label === v.label)
            return { label: v.label, thumbUrl: t?.thumbUrl ?? null, title: t?.titleText ?? view.videoTitle, isOriginal: t?.isOriginal ?? v.label === 'A' }
          }),
        ).map(c => {
          const v = view.variants.find(x => x.label === c.label)!
          return { label: c.label, color: v.color, ctr: v.ctr === null ? null : v.ctr * 100, thumbUrl: c.thumbUrl, title: c.title }
        })}
      />
    </div>
  )
}
