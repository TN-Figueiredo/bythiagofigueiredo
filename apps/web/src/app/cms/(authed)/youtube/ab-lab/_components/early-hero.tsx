'use client'

import type { EarlyCheckpoint } from './early-types'
import { Sparkles, Check, Clock } from 'lucide-react'

export interface EarlyHeroProps {
  checkpoints: EarlyCheckpoint[]
  pipelineId?: string | null
}

export function EarlyHero({ checkpoints, pipelineId }: EarlyHeroProps) {
  return (
    <div
      data-testid="early-hero"
      className="early-hero-grid"
    >
      {/* Left: pulsing dots + headline */}
      <div className="bg-cms-surface py-[20px] px-[22px]">
        <div className="early-dots flex items-center gap-[4px] mb-[14px]">
          <i aria-hidden="true" />
          <i aria-hidden="true" />
          <i aria-hidden="true" />
        </div>
        <h2 className="display text-[22px] font-semibold text-cms-text leading-[1.25] m-0 mb-[10px]">
          Coletando dados
        </h2>
        <p className="text-[13px] text-cms-text-dim leading-[1.55] max-w-[360px] m-0">
          O motor Bayesiano precisa de pelo menos um ciclo ABBA completo
          para começar a calcular confiança. Os primeiros sinais aparecem
          em poucas horas.
        </p>
        {pipelineId && (
          <button
            type="button"
            className="btn cowork sm mt-[16px]"
          >
            <Sparkles size={13} aria-hidden="true" />
            Ver no Pipeline
          </button>
        )}
      </div>

      {/* Right: checkpoints with ETA */}
      <div className="bg-cms-surface py-[20px] px-[22px] flex flex-col">
        <div className="eyebrow mb-[16px]">Próximos marcos</div>
        <div className="flex flex-col gap-[14px]">
          {checkpoints.map((cp, i) => (
            <div key={i} className={`flex items-start gap-[10px] ${cp.isSoon ? 'soon' : ''}`}>
              <span
                className="size-[22px] rounded-full shrink-0 flex items-center justify-center mt-[1px]"
                style={{
                  background: cp.reached
                    ? 'var(--cms-green-subtle)'
                    : cp.isSoon
                      ? 'var(--cms-accent-subtle, rgba(255,130,64,0.08))'
                      : 'var(--cms-surface-3, var(--cms-surface-hover))',
                  color: cp.reached
                    ? 'var(--cms-green)'
                    : cp.isSoon
                      ? 'var(--cms-accent)'
                      : 'var(--cms-text-dim)',
                }}
              >
                {cp.reached ? (
                  <Check size={12} />
                ) : (
                  <Clock size={12} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-[13px] font-medium ${
                  cp.reached ? 'text-cms-text' : cp.isSoon ? 'text-cms-accent' : 'text-cms-text-dim'
                }`}>
                  {cp.label}
                </div>
                {cp.eta && !cp.reached && (
                  <div className={`text-[11.5px] mt-[2px] font-semibold ${
                    cp.isSoon ? 'text-cms-accent' : 'text-cms-text-dim'
                  }`}>
                    ETA: {cp.eta}
                  </div>
                )}
                {cp.reachedAt && cp.reached && (
                  <div className="text-[11.5px] text-cms-text-dim mt-[2px]">
                    {cp.reachedAt}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
