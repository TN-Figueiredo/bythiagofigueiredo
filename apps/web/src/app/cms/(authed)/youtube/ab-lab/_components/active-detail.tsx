'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AbTestActiveView } from '@/lib/youtube/ab-types'
import { VARIANT_COLORS } from './ab-constants'
import { InfoTip, VChip } from './ab-primitives'
import { DetailHeader } from './detail-header'
import { LockCountdown } from './lock-countdown'
import { HeroBand } from './hero-band'
import { VariantTable } from './variant-table'
import { ConfidenceChart } from './confidence-chart'
import { RadarChart } from './radar-chart'
import { CredibleInterval } from './credible-interval'
import { RankBars } from './rank-bars'
import { MultiLine } from './multi-line'
import { ABBATimeline } from './abba-timeline'
import { FunnelRow } from './funnel-row'
import { ClickMoment } from './click-moment'
import { forceRotate } from '../actions'
import {
  Pause, Settings,
  LayoutGrid, TrendingUp, Crosshair, Target, BarChart3, LineChart, RefreshCw, Filter,
} from 'lucide-react'

export interface ActiveDetailProps {
  view: AbTestActiveView
}

const BTN = 'inline-flex items-center gap-[7px] justify-center py-[6px] px-[11px] text-[12.5px] font-semibold rounded-[9px] border border-cms-border whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim hover:text-cms-text focus-visible:ring-2 focus-visible:ring-cms-accent focus-visible:outline-none'

export function ActiveDetail({ view }: ActiveDetailProps) {
  const router = useRouter()
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
        {view.liveData && (
          <>
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
            <InfoTip text="Confirmado = dados finais da API do YouTube (atraso de 2–3 dias). Live = estimativa do ciclo atual, instantânea mas imprecisa." />
          </>
        )}
        <button type="button" className={BTN}>
          <Pause size={14} aria-hidden="true" />
          Pausar
        </button>
        <button type="button" aria-label="Configurações" className={BTN}>
          <Settings size={14} aria-hidden="true" />
        </button>
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
          Forçar Rotação
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
      <section data-section="variant-performance" className="mb-[36px]">
        <div className="flex items-end justify-between gap-[14px] mb-[16px]">
          <div>
            <div className="flex items-center gap-[9px]">
              <LayoutGrid size={17} className="text-cms-accent" aria-hidden="true" />
              <h3 className="text-[19px] font-semibold text-cms-text m-0">Placar das variantes</h3>
            </div>
            <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
              O número que decide: CTR e chance de vencer de cada variante. Clique numa linha pra abrir os detalhes.
            </p>
          </div>
        </div>
        <VariantTable
          variants={view.variants}
          metric="pBest"
          leaderId={data.leader}
          activeNow={view.activeNow ?? undefined}
          thumbs={view.variantThumbs}
          videoTitle={view.videoTitle}
        />
      </section>

      {/* Section 5: Confiança ao longo do tempo + Raio-X das variantes */}
      <section data-section="charts-confidence-radar" className="mb-[16px]">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
          {/* Left: Confiança ao longo do tempo */}
          <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
            <div className="flex items-end justify-between gap-[14px] mb-[16px]">
              <div>
                <div className="flex items-center gap-[9px]">
                  <TrendingUp size={17} className="text-cms-accent" aria-hidden="true" />
                  <h3 className="text-[19px] font-semibold text-cms-text m-0">Confiança ao longo do tempo</h3>
                </div>
                <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
                  Sobe conforme os ciclos ABBA acumulam dados. Bata a meta = vencedor declarado.
                </p>
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
              <div>
                <div className="flex items-center gap-[9px]">
                  <Crosshair size={17} className="text-cms-accent" aria-hidden="true" />
                  <h3 className="text-[19px] font-semibold text-cms-text m-0">Raio-X das variantes</h3>
                </div>
                <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
                  Cada eixo é um fator. Quanto mais a forma se estica pra fora, mais forte a variante.
                </p>
              </div>
              <div className="flex gap-[12px] shrink-0">
                {view.variants.map(v => (
                  <span key={v.label} className="inline-flex items-center gap-[5px] text-[11.5px] text-cms-text-dim">
                    <span className="rounded-[2px]" style={{ width: 10, height: 3, background: v.color }} aria-hidden="true" />
                    {v.label}
                  </span>
                ))}
              </div>
            </div>
            <RadarChart variants={view.variants} />
          </div>
        </div>
      </section>

      {/* Section 6: Faixa provável de CTR & chance de vencer */}
      <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px] mb-[36px]">
        <div className="flex items-end justify-between gap-[14px] mb-[16px]">
          <div>
            <div className="flex items-center gap-[9px]">
              <TrendingUp size={17} className="text-cms-accent" aria-hidden="true" />
              <h3 className="text-[19px] font-semibold text-cms-text m-0">
                Faixa provável de CTR &amp; chance de vencer
                <InfoTip text="A faixa é o intervalo credível Bayesiano — 95% de chance do CTR real estar ali. A chance de vencer vem de 10.000 simulações Monte Carlo." />
              </h3>
            </div>
            <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
              A barra é a faixa onde o CTR real de cada variante deve cair. Faixas que se sobrepõem = empate; bem separadas = vencedor claro.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-[1.2fr_1fr] gap-[28px] items-center">
          {/* Left: Faixa provável de CTR */}
          <div>
            <div className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[12px]">
              Faixa provável de CTR (taxa de clique)
            </div>
            <CredibleInterval variants={view.variants} leader={data.leader} />
          </div>
          {/* Right: Chance de ser o melhor */}
          <div>
            <div className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em] mb-[12px]">
              Chance de ser o melhor
            </div>
            <RankBars variants={view.variants} metric="pBest" />
            <p className="text-[11.5px] text-cms-text-dim mt-[12px] leading-[1.45] m-0">
              Calculado por 10.000 simulações do motor Bayesiano — não é só o CTR cru, leva em conta o tamanho da amostra.
            </p>
          </div>
        </div>
      </div>

      {/* Section 7: CTR diário por variante */}
      <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px] mb-[36px]">
        <div className="flex items-end justify-between gap-[14px] mb-[16px]">
          <div>
            <div className="flex items-center gap-[9px]">
              <TrendingUp size={17} className="text-cms-accent" aria-hidden="true" />
              <h3 className="text-[19px] font-semibold text-cms-text m-0">CTR diário por variante</h3>
            </div>
            <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
              Dia a dia, com a rotação ABBA já contrabalançando o viés de fim de semana.
            </p>
          </div>
          <div className="flex gap-[12px] shrink-0">
            {view.variants.map(v => (
              <span key={v.label} className="inline-flex items-center gap-[5px] text-[11.5px] text-cms-text-dim">
                <span className="rounded-[2px]" style={{ width: 10, height: 3, background: v.color }} aria-hidden="true" />
                {v.label}
              </span>
            ))}
          </div>
        </div>
        <MultiLine series={view.daily} colors={VARIANT_COLORS} />
      </div>

      {/* Section 8: Rotação ABBA + Funil por variante */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] mb-[36px]">
        {/* Left: Rotação ABBA */}
        <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
          <div className="flex items-end justify-between gap-[14px] mb-[16px]">
            <div>
              <div className="flex items-center gap-[9px]">
                <RefreshCw size={17} className="text-cms-accent" aria-hidden="true" />
                <h3 className="text-[19px] font-semibold text-cms-text m-0">
                  Rotação ABBA
                  <InfoTip text="A rotação ABBA alterna variantes em pares espelhados (A→B→B→A) para cancelar o viés de horário e dia da semana." />
                </h3>
              </div>
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
            <div>
              <div className="flex items-center gap-[9px]">
                <Filter size={17} className="text-cms-accent" aria-hidden="true" />
                <h3 className="text-[19px] font-semibold text-cms-text m-0">
                  Funil por variante
                  <InfoTip text="Impressão → view (CTR) → clique no link rastreado. Mostra onde cada variante perde audiência." />
                </h3>
              </div>
              <p className="text-[12.5px] text-cms-text-dim mt-[5px] max-w-[540px] m-0">
                Impressão → view → clique no link rastreado.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-[14px]">
            {view.variants.map((v, i) => {
              const isOriginal = v.label === 'A'
              const isLeader = v.label === data.leader
              const roleLabel = isOriginal ? 'Original' : isLeader ? 'Hero' : 'Challenger'
              return (
                <div key={v.label}>
                  <div className="flex items-center gap-[8px] mb-[7px]">
                    <VChip label={v.label} size={16} />
                    <span className="text-[11.5px] text-cms-text-dim">{roleLabel}</span>
                  </div>
                  <FunnelRow variant={funnelVariants[i]!} />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Section 9: Critérios de resolução automática */}
      <div className="rounded-lg border border-cms-border bg-cms-surface p-[20px]">
        <div className="flex items-center justify-between mb-[14px]">
          <span className="text-[9px] font-semibold text-cms-text-dim uppercase tracking-[0.08em]">
            Critérios de resolução automática
            <InfoTip text="O teste só encerra automaticamente quando TODOS os critérios forem atendidos. Se algum falhar, o motor continua coletando dados." />
          </span>
          <span className="font-mono text-[12px] text-cms-text-dim">
            {view.gates.filter(g => g.passed).length}/{view.gates.length} aprovados
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-[18px] gap-y-[10px]">
          {view.gates.map(gate => (
            <div key={gate.name} className="flex items-center gap-[10px]">
              <span
                className="size-[20px] rounded-full shrink-0 flex items-center justify-center"
                style={{
                  background: gate.passed ? 'var(--cms-green-subtle)' : 'var(--cms-surface-3, var(--cms-surface-hover))',
                  color: gate.passed ? 'var(--cms-green)' : 'var(--cms-text-dim)',
                }}
              >
                {gate.passed ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-[12.5px] font-medium ${gate.passed ? 'text-cms-text' : 'text-cms-text-dim'}`}>
                  {gate.name === 'confidence' ? 'Confiança ≥ 95%' :
                   gate.name === 'min_impressions' ? 'Impressões ≥ 1.000/var' :
                   gate.name === 'min_duration' ? 'Duração ≥ 7 dias' :
                   gate.name === 'abba_cycles' ? 'Ciclos ≥ 14' :
                   gate.name === 'burn_in' ? 'Burn-in aplicado' :
                   gate.name === 'stability' ? 'Estabilidade 3×' : gate.name}
                </div>
                {gate.hint && !gate.passed && (
                  <div className="text-[10.5px] text-cms-text-dim">{gate.hint}</div>
                )}
              </div>
              <span className={`font-mono text-[12px] font-semibold shrink-0 ${gate.passed ? 'text-cms-green' : 'text-cms-text-dim'}`}>
                {gate.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 10: O momento de clique */}
      <div className="mt-[36px]" />
      <ClickMoment
        videoTitle={view.videoTitle}
        winnerLabel={data.leader as any}
        winnerColor={data.leaderColor}
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
