/**
 * /cms/youtube/competitors/outliers — the Outliers screen inside the Observatório chrome. One engine for the
 * chrome and the screen; the URL carries the screen state (age=, fmt, min, topic, formula, channel, reading,
 * asof, sort, view) and the niche is the persisted one unless ?niche= says otherwise.
 */
import { ObservatoryChromeServer } from '../_chrome/chrome-server'
import { gerarPacoteIa } from '../contexto-ia-actions'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import type { ObsSearchParams } from '../_chrome/resolve-niche'
import { OutliersScreen } from '../_outliers/outliers-screen'
import { montarOutliers } from '../_outliers/montar'
import '../_outliers/outliers.css'

export const metadata = { title: 'Outliers dos competidores' }
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export default async function OutliersPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  const params: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp)) params[k] = first(v)
  const { pagina: { obs, meuCanalLembrado }, view, niche } = await montarOutliers(params)
  return (
    <ObservatoryChromeServer tab="outliers" searchParams={sp} obs={obs} nicheOverride={view.query.niche !== niche ? view.query.niche : undefined} forja={view.forja} meuCanalLembrado={meuCanalLembrado}
      perguntarIa={{ tela: 'outliers', nomeDaTela: TELAS_IA['outliers'].nome, exemplos: TELAS_IA['outliers'].exemplos, onGerar: gerarPacoteIa }}>
      <OutliersScreen view={view} />
    </ObservatoryChromeServer>
  )
}
