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
  if (demographics.ageGender.length === 0 && demographics.countries.length === 0 && demographics.devices.length === 0 && apiError) {
    return (
      <div className="rounded-lg border border-dashed border-cms-border p-8 text-center">
        {apiError === 'scope' ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Permissao insuficiente para acessar dados demograficos.
            </p>
            <p className="dim" style={{ fontSize: 12, marginTop: 8, maxWidth: 400, marginInline: 'auto' }}>
              O token OAuth do YouTube nao tem o escopo <code style={{ padding: '1px 5px', borderRadius: 4, background: 'var(--surface-3)' }}>yt-analytics.readonly</code>.
              Reconecte o canal em Conexoes para solicitar a permissao necessaria.
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Erro ao carregar dados demograficos da API do YouTube.
            </p>
            <p className="dim" style={{ fontSize: 12, marginTop: 8 }}>
              A API retornou um erro temporario. Tente novamente em alguns minutos.
            </p>
          </>
        )}
      </div>
    )
  }

  const data = demographics

  const ageItems = data.ageGender.map((ag) => ({
    label: ag.ageGroup,
    value: Math.round(ag.male + ag.female),
  }))

  const totalMale = data.ageGender.reduce((s, ag) => s + ag.male, 0)
  const totalFemale = data.ageGender.reduce((s, ag) => s + ag.female, 0)
  const totalGender = totalMale + totalFemale
  const malePct = totalGender > 0 ? Math.round((totalMale / totalGender) * 100) : 50
  const femalePct = totalGender > 0 ? Math.round((totalFemale / totalGender) * 100) : 50
  const outroPct = Math.max(0, 100 - malePct - femalePct)

  const emptyPad = <div className="card-pad"><p className="dim" style={{ fontSize: 12, padding: '8px 0' }}>Aguardando dados</p></div>

  return (
    <div className="fade-in insights-grid stagger">
      <div className="card">
        <div className="card-head">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span className="card-title">Faixa etaria</span>
        </div>
        {ageItems.length > 0 ? (
          <div className="card-pad">
            <BarList items={ageItems} keyf={(item) => item.label} valf={(item) => item.value} color="var(--blue)" fmtVal={(v) => `${v}%`} />
          </div>
        ) : emptyPad}
      </div>

      <div className="card">
        <div className="card-head">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span className="card-title">Genero</span>
        </div>
        {totalGender > 0 ? (
          <div className="card-pad">
            <div className="gender-bar">
              <span style={{ width: `${malePct}%`, background: 'var(--blue)' }} role="progressbar" aria-valuenow={malePct} aria-valuemin={0} aria-valuemax={100} aria-label={`Masculino: ${malePct}%`} />
              <span style={{ width: `${femalePct}%`, background: 'var(--accent)' }} role="progressbar" aria-valuenow={femalePct} aria-valuemin={0} aria-valuemax={100} aria-label={`Feminino: ${femalePct}%`} />
              {outroPct > 0 && <span style={{ width: `${outroPct}%`, background: 'var(--text-dim)' }} />}
            </div>
            <div className="flex items-center" style={{ gap: 18, marginTop: 12 }}>
              <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}><span className="legend-dot" style={{ background: 'var(--blue)' }} />Masc {malePct}%</span>
              <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}><span className="legend-dot" style={{ background: 'var(--accent)' }} />Fem {femalePct}%</span>
              {outroPct > 0 && <span className="flex items-center gap-1.5" style={{ fontSize: 12 }}><span className="legend-dot" style={{ background: 'var(--text-dim)' }} />Outro {outroPct}%</span>}
            </div>
          </div>
        ) : emptyPad}
      </div>

      <div className="card">
        <div className="card-head">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          <span className="card-title">Paises</span>
        </div>
        {data.countries.length > 0 ? (
          <div className="card-pad">
            <BarList items={data.countries} keyf={(c) => c.country} valf={(c) => c.percentage} color="var(--green)" fmtVal={(v) => `${v}%`} />
          </div>
        ) : emptyPad}
      </div>

      <div className="card">
        <div className="card-head">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
          <span className="card-title">Dispositivos</span>
        </div>
        {data.devices.length > 0 ? (
          <div className="card-pad">
            <BarList items={data.devices} keyf={(d) => d.deviceType} valf={(d) => d.percentage} color="var(--purple)" fmtVal={(v) => `${v}%`} />
          </div>
        ) : emptyPad}
      </div>
    </div>
  )
}
