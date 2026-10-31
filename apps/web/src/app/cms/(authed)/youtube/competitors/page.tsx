import { ObservatoryChromeServer } from './_chrome/chrome-server'
import { marcarRodado, desfazerRodado } from './_arquivo/actions-canal'
import { gerarPacoteIa } from './contexto-ia-actions'
import { TELAS_IA } from '@/lib/youtube/observatorio/contexto-ia/telas'
import type { ObsSearchParams } from './_chrome/resolve-niche'
import { CanaisScreen } from './_canais/canais-screen'
import { competitorChannelRedirect, legacyAbaRedirect, legacyTabRedirect } from './_canais/legacy'
import { montarCanais } from './_canais/montar'
import { addChannelFromCanais, pedirRemocaoCanal, apagarCanalSemGuardarAction, desfazerRemocaoCanal, syncCompetitorNow, unlockMoreChannels, pinVideo, unpinVideo, getCompetitorRemovalImpactAction } from './actions'
import { setChannelNiche, setOwnChannelNiche } from './niche-actions'
import { askForjaReading } from './forja-actions'
import { meuEmailDoSite } from './_canais/meu-email'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import { lerPendenciasDaFila } from './_canais/pendencias-da-fila'
import { forjaResponde } from './_canais/forja-responde'

export const metadata = { title: 'Competidores' }
export const dynamic = 'force-dynamic'
/** "Sincronizar concorrentes" (chrome) runs under the page's limit: every Observatório page keeps 60 s. */
export const maxDuration = 60

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** Canais (port of canais.html) inside the Observatório chrome. */
export default async function CompetitorsPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  legacyAbaRedirect(sp.aba)
  // The channel drawer reuses ?tab=outliers together with ?channel=; only a bare ?tab= is a legacy dashboard link.
  if (!one(sp.channel)) legacyTabRedirect(one(sp.tab))
  const flat: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(sp ?? {})) flat[k] = one(v)
  // a channel with a page (a competitor, or an own channel with videos) is sent there; an own channel without videos opens the list with no panel.
  // O redirecionamento roda logo depois de abrir o conjunto e antes de qualquer leitura privada (montarCanais, aoAbrir).
  // O e-mail da sessão (só para admin) é lido em paralelo com a montagem; o redirecionamento de `aoAbrir` continua antes de qualquer leitura privada.
  const meuEmailP = meuEmailDoSite()
  const [{ pagina: { siteId, now, obs, meuCanalLembrado, extra: permissoes }, view, ri }, meuEmail] = await Promise.all([
    montarCanais(flat, { aoAbrir: o => competitorChannelRedirect(o, flat.channel) }), meuEmailP,
  ])
  // Peça 7 (M5 T10): lida só com o filtro "Saíram do YouTube" aberto e só depois da guarda de edição (dentro de lerPendenciasDaFila); sem edição, nem o cliente de serviço é criado.
  // Os nomes saem de mapas montados uma vez (canal pelo id, vídeo pelo id do YouTube): nada de `find` por item.
  const pendencias = view.filter === 'sairam'
    ? await lerPendenciasDaFila(siteId, permissoes, new Date(now), { canais: new Map(obs.channels.map(c => [c.id, c.name])), videos: new Map(obs.videos.map(v => [v.ytId, v.title])) },
      { forjaResponde: permissoes.podeEditar && process.env.OBS_ARQUIVO === 'on' ? await forjaResponde(siteId, now) : false })
    : null
  return (
    <ObservatoryChromeServer tab="canais" searchParams={sp} obs={obs} forja={view.forja} meuCanalLembrado={meuCanalLembrado}
      perguntarIa={{ tela: 'canais', nomeDaTela: TELAS_IA['canais'].nome, exemplos: TELAS_IA['canais'].exemplos, onGerar: gerarPacoteIa }}>
      <CanaisScreen
        view={view} ri={ri} meuEmail={meuEmail} canUnlock={permissoes.canUnlock} somenteLeitura={!permissoes.podeEditar} pendencias={pendencias} onMarcarRodado={marcarRodado} onDesfazerRodado={desfazerRodado} hojeSP={dayPt(new Date(now))} podeAdministrar={permissoes.canUnlock}
        onAdd={addChannelFromCanais} onPedir={pedirRemocaoCanal} onApagar={apagarCanalSemGuardarAction} onDesfazer={desfazerRemocaoCanal} onUnlock={unlockMoreChannels}
        onSetNiche={setChannelNiche} onSetOwnNiche={setOwnChannelNiche} onSyncOne={syncCompetitorNow} onAskForja={askForjaReading}
        onPin={pinVideo} onUnpin={unpinVideo} onRemovalImpact={getCompetitorRemovalImpactAction}
      />
    </ObservatoryChromeServer>
  )
}
