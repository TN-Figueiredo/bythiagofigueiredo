import type { YtSearchTerm } from '@/lib/youtube/analytics-types'

interface Props {
  terms: YtSearchTerm[]
  apiError?: string
}

export function YtSearchTermsView({ terms, apiError }: Props) {
  if (terms.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-cms-border p-8 text-center">
        {apiError === 'scope' ? (
          <>
            <p className="text-sm text-cms-text-muted">
              Permissão insuficiente para acessar termos de busca.
            </p>
            <p className="mt-2 max-w-md mx-auto text-xs text-cms-text-dim">
              O token OAuth do YouTube não tem o escopo <code className="bg-cms-border px-1 rounded">yt-analytics.readonly</code>. Reconecte o canal em Conexões para solicitar a permissão necessária.
            </p>
          </>
        ) : apiError ? (
          <>
            <p className="text-sm text-cms-text-muted">
              Erro ao carregar termos de busca da API do YouTube.
            </p>
            <p className="mt-2 max-w-md mx-auto text-xs text-cms-text-dim">
              A API retornou um erro temporário. Tente novamente em alguns minutos.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-cms-text-muted">
              Termos de busca não disponíveis para este canal.
            </p>
            <p className="mt-2 max-w-md mx-auto text-xs text-cms-text-dim">
              O YouTube só libera dados de termos de busca quando o canal recebe um volume mínimo de tráfego de pesquisa no período. Canais menores ou com pouco tráfego orgânico podem não ter dados suficientes.
            </p>
          </>
        )}
      </div>
    )
  }

  const totalViews = terms.reduce((s, t) => s + t.views, 0)
  const totalWatchTime = terms.reduce((s, t) => s + t.estimatedMinutesWatched, 0)
  const uniqueTerms = terms.length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-cms-border bg-cms-surface p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">
            Views de Busca
          </p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-cms-text">
            {totalViews.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-cms-border bg-cms-surface p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">
            Termos Únicos
          </p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-cms-text">{uniqueTerms}</p>
        </div>
        <div className="rounded-lg border border-cms-border bg-cms-surface p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-cms-text-muted">
            Tempo Assistido
          </p>
          <p className="mt-0.5 text-sm font-bold tabular-nums text-cms-text">
            {Math.round(totalWatchTime).toLocaleString()}min
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-cms-text">Principais Termos de Busca</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-cms-border text-left text-cms-text-muted">
                <th scope="col" className="pb-2 font-medium">
                  #
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Termo
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Views
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Tempo
                </th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t, i) => (
                <tr key={t.term} className="border-b border-cms-border/50 hover:bg-cms-bg/40">
                  <td className="py-2 text-cms-text-muted">{i + 1}</td>
                  <td className="py-2 font-medium text-cms-text">{t.term}</td>
                  <td className="py-2 text-right tabular-nums text-cms-text">
                    {t.views.toLocaleString()}
                  </td>
                  <td className="py-2 text-right tabular-nums text-cms-text-muted">
                    {Math.round(t.estimatedMinutesWatched)}min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
