import type { YtDemographics } from '@/lib/youtube/analytics-types'

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
              Permissão insuficiente para acessar dados demográficos.
            </p>
            <p className="mt-2 max-w-md mx-auto text-xs text-cms-text-dim">
              O token OAuth do YouTube não tem o escopo <code className="bg-cms-border px-1 rounded">yt-analytics.readonly</code>. Reconecte o canal em Conexões para solicitar a permissão necessária.
            </p>
          </>
        ) : apiError ? (
          <>
            <p className="text-sm text-cms-text-muted">
              Erro ao carregar dados demográficos da API do YouTube.
            </p>
            <p className="mt-2 max-w-md mx-auto text-xs text-cms-text-dim">
              A API retornou um erro temporário. Tente novamente em alguns minutos.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-cms-text-muted">
              Dados demográficos não disponíveis para este canal.
            </p>
            <p className="mt-2 max-w-md mx-auto text-xs text-cms-text-dim">
              O YouTube só libera dados demográficos quando o canal atinge um volume mínimo de visualizações no período. Canais menores podem não ter dados suficientes para o YouTube gerar relatórios de idade, gênero e localização.
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {demographics.ageGender.length > 0 && (
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">Idade e Gênero</h3>
          <div className="space-y-2">
            {demographics.ageGender.map((ag) => (
              <div key={ag.ageGroup} className="flex items-center gap-2 text-xs" role="group" aria-label={`${ag.ageGroup}: ${Math.round(ag.male)}% masculino, ${Math.round(ag.female)}% feminino`}>
                <span className="w-14 text-cms-text-muted">{ag.ageGroup}</span>
                <div className="flex flex-1 gap-0.5" role="presentation">
                  <div
                    className="h-4 rounded-l bg-blue-400/80"
                    style={{ width: `${ag.male}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(ag.male)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Masculino: ${Math.round(ag.male)}%`}
                  />
                  <div
                    className="h-4 rounded-r bg-pink-400/80"
                    style={{ width: `${ag.female}%` }}
                    role="progressbar"
                    aria-valuenow={Math.round(ag.female)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Feminino: ${Math.round(ag.female)}%`}
                  />
                </div>
                <span className="w-10 text-right tabular-nums text-cms-text-muted">
                  {Math.round(ag.male + ag.female)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {demographics.countries.length > 0 && (
          <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
            <h3 className="mb-3 text-sm font-semibold text-cms-text">Principais Países</h3>
            <div className="space-y-2">
              {demographics.countries.map((c) => (
                <div key={c.country} className="flex items-center justify-between text-xs">
                  <span className="text-cms-text">{c.country}</span>
                  <span className="tabular-nums text-cms-text-muted">{c.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {demographics.devices.length > 0 && (
          <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
            <h3 className="mb-3 text-sm font-semibold text-cms-text">Tipos de Dispositivo</h3>
            <div className="space-y-2">
              {demographics.devices.map((d) => (
                <div key={d.deviceType} className="flex items-center justify-between text-xs">
                  <span className="text-cms-text capitalize">{d.deviceType}</span>
                  <span className="tabular-nums text-cms-text-muted">{d.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
