import { ObservatoryChromeServer } from './_chrome/chrome-server'
import { gerarPacoteIa } from './contexto-ia-actions'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import type { ObsSearchParams } from './_chrome/resolve-niche'
import { CanaisScreen } from './_canais/canais-screen'
import { competitorChannelRedirect, legacyTabRedirect } from './_canais/legacy'
import { montarCanais } from './_canais/montar'
import { addChannelFromCanais, pedirRemocaoCanal, apagarCanalSemGuardarAction, desfazerRemocaoCanal, syncCompetitorNow, unlockMoreChannels, pinVideo, unpinVideo, getCompetitorRemovalImpactAction } from './actions'
import { setChannelNiche, setOwnChannelNiche } from './niche-actions'
import { askForjaReading } from './forja-actions'

export const metadata = { title: 'Competidores' }
export const dynamic = 'force-dynamic'
/** "Sincronizar concorrentes" (chrome) runs under the page's limit: every Observatório page keeps 60 s. */
export const maxDuration = 60

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** Canais (port of canais.html) inside the Observatório chrome. */
export default async function CompetitorsPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  // The channel drawer reuses ?tab=outliers together with ?channel=; only a bare ?tab= is a legacy dashboard link.
  if (!one(sp.channel)) legacyTabRedirect(one(sp.tab))
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = one(v)
  // a channel with a page (a competitor, or an own channel with videos) is sent there; an own channel without videos opens the list with no panel.
  // O redirecionamento roda logo depois de abrir o conjunto e antes de qualquer leitura privada (montarCanais, aoAbrir).
  const { pagina: { obs, meuCanalLembrado, extra: permissoes }, view, ri } = await montarCanais(flat, { aoAbrir: o => competitorChannelRedirect(o, flat.channel) })
  return (
    <ObservatoryChromeServer tab="canais" searchParams={sp} obs={obs} forja={view.forja} meuCanalLembrado={meuCanalLembrado}
      perguntarIa={{ tela: 'canais', nomeDaTela: TELAS_IA['canais'].nome, exemplos: TELAS_IA['canais'].exemplos, onGerar: gerarPacoteIa }}>
      <CanaisScreen
        view={view} ri={ri} canUnlock={permissoes.canUnlock} somenteLeitura={!permissoes.podeEditar}
        onAdd={addChannelFromCanais} onPedir={pedirRemocaoCanal} onApagar={apagarCanalSemGuardarAction} onDesfazer={desfazerRemocaoCanal} onUnlock={unlockMoreChannels}
        onSetNiche={setChannelNiche} onSetOwnNiche={setOwnChannelNiche} onSyncOne={syncCompetitorNow} onAskForja={askForjaReading}
        onPin={pinVideo} onUnpin={unpinVideo} onRemovalImpact={getCompetitorRemovalImpactAction}
      />
    </ObservatoryChromeServer>
  )
}
