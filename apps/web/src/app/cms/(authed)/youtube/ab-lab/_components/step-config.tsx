'use client'

import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { tetoMinimo, tetoPadrao } from '@/lib/youtube/ab-gravacao/decisao-v2'
import { CfgRow, Slider, Seg, SectionLabel } from './ab-primitives'

interface StepConfigProps {
  config: WizardConfig
  /** Variantes do teste (com a original); o passo 2 já as conhece. */
  variantCount?: number
  onChange: <K extends keyof WizardConfig>(key: K, value: WizardConfig[K]) => void
}

const ROTATION_OPTIONS = ['abba'] as const
const ROTATION_LABELS: Record<(typeof ROTATION_OPTIONS)[number], string> = {
  abba: 'ABBA',
}

export function StepConfig({ config, variantCount = 2, onChange }: StepConfigProps) {
  // O teste só encerra na duração máxima (a avaliação automática foi retirada)
  const minimo = tetoMinimo(variantCount)
  const padrao = tetoPadrao(variantCount)
  const duracao = config.durationTouched ? config.duration : padrao
  const estDays = duracao
  const abbaCycles = Math.ceil(duracao / 2) * 2

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
      {/* Left column -- config rows */}
      <div>
        <CfgRow
          label="Duração máxima"
          hint={`Padrão ${padrao} dias, mínimo ${minimo} dias com ${variantCount} variantes (o YouTube leva dias para enviar o alcance)`}
        >
          <Slider
            value={duracao}
            onChange={v => onChange('duration', v)}
            min={minimo}
            max={28}
            step={1}
            format={v => `${v} dias`}
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
          hint="A regra nova usa só a rotação ABBA"
        >
          <Seg
            options={ROTATION_OPTIONS}
            value="abba"
            onChange={v => onChange('rotation', v)}
            labels={ROTATION_LABELS}
            aria-label="Padrão de rotação"
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
            Estimativa baseada na configuração:
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

          </dl>

          <p className="text-2xs text-cms-text-dim border-t border-cms-border pt-3 mt-4" style={{ lineHeight: 1.5 }}>
            O teste roda até a duração máxima; quem escolhe o vencedor é você.
          </p>
        </div>
      </div>
    </div>
  )
}
