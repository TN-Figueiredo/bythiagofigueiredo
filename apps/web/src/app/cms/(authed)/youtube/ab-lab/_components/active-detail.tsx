'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import { semImpressoes, liftVsA, medicaoCompleta, medidas } from './ab-constants'
import { InfoTip, VChip } from './ab-primitives'
import { DetailHeader } from './detail-header'
import { HeroBand } from './hero-band'
import { PlacarDoTeste } from './placar-do-teste'
import { ResumoV2, AndamentoV2, PisosV2, SinalV2 } from './blocos-v2'
import { CredibleInterval } from './credible-interval'
import { ABBATimeline } from './abba-timeline'
import { FunnelRow } from './funnel-row'
import { ClickMomentUnified } from './click-moment-unified'
import { forceRotate, acknowledgeAbTestDrift } from '../actions'
import { pausaVisivel } from '@/lib/youtube/teste-youtube/nativo/pausa-visivel'
import { DRIFT_STATUS_NOTE } from '@/lib/youtube/ab-types'
import { usePollStats } from './use-poll-stats'
import { SignalCard } from './signal-card'
import { AcoesDeSaida, BTN_SAIDA, useAvisoDePagina } from './acoes-de-saida'
import type { OpcaoEncerrar, ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { useCanAdminSite, AdminOnlyNote } from '@/lib/cms/site-admin-context'
import {
  Settings,
  TrendingUp, RefreshCw, Filter, Zap,
} from 'lucide-react'

export interface ActiveDetailProps {
  view: AbTestActiveView
  /** `endAbTest` com o id do teste, montada no server component da página (nunca importada aqui). */
  encerrar: (o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida>
  /** `pauseAbTest` com o id do teste, idem. */
  pausar: (seqVisto: number) => Promise<ResultadoAcaoSaida>
  /** `resumeAbTest` com o id do teste, idem (T10: sai do import direto de `../actions`). */
  retomar: (seqVisto: number) => Promise<ResultadoAcaoSaida>
  /** Relógio injetável; só decide o texto da pausa por teste do YouTube (o botão depende do dado). */
  agora?: () => Date
}

const BTN = BTN_SAIDA

export function ActiveDetail({ view, encerrar, pausar, retomar, agora }: ActiveDetailProps) {
  const router = useRouter()
  const { setAviso } = useAvisoDePagina(view.id)
  // Degrau "administrar o site": forçar rotação e aplicar vencedor mexem no canal de verdade.
  const canAdminSite = useCanAdminSite()
  const [driftBusy, setDriftBusy] = useState(false)
  const { data: livePoll } = usePollStats(view.id, view.status === 'active' && view.placar?.iniciado !== false)

  // Pausa por teste do YouTube: o botão "Retomar" segue o registro (dado); a data é só texto.
  const pausaTeste = view.status === 'paused' && view.pausaYoutube ? pausaVisivel(view.pausaYoutube, (agora ?? (() => new Date()))()) : null
  const data = view.confirmedData
  const semMedicao = semImpressoes(view.variants)

  const trend: 'up' | 'flat' | 'down' = (() => {
    const len = view.confTrend.length
    if (len < 2) return 'flat'
    const prev = view.confTrend[len - 2]!
    const curr = view.confTrend[len - 1]!
    if (curr > prev + 1) return 'up'
    if (curr < prev - 1) return 'down'
    return 'flat'
  })()

  const abbaColors: Record<string, string> = {}
  for (const v of view.variants) {
    abbaColors[v.label] = v.color
  }

  const comparavel = medicaoCompleta(view.variants)
  // Sem estatística de vencedor (D-F3-2) ninguém é líder: sem hero, sem destaque na tabela e sem faixa provável.
  const comEstatistica = view.placar?.estatistica === 'calculada'
  // Tela v2 (S8-F4 T12): o modelo vem pronto do servidor; a tela só desenha.
  const v2 = view.v2?.fase === 'ativo' ? view.v2 : null


  const actionButtons = (
    <>
      <AcoesDeSaida view={view} encerrar={encerrar} pausar={pausar} onAviso={setAviso} />
      {canAdminSite ? (
        <button
          type="button"
          className={BTN}
          onClick={async () => {
            if (!confirm('Forçar rotação agora? A variante atual será trocada imediatamente.')) return
            const result = await forceRotate(view.id)
            if (!result.ok) alert(result.error)
            else router.refresh()
          }}
        >
          <RefreshCw size={14} aria-hidden="true" />
          Forçar rotação
        </button>
      ) : (
        <AdminOnlyNote action="forçar rotação" className="text-cms-text-dim" />
      )}
      <button type="button" aria-label="Configurações" className={BTN}>
        <Settings size={14} aria-hidden="true" />
      </button>
    </>
  )

  return (
    <div data-testid="active-detail">
      {/* ── Section 1: Header with inline actions ── */}
      <div data-section="header">
        <DetailHeader
          title={view.videoTitle}
          youtubeVideoId={view.youtubeVideoId}
          flag={view.flag}
          status={view.status}
          roundNumber={1}
          totalRounds={view.totalRounds}
          hasPlayoff={view.hasPlayoff}
          dayInfo={{ dayOf: view.dayOf, total: Math.max(view.dayOf, view.durationDays) }}
          lab={{ thumbUrl: view.variantThumbs.find(t => t.isOriginal)?.thumbUrl ?? view.variantThumbs[0]?.thumbUrl ?? null, naoIniciado: view.placar?.iniciado === false }}
        />
      </div>

      {/* ── Conditional Banners ── */}
      {view.status === 'paused' && view.statusNote === DRIFT_STATUS_NOTE && (
        <div
          className="drift-banner mx-0 mb-4 flex gap-[14px] py-[18px] px-[20px]"
          style={{
            borderRadius: 'var(--radius, 14px)',
            background: 'var(--cms-amber-soft, rgba(224,162,60,0.14))',
            border: '1px solid rgba(224,162,60,0.32)',
          }}
        >
          <span className="drift-ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cms-amber, #E0A23C)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-cms-text m-0">Teste pausado automaticamente — thumbnail alterada fora do A/B Lab</p>
            <p className="text-[12.5px] text-cms-text-dim mt-[3px] leading-[1.5] m-0">Verifique a situação no YouTube e reconecte o token antes de retomar.</p>
          </div>
          <button disabled={driftBusy} onClick={async () => {
            setDriftBusy(true)
            const ack = await acknowledgeAbTestDrift(view.id)
            if (!ack.ok) { alert(ack.error); setDriftBusy(false); return }
            const res = await retomar(view.restoreSeq)
            if (!res.ok) { alert(`Falha ao retomar: ${res.error}`); setDriftBusy(false); router.refresh(); return }
            router.refresh()
          }} className="btn primary sm shrink-0 self-center" style={{ whiteSpace: 'nowrap' }}>
            {driftBusy ? 'Retomando…' : 'Reconhecer e Retomar'}
          </button>
        </div>
      )}

      {view.status === 'paused' && view.statusNote !== DRIFT_STATUS_NOTE && (
        <div className="cn-raiz mx-0 mt-4 mb-4 rounded-lg px-4 py-3" style={{ border: '1px dashed var(--cn-yt-line)', background: 'var(--cn-yt-bg)' }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium" style={{ color: 'var(--cn-yt)' }}>{pausaTeste?.frase ?? 'Teste pausado. Reconecte o token do YouTube se necessário e retome a rotação.'}</p>
            <button disabled={driftBusy || pausaTeste?.retomarDesabilitado === true} onClick={async () => {
              setDriftBusy(true)
              const res = await retomar(view.restoreSeq)
              if (!res.ok) { alert(`Falha ao retomar: ${res.error}`); setDriftBusy(false); return }
              router.refresh()
            }} className="shrink-0 rounded-md bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-400 disabled:opacity-50">
              {driftBusy ? 'Retomando…' : 'Retomar Teste'}
            </button>
          </div>
        </div>
      )}

      {/* ── Section 3: Hero Band ── */}
      {comEstatistica && (<div data-section="hero-band" className="mb-[16px]">
        <HeroBand
          leader={{ label: data.leader, color: data.leaderColor }}
          trend={trend}
          semMedicao={semMedicao}
          liftLider={liftVsA(view.variants.find(v => v.label === 'A'), view.variants.find(v => v.label === data.leader))}
        />
      </div>)}

      {/* ── Section 5: Placar das variantes ── */}
      {v2 && (
        <div className="cn-raiz pv2 mb-[8px]" data-testid="tela-v2">
          <ResumoV2 frase={v2.frase} ilegivel={v2.ilegivel} />
          <AndamentoV2 dia={v2.dia} teto={v2.teto} pausado={v2.pausado} />
          <PisosV2 linhas={v2.pisos} n={v2.n} final={false} />
          {v2.sinal ? <SinalV2 letra={v2.sinal} /> : null}
        </div>
      )}

      <section data-section="variant-performance" className="mb-[24px]">
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
          andamento={v2 ? undefined : { dayOf: view.dayOf, total: Math.max(view.dayOf, view.durationDays) }}
          modoV2={v2 !== null}
        />
      </section>

      {/* Ações do teste: depois do placar (ordem do M4 r3.1: rastro, título, selo, frase, faixa; o resto vem depois). */}
      <div className="cn-raiz dhl mb-[24px]" data-section="acoes">
        <div className="dhl-acoes" style={{ marginTop: 0 }}>{actionButtons}</div>
      </div>

      {/* ── Section 4: Signal ao vivo + Métricas computadas (side by side) ── */}
      <div className={`grid grid-cols-1 ${view.outlier || view.daysRemaining ? 'md:grid-cols-2' : ''} gap-[16px] mb-[16px]`}>
        <SignalCard
          live={livePoll?.delta ? {
            viewsDelta: livePoll.delta.views,
            likesDelta: livePoll.delta.likes,
            polledAt: livePoll.polledAt,
          } : view.pollData ? {
            viewsDelta: view.pollData.viewsDelta,
            likesDelta: view.pollData.likesDelta,
            polledAt: view.pollData.polledAt,
          } : undefined}
        />
        {/* Métricas computadas card: sem outlier nem previsão não há o que mostrar */}
        {(view.outlier || view.daysRemaining) && (<div className="rounded-[12px] border border-cms-border bg-cms-surface overflow-hidden">
          {/* card-head */}
          <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-cms-border">
            <Zap size={15} className="text-cms-text-dim" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-cms-text">Métricas computadas</span>
          </div>
          {/* card-pad */}
          <div className="flex flex-wrap gap-[24px] px-[16px] py-[14px]">
            {view.outlier && (
              <div>
                <span className="eyebrow">Outlier</span>
                <span className="block font-mono text-[22px] font-bold leading-none tracking-tight text-cms-text mt-[4px]">
                  {view.outlier.multiplier.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}x
                </span>
              </div>
            )}
            {view.daysRemaining && (
              <div>
                <span className="eyebrow">Conclusão em</span>
                <span className="block font-mono text-[22px] font-bold leading-none tracking-tight text-cms-text mt-[4px]">
                  ~{view.daysRemaining.days > 900 ? '∞' : view.daysRemaining.days}
                  <span className="text-[11px] font-normal text-cms-text-dim"> dias</span>
                </span>
              </div>
            )}
          </div>
        </div>)}
      </div>

      {/* ── Section 7: Faixa provável de CTR ── */}
      {comEstatistica && comparavel && (<div className="mb-[24px]">
        {/* Faixa provável de CTR */}
        <div className="rounded-[12px] border border-cms-border bg-cms-surface overflow-hidden" style={{ boxShadow: 'var(--shadow)' }}>
          <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-cms-border">
            <TrendingUp size={15} className="text-cms-text-dim" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-cms-text">Faixa provável de CTR</span>
            <span className="text-[11.5px] text-cms-text-dim ml-auto">intervalo de credibilidade 95%</span>
          </div>
          <div className="px-[16px] py-[14px]">
            <CredibleInterval variants={medidas(view.variants)} leader={data.leader} />
          </div>
        </div>
      </div>)}

      {/* CTR diário por variante: fora da F3 (volta na F4 com a estatística); a série `daily` fica vazia, nunca 0. */}

      {/* ── Section 9: Rotação ABBA + Funil por variante ── */}
      <div className={`grid grid-cols-1 ${comEstatistica && comparavel ? 'md:grid-cols-2' : ''} gap-[16px] mb-[24px]`}>
        {/* Rotação ABBA */}
        <div className="rounded-[12px] border border-cms-border bg-cms-surface overflow-hidden" style={{ boxShadow: 'var(--shadow)' }}>
          <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-cms-border">
            <RefreshCw size={15} className="text-cms-text-dim" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-cms-text">Rotação ABBA</span>
            <span className="text-[11.5px] text-cms-text-dim ml-auto">{view.cycles.done}/{view.cycles.total} ciclos</span>
          </div>
          <div className="px-[16px] py-[14px]">
            <ABBATimeline
              seq={view.abbaSeq}
              total={view.cycles.total}
              done={view.cycles.done}
              colors={abbaColors}
            />
          </div>
        </div>

        {/* Funil por variante (líder): sem impressões medidas não há funil */}
        {comEstatistica && comparavel && (<div className="rounded-[12px] border border-cms-border bg-cms-surface overflow-hidden" style={{ boxShadow: 'var(--shadow)' }}>
          <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-cms-border">
            <Filter size={15} className="text-cms-text-dim" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-cms-text">Funil por variante</span>
            <span className="text-[11.5px] text-cms-text-dim ml-auto">líder</span>
          </div>
          <div className="px-[16px] py-[14px]">
            {(() => {
              const lider = view.variants.find(v => v.label === data.leader) ?? view.variants[0]
              if (!lider || lider.impressions === null || lider.clicks === null) return null
              return <FunnelRow variant={{ impressions: lider.impressions, clicks: lider.clicks, linkClicks: lider.linkClicks ?? 0, color: lider.color }} />
            })()}
          </div>
        </div>)}
      </div>

      {/* ── Section 11: O momento de clique ── */}
      <div className="mb-[24px]">
        <ClickMomentUnified
          videoTitle={view.videoTitle}
          variants={view.variants.map(v => ({
            label: v.label,
            color: v.color,
            thumbUrl: view.variantThumbs.find(t => t.label === v.label)?.thumbUrl ?? null,
          }))}
          leaderLabel={data.leader}
        />
      </div>
    </div>
  )
}
