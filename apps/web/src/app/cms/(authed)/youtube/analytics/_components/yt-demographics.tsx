/**
 * YtDemographicsView — refactored per spec 4.3.6.
 *
 * .insights-grid.stagger (2->1 col).
 * 4 cards: Faixa etaria (BarList), Genero (segmented bar), Paises (BarList), Dispositivos (BarList).
 */

import type { YtDemographics } from '@/lib/youtube/analytics-types'
import { BarList } from '../../_components/bar-list'

interface Props {
  demographics: YtDemographics
  apiError?: string
}

export function YtDemographicsView({ demographics, apiError }: Props) {
  if (demographics.ageGender.length === 0 && demographics.countries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-cms-border p-8 text-center">
        {apiError === 'scope' ? (
          <>
            <p className="text-sm text-cms-text-muted">
              Permissao insuficiente para acessar dados demograficos.
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-cms-text-dim">
              O token OAuth do YouTube nao tem o escopo{' '}
              <code className="rounded bg-cms-border px-1">yt-analytics.readonly</code>.
              Reconecte o canal em Conexoes para solicitar a permissao necessaria.
            </p>
          </>
        ) : apiError ? (
          <>
            <p className="text-sm text-cms-text-muted">
              Erro ao carregar dados demograficos da API do YouTube.
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-cms-text-dim">
              A API retornou um erro temporario. Tente novamente em alguns minutos.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-cms-text-muted">
              Dados demograficos nao disponiveis para este canal.
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-cms-text-dim">
              O YouTube so libera dados demograficos quando o canal atinge um volume minimo
              de visualizacoes no periodo.
            </p>
          </>
        )}
      </div>
    )
  }

  // Compute age group totals for BarList
  const ageItems = demographics.ageGender.map((ag) => ({
    label: ag.ageGroup,
    value: Math.round(ag.male + ag.female),
  }))

  // Gender totals for segmented bar
  const totalMale = demographics.ageGender.reduce((s, ag) => s + ag.male, 0)
  const totalFemale = demographics.ageGender.reduce((s, ag) => s + ag.female, 0)
  const totalGender = totalMale + totalFemale
  const malePct = totalGender > 0 ? (totalMale / totalGender) * 100 : 50
  const femalePct = totalGender > 0 ? (totalFemale / totalGender) * 100 : 50

  return (
    <div className="fade-in insights-grid stagger">
      {/* Card 1: Faixa etaria */}
      {demographics.ageGender.length > 0 && (
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">Faixa etaria</h3>
          <BarList
            items={ageItems}
            keyf={(item) => item.label}
            valf={(item) => item.value}
            color="var(--blue)"
            fmtVal={(v) => `${v}%`}
          />
        </div>
      )}

      {/* Card 2: Genero */}
      {demographics.ageGender.length > 0 && (
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">Genero</h3>
          <div className="flex flex-col gap-3">
            {/* Segmented bar — 14px height per handoff */}
            <div className="gender-bar">
              <span
                className="flex items-center justify-center text-[10px] font-medium text-white"
                style={{ width: `${malePct}%`, background: 'var(--blue)' }}
                role="progressbar"
                aria-valuenow={Math.round(malePct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Masculino: ${Math.round(malePct)}%`}
              >
                {Math.round(malePct)}%
              </span>
              <span
                className="flex items-center justify-center text-[10px] font-medium text-white"
                style={{ width: `${femalePct}%`, background: '#F472B6' }}
                role="progressbar"
                aria-valuenow={Math.round(femalePct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Feminino: ${Math.round(femalePct)}%`}
              >
                {Math.round(femalePct)}%
              </span>
            </div>
            {/* Legend */}
            <div className="flex gap-4 text-xs text-cms-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--blue)' }} />
                Masculino
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#F472B6' }} />
                Feminino
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Card 3: Paises */}
      {demographics.countries.length > 0 && (
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">Paises</h3>
          <BarList
            items={demographics.countries}
            keyf={(c) => c.country}
            valf={(c) => c.percentage}
            color="var(--accent)"
            fmtVal={(v) => `${v}%`}
          />
        </div>
      )}

      {/* Card 4: Dispositivos */}
      {demographics.devices.length > 0 && (
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">Dispositivos</h3>
          <BarList
            items={demographics.devices}
            keyf={(d) => d.deviceType}
            valf={(d) => d.percentage}
            color="var(--purple)"
            fmtVal={(v) => `${v}%`}
          />
        </div>
      )}
    </div>
  )
}
