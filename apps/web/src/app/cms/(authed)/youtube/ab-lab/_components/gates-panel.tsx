'use client'

import type { GateResult } from '@/lib/youtube/ab-types'
import { InfoTip } from './ab-primitives'

export interface GatesPanelProps {
  gates: GateResult[]
}

const GATE_NAME_MAP: Record<string, string> = {
  confidence: 'Confianca >= 95%',
  min_impressions: 'Impressoes >= 1.000/var',
  min_duration: 'Duracao >= 7 dias',
  abba_cycles: 'Ciclos >= 14',
  burn_in: 'Burn-in aplicado',
  stability: 'Estabilidade 3x',
}

export function GatesPanel({ gates }: GatesPanelProps) {
  if (gates.length === 0) {
    return (
      <div className="rounded-[14px] border border-cms-border bg-cms-surface p-[20px]">
        <p className="text-xs text-cms-text-muted text-center py-2">Nenhum gate configurado.</p>
      </div>
    )
  }

  const passedCount = gates.filter(g => g.passed).length

  return (
    <div className="rounded-[14px] border border-cms-border bg-cms-surface p-[20px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-[14px]">
        <span className="eyebrow flex items-center gap-[5px]">
          Criterios de resolucao automatica
          <InfoTip text="O teste so encerra automaticamente quando TODOS os criterios forem atendidos. Se algum falhar, o motor continua coletando dados." />
        </span>
        <span className="mono text-[12px] text-cms-text-dim">
          {passedCount}/{gates.length} aprovados
        </span>
      </div>

      {/* 2-col gates grid */}
      <div role="list" className="gates-grid grid grid-cols-2 gap-[10px]">
        {gates.map(gate => (
          <div
            key={gate.name}
            role="listitem"
            className={`gate-item ${gate.passed ? 'pass' : ''}`}
          >
            <span
              className="size-[24px] shrink-0 grid place-items-center"
              style={{
                borderRadius: 7,
                background: gate.passed ? 'var(--cms-green)' : 'var(--cms-surface-3, var(--cms-surface-hover))',
                color: gate.passed ? '#11150f' : 'var(--cms-text-dim)',
              }}
            >
              {gate.passed ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div className={`text-[12.5px] font-medium ${gate.passed ? 'text-cms-text' : 'text-cms-text-dim'}`}>
                {GATE_NAME_MAP[gate.name] ?? gate.name}
              </div>
              {gate.hint && !gate.passed && (
                <div className="text-[10.5px] text-cms-text-dim">{gate.hint}</div>
              )}
            </div>
            <span className={`mono text-[12px] font-semibold shrink-0 ${gate.passed ? 'text-cms-green' : 'text-cms-text-dim'}`}>
              {gate.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
