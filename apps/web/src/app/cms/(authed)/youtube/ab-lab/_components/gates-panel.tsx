'use client'

import type { GateResult } from '@/lib/youtube/ab-types'
import { Badge } from './ab-primitives'

export interface GatesPanelProps {
  gates: GateResult[]
}

const GATE_LABELS: Record<string, string> = {
  confidence: 'Confiança ≥ 95%',
  min_impressions: 'Impressões ≥ 1.000 / variante',
  min_duration: 'Duração ≥ 7 dias',
  abba_cycles: 'Ciclos ABBA ≥ 14',
  burn_in: 'Burn-in concluído',
  stability: 'Estabilidade 3× seguidas',
}

export function GatesPanel({ gates }: GatesPanelProps) {
  if (gates.length === 0) return null

  const passedCount = gates.filter(g => g.passed).length

  return (
    <div className="rounded-[12px] border border-cms-border bg-cms-surface overflow-hidden" style={{ boxShadow: 'var(--shadow)' }}>
      <div className="flex items-center gap-[8px] px-[16px] py-[12px] border-b border-cms-border">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cms-text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
        <span className="text-[13px] font-semibold text-cms-text">Critérios de resolução automática</span>
        <Badge tone="neutral" className="ml-auto">{passedCount}/{gates.length} ok</Badge>
      </div>
      <div
        className="grid grid-cols-2 px-[16px] py-[14px]"
        style={{ gap: 11 }}
      >
        {gates.map(gate => {
          const pass = gate.passed
          return (
            <div
              key={gate.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '11px 13px',
                borderRadius: 'var(--radius-sm, 10px)',
                background: pass ? 'rgba(70,177,126,0.12)' : 'var(--cms-surface-hover)',
                border: pass ? '1px solid rgba(70,177,126,0.25)' : '1px solid var(--cms-border)',
              }}
            >
              {/* gate-check: 24x24 rounded-7 */}
              <span
                style={{
                  width: 24, height: 24, minWidth: 24,
                  borderRadius: 7,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  background: pass ? 'var(--cms-green)' : 'rgba(55,48,40,1)',
                  color: pass ? '#11150f' : 'var(--cms-text-dim)',
                }}
              >
                {pass ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0" /><path d="M12 7v5l3 2" /></svg>
                )}
              </span>
              {/* col grow */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', minWidth: 0 }}>
                <span style={{ fontSize: '12.5px', fontWeight: 500 }} className="text-cms-text">{GATE_LABELS[gate.name] ?? gate.name}</span>
                <span style={{ fontSize: '11px' }} className="font-mono text-cms-text-dim">{gate.value}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
