'use client'

import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { CfgRow, Slider, Toggle, Seg, SectionLabel } from './ab-primitives'

interface StepConfigProps {
  config: WizardConfig
  onChange: <K extends keyof WizardConfig>(key: K, value: WizardConfig[K]) => void
}

const ROTATION_OPTIONS = ['abba', 'round_robin', 'random'] as const
const ROTATION_LABELS: Record<(typeof ROTATION_OPTIONS)[number], string> = {
  abba: 'ABBA',
  round_robin: 'Sequential',
  random: 'Random',
}

export function StepConfig({ config, onChange }: StepConfigProps) {
  // Heuristic estimates
  const estimatedDays = Math.ceil(config.duration * 0.7)
  const abbaCycles = Math.ceil(config.duration / 2) * 2
  // variants = 4 (A + B + C + D)
  const variants = 4
  const quotaPerDay = `~${Math.ceil(variants * 2)}`

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      {/* Left column — controls */}
      <div className="space-y-1 divide-y divide-cms-border">
        <SectionLabel>Configuração do teste</SectionLabel>

        <CfgRow label="Duração" hint="Tempo máximo para o teste rodar">
          <Slider
            value={config.duration}
            onChange={v => onChange('duration', v)}
            min={7}
            max={28}
            step={1}
            format={v => `${v} days`}
          />
        </CfgRow>

        <CfgRow label="Confiança mínima" hint="% de certeza estatística exigida para declarar vencedor">
          <Slider
            value={config.confidence}
            onChange={v => onChange('confidence', v)}
            min={80}
            max={99}
            step={1}
            format={v => `${v}%`}
          />
        </CfgRow>

        <CfgRow label="Aplicar vencedor automaticamente" hint="Publica a variante vencedora ao atingir confiança">
          <Toggle
            checked={config.autoApply}
            onChange={v => onChange('autoApply', v)}
          />
        </CfgRow>

        <CfgRow label="Burn-in" hint="Aguarda esse período antes de coletar dados">
          <Slider
            value={config.burnIn}
            onChange={v => onChange('burnIn', v)}
            min={0}
            max={3}
            step={1}
            format={v => v === 0 ? 'None' : `${v} days`}
          />
        </CfgRow>

        <CfgRow label="Padrão de rotação" hint="Como as variantes se revezam durante o teste">
          <Seg
            options={ROTATION_OPTIONS}
            value={config.rotation}
            onChange={v => onChange('rotation', v)}
            labels={ROTATION_LABELS}
            aria-label="Rotation pattern"
          />
        </CfgRow>

        <CfgRow label="Modo playoff" hint="Elimina variantes progressivamente até sobrar uma vencedora">
          <Toggle
            checked={config.playoff}
            onChange={v => onChange('playoff', v)}
          />
        </CfgRow>
      </div>

      {/* Right column — estimate card */}
      <div className="lg:sticky lg:top-4 self-start">
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-4">
          <SectionLabel as="h4">Estimativas</SectionLabel>

          <dl className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-cms-text-muted">Tempo estimado</dt>
              <dd className="text-xs font-mono font-semibold text-cms-text">
                {estimatedDays} days
              </dd>
            </div>

            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-cms-text-muted">Ciclos ABBA</dt>
              <dd className="text-xs font-mono font-semibold text-cms-text">
                {abbaCycles} pairs
              </dd>
            </div>

            <div className="flex items-center justify-between gap-2">
              <dt className="text-xs text-cms-text-muted">YouTube quota</dt>
              <dd className="text-xs font-mono font-semibold text-cms-text">
                {quotaPerDay} calls/day
              </dd>
            </div>
          </dl>

          <p className="text-2xs text-cms-text-dim border-t border-cms-border pt-3">
            Estimativas aproximadas. O teste encerra assim que a confiança for atingida ou o prazo expirar.
          </p>
        </div>
      </div>
    </div>
  )
}
