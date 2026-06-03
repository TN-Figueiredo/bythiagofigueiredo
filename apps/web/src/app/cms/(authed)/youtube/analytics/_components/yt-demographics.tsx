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
      {demographics.ageGender.length > 0 && (
        <div className="card">
          <div className="card-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="card-title">Faixa etaria</span>
          </div>
          <div className="card-pad">
            <BarList items={ageItems} keyf={(item) => item.label} valf={(item) => item.value} color="var(--blue)" fmtVal={(v) => `${v}%`} />
          </div>
        </div>
      )}

      {demographics.ageGender.length > 0 && (
        <div className="card">
          <div className="card-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span className="card-title">Genero</span>
          </div>
          <div className="card-pad">
            <div className="gender-bar">
              <span
                style={{ width: `${malePct}%`, background: 'var(--blue)' }}
                role="progressbar"
                aria-valuenow={Math.round(malePct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Masculino: ${Math.round(malePct)}%`}
              />
              <span
                style={{ width: `${femalePct}%`, background: 'var(--accent)' }}
                role="progressbar"
                aria-valuenow={Math.round(femalePct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Feminino: ${Math.round(femalePct)}%`}
              />
            </div>
            <div className="flex items-center gap-4" style={{ marginTop: 12 }}>
              <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--blue)' }} />
                Masc {Math.round(malePct)}%
              </span>
              <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'var(--accent)' }} />
                Fem {Math.round(femalePct)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {demographics.countries.length > 0 && (
        <div className="card">
          <div className="card-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            <span className="card-title">Paises</span>
          </div>
          <div className="card-pad">
            <BarList items={demographics.countries} keyf={(c) => c.country} valf={(c) => c.percentage} color="var(--green)" fmtVal={(v) => `${v}%`} />
          </div>
        </div>
      )}

      {demographics.devices.length > 0 && (
        <div className="card">
          <div className="card-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
            <span className="card-title">Dispositivos</span>
          </div>
          <div className="card-pad">
            <BarList items={demographics.devices} keyf={(d) => d.deviceType} valf={(d) => d.percentage} color="var(--purple)" fmtVal={(v) => `${v}%`} />
          </div>
        </div>
      )}
    </div>
  )
}
