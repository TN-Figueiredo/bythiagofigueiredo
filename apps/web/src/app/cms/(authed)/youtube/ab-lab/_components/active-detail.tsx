'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import { VARIANT_COLORS, semImpressoes, liftVsA } from './ab-constants'
import { InfoTip, VChip } from './ab-primitives'
import { DetailHeader } from './detail-header'
import { LockCountdown } from './lock-countdown'
import { HeroBand } from './hero-band'
import { VariantTable } from './variant-table'
import { CredibleInterval } from './credible-interval'
import { MultiLine } from './multi-line'
import { ABBATimeline } from './abba-timeline'
import { FunnelRow } from './funnel-row'
import { ClickMomentUnified } from './click-moment-unified'
import { forceRotate, acknowledgeAbTestDrift, resumeAbTest } from '../actions'
import { DRIFT_STATUS_NOTE } from '@/lib/youtube/ab-types'
import { usePollStats } from './use-poll-stats'
import { SignalCard } from './signal-card'
import { AbPauseDialog } from './ab-pause-dialog'
import { AbEndTestDialog } from './ab-end-test-dialog'
import { dadosDoDialogoEncerrar } from './encerrar-props'
import type { OpcaoEncerrar, ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import './ab-end-test-dialog.css'
import { useCanAdminSite, AdminOnlyNote } from '@/lib/cms/site-admin-context'
import {
  Pause, Square, Settings,
  TrendingUp, RefreshCw, Filter, Zap,
} from 'lucide-react'

export interface ActiveDetailProps {
  view: AbTestActiveView
  /** `endAbTest` com o id do teste, montada no server component da página (nunca importada aqui). */
  encerrar: (o: OpcaoEncerrar) => Promise<ResultadoAcaoSaida>
  /** `pauseAbTest` com o id do teste, idem. */
  pausar: () => Promise<ResultadoAcaoSaida>
}

const BTN = 'inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] border border-cms-border whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim hover:text-cms-text focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none'

export function ActiveDetail({ view, encerrar, pausar }: ActiveDetailProps) {
  const router = useRouter()
  const [showPause, setShowPause] = useState(false)
  const [showEnd, setShowEnd] = useState(false)
  // Aviso de página (role="status") depois de um encerramento em que o YouTube recusou algum campo: 6 s, com fechar.
  const [aviso, setAviso] = useState<string | null>(null)
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 6000)
    return () => clearTimeout(t)
  }, [aviso])
  // Degrau "administrar o site": forçar rotação e aplicar vencedor mexem no canal de verdade.
  const canAdminSite = useCanAdminSite()
  const [driftBusy, setDriftBusy] = useState(false)
  const { data: livePoll } = usePollStats(view.id, view.status === 'active')

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

  const funnelVariants = view.variants.map(v => ({
    impressions: v.impressions,
    clicks: v.clicks,
    linkClicks: v.linkClicks ?? 0,
    color: v.color,
  }))


  const actionButtons = (
    <>
      <button type="button" onClick={() => setShowPause(true)} className={BTN}>
        <Pause size={14} aria-hidden="true" />
        Pausar
      </button>
      <button type="button" onClick={() => setShowEnd(true)} className={BTN}>
        <Square size={14} aria-hidden="true" />
        Encerrar
      </button>
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
      <div role="status" aria-live="polite">
        {aviso ? (
          <p className="etd-aviso">
            <span>{aviso}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Fechar aviso">Fechar</button>
          </p>
        ) : null}
      </div>
      {/* ── Section 1: Header with inline actions ── */}
      <div data-section="header" className="mb-[16px]">
        <DetailHeader
          title={view.videoTitle}
          flag={view.flag}
          status={view.status}
          roundNumber={1}
          totalRounds={view.totalRounds}
          hasPlayoff={view.hasPlayoff}
          dayInfo={{ dayOf: view.cycles.done, total: view.durationDays }}
          actions={actionButtons}
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
            const res = await resumeAbTest(view.id)
            if (!res.ok) { alert(`Falha ao retomar: ${res.error}`); setDriftBusy(false); router.refresh(); return }
            router.refresh()
          }} className="btn primary sm shrink-0 self-center" style={{ whiteSpace: 'nowrap' }}>
            {driftBusy ? 'Retomando…' : 'Reconhecer e Retomar'}
          </button>
        </div>
      )}

      {view.status === 'paused' && view.statusNote !== DRIFT_STATUS_NOTE && (
        <div className="mx-0 mb-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-blue-300">Teste pausado. Reconecte o token do YouTube se necessário e retome a rotação.</p>
            <button disabled={driftBusy} onClick={async () => {
              setDriftBusy(true)
              const res = await resumeAbTest(view.id)
              if (!res.ok) { alert(`Falha ao retomar: ${res.error}`); setDriftBusy(false); return }
              router.refresh()
            }} className="shrink-0 rounded-md bg-blue-500 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-400 disabled:opacity-50">
              {driftBusy ? 'Retomando…' : 'Retomar Teste'}
            </button>
          </div>
        </div>
      )}

      {/* ── Section 2: Lock Countdown ── */}
      <div data-section="lock-countdown" className="mb-[16px]">
        <LockCountdown
          dayOf={view.cycles.done}
          durationDays={view.durationDays}
          confidence={data.confidence}
          confidenceTarget={view.confidenceTarget * 100}
          cyclesCompleted={view.cycles.done}
          createdAt={view.createdAt}
          hasPlayoff={view.hasPlayoff}
        />
      </div>

      {/* ── Section 3: Hero Band ── */}
      <div data-section="hero-band" className="mb-[16px]">
        <HeroBand
          leader={{ label: data.leader, color: data.leaderColor }}
          trend={trend}
          semMedicao={semMedicao}
          liftLider={liftVsA(view.variants.find(v => v.label === 'A'), view.variants.find(v => v.label === data.leader))}
        />
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

      {/* ── Section 5: Placar das variantes ── */}
      <section data-section="variant-performance" className="mb-[24px]">
        <VariantTable
          variants={view.variants}
          leaderId={data.leader}
          activeNow={view.activeNow ?? undefined}
          thumbs={view.variantThumbs}
          videoTitle={view.videoTitle}
          semChance
        />
      </section>

      {/* ── Section 7: Faixa provável de CTR ── */}
      {!semMedicao && (<div className="mb-[24px]">
        {/* Faixa provável de CTR */}
        <div className="rounded-[12px] border border-cms-border bg-cms-surface overflow-hidden" style={{ boxShadow: 'var(--shadow)' }}>
          <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-cms-border">
            <TrendingUp size={15} className="text-cms-text-dim" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-cms-text">Faixa provável de CTR</span>
            <span className="text-[11.5px] text-cms-text-dim ml-auto">intervalo de credibilidade 95%</span>
          </div>
          <div className="px-[16px] py-[14px]">
            <CredibleInterval variants={view.variants} leader={data.leader} />
          </div>
        </div>
      </div>)}

      {/* ── Section 8: CTR diário por variante ── */}
      {!semMedicao && (<div className="rounded-[12px] border border-cms-border bg-cms-surface overflow-hidden mb-[24px]" style={{ boxShadow: 'var(--shadow)' }}>
        <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-cms-border">
          <TrendingUp size={15} className="text-cms-text-dim" aria-hidden="true" />
          <span className="text-[13px] font-semibold text-cms-text">CTR diário por variante</span>
          <span className="text-[11.5px] text-cms-text-dim ml-auto">últimos {Object.values(view.daily)[0]?.length ?? 0} dias</span>
          <div className="flex gap-[10px] ml-[16px]">
            {view.variants.map(v => (
              <span key={v.label} className="inline-flex items-center gap-[5px] text-[11px] text-cms-text-dim">
                <span className="rounded-[2px]" style={{ width: 10, height: 3, background: v.color }} aria-hidden="true" />
                {v.label}
              </span>
            ))}
          </div>
        </div>
        <div className="px-[16px] py-[14px]">
          <MultiLine series={view.daily} colors={VARIANT_COLORS} />
        </div>
      </div>)}

      {/* ── Section 9: Rotação ABBA + Funil por variante ── */}
      <div className={`grid grid-cols-1 ${semMedicao ? '' : 'md:grid-cols-2'} gap-[16px] mb-[24px]`}>
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
        {!semMedicao && (<div className="rounded-[12px] border border-cms-border bg-cms-surface overflow-hidden" style={{ boxShadow: 'var(--shadow)' }}>
          <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-cms-border">
            <Filter size={15} className="text-cms-text-dim" aria-hidden="true" />
            <span className="text-[13px] font-semibold text-cms-text">Funil por variante</span>
            <span className="text-[11.5px] text-cms-text-dim ml-auto">líder</span>
          </div>
          <div className="px-[16px] py-[14px]">
            {(() => {
              const leaderIdx = view.variants.findIndex(v => v.label === data.leader)
              const funnel = funnelVariants[leaderIdx >= 0 ? leaderIdx : 0]
              return funnel ? <FunnelRow variant={funnel} /> : null
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
            ctr: v.ctr * 100,
            thumbUrl: view.variantThumbs.find(t => t.label === v.label)?.thumbUrl ?? null,
          }))}
          leaderLabel={data.leader}
        />
      </div>

      {showPause && (
        <AbPauseDialog
          pausar={pausar}
          onClose={() => setShowPause(false)}
        />
      )}
      {showEnd && (
        <AbEndTestDialog
          aberto
          onFechar={() => setShowEnd(false)}
          testeNome={view.videoTitle}
          {...dadosDoDialogoEncerrar(view)}
          podeDeixarVariante={canAdminSite}
          encerrar={encerrar}
          onAviso={setAviso}
        />
      )}
    </div>
  )
}
