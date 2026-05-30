'use client'

import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { CfgRow, Slider, Seg, SectionLabel } from './ab-primitives'

interface StepConfigProps {
  config: WizardConfig
  onChange: <K extends keyof WizardConfig>(key: K, value: WizardConfig[K]) => void
}

const ROTATION_OPTIONS = ['abba', 'round_robin', 'random'] as const
const ROTATION_LABELS: Record<(typeof ROTATION_OPTIONS)[number], string> = {
  abba: 'ABBA',
  round_robin: 'Sequencial',
  random: 'Aleatório',
}

/* --- 42x24 Toggle matching settings-drawer style --- */
function ConfigToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="shrink-0 cursor-pointer"
      style={{
        width: 42, height: 24, borderRadius: 99, border: 'none', padding: 3,
        background: checked ? 'var(--cms-accent)' : 'var(--cms-surface-3, var(--cms-surface-hover))',
        transition: 'background 0.2s', display: 'flex',
        justifyContent: checked ? 'flex-end' : 'flex-start',
      }}
    >
      <span style={{ width: 18, height: 18, borderRadius: 99, background: '#fff', transition: '0.2s' }} />
    </button>
  )
}

export function StepConfig({ config, onChange }: StepConfigProps) {
  // Better estimate: accounts for confidence level
  const estDays = Math.round(config.duration * (config.confidence >= 95 ? 1 : 0.8))
  const abbaCycles = Math.ceil(config.duration / 2) * 2

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
      {/* Left column -- config rows */}
      <div>
        <CfgRow
          label="Duração máxima"
          hint="Tempo máximo que o teste pode rodar antes de encerrar automaticamente"
        >
          <Slider
            value={config.duration}
            onChange={v => onChange('duration', v)}
            min={7}
            max={28}
            step={1}
            format={v => `${v} dias`}
          />
        </CfgRow>

        <CfgRow
          label="Confiança alvo"
          hint="Nível de certeza Bayesiana exigido para declarar um vencedor"
        >
          <Slider
            value={config.confidence}
            onChange={v => onChange('confidence', v)}
            min={80}
            max={99}
            step={1}
            format={v => `${v}%`}
          />
        </CfgRow>

        <CfgRow
          label="Aplicar vencedor automaticamente"
          hint="Publica a variante vencedora assim que a confiança for atingida"
        >
          <ConfigToggle
            checked={config.autoApply}
            onChange={v => onChange('autoApply', v)}
          />
        </CfgRow>

        <CfgRow
          label="Burn-in"
          hint="Período inicial sem coleta de dados para estabilizar métricas"
        >
          <Slider
            value={config.burnIn}
            onChange={v => onChange('burnIn', v)}
            min={0}
            max={3}
            step={1}
            format={v => v === 0 ? 'Nenhum' : `${v} dias`}
          />
        </CfgRow>

        <CfgRow
          label="Padrão de rotação"
          hint="Estratégia de alternância entre variantes durante o teste"
        >
          <Seg
            options={ROTATION_OPTIONS}
            value={config.rotation}
            onChange={v => onChange('rotation', v)}
            labels={ROTATION_LABELS}
            aria-label="Padrão de rotação"
          />
        </CfgRow>

        <CfgRow
          label="Playoff automático"
          hint="Se nenhuma variante vencer, cria automaticamente um Round 2 com as finalistas"
        >
          <ConfigToggle
            checked={config.playoff}
            onChange={v => onChange('playoff', v)}
          />
        </CfgRow>
      </div>

      {/* Right column -- estimate card */}
      <div className="lg:sticky lg:top-0 self-start">
        <div
          className="border border-cms-border"
          style={{
            padding: 18,
            background: 'var(--cms-bg-side, var(--cms-surface))',
            borderRadius: 14,
          }}
        >
          <SectionLabel as="h4">Estimativa</SectionLabel>

          <p className="text-2xs text-cms-text-dim mb-4" style={{ lineHeight: 1.5 }}>
            Com ~11k impressões/variante e CTR atual de 4,9%:
          </p>

          <dl className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-cms-text-muted">Tempo estimado</dt>
              <dd
                className="font-mono font-bold text-cms-text"
                style={{ fontSize: 22 }}
              >
                ~{estDays} dias
              </dd>
            </div>

            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-cms-text-muted">Ciclos ABBA</dt>
              <dd className="text-xs font-mono font-semibold text-cms-text">
                {abbaCycles}
              </dd>
            </div>

            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-cms-text-muted">Quota</dt>
              <dd className="text-xs font-mono font-semibold text-cms-green">
                1,5%
              </dd>
            </div>
          </dl>

          <p className="text-2xs text-cms-text-dim border-t border-cms-border pt-3 mt-4" style={{ lineHeight: 1.5 }}>
            6 gates precisam passar: confiança, impressões, duração, ciclos, burn-in e estabilidade.
          </p>
        </div>
      </div>
    </div>
  )
}
