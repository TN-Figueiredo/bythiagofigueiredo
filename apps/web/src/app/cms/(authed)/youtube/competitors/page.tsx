import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { carregarMedidasDoSite, type MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { canAdminSiteUsers } from '@/lib/youtube/competitor-admin'
import { DEFAULT_CHANNEL_LIMIT, UNLOCK_STEP } from '@/lib/youtube/competitor-slots'
import { lerRetratosProprios, type RetratosProprios } from '@/lib/youtube/observatorio/retratos-proprios'
import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { ObservatoryChromeServer } from './_chrome/chrome-server'
import { openObservatoryPage } from './_chrome/page-data'
import type { ObsSearchParams } from './_chrome/resolve-niche'
import { CanaisScreen } from './_canais/canais-screen'
import { canalDoPainel, competitorChannelRedirect, legacyTabRedirect } from './_canais/legacy'
import { buildCanaisView } from './_canais/view-model'
import { fmtDaOrdem } from './_canais/formato'
import { buildRiView, riEmErro } from './_canais/ri-model'
import type { RiView } from './_canais/ri-tipos'
import { carregarExtrasProprio } from './_proprio/carregar-extras'
import { addChannelFromCanais, removeCompetitorChannel, syncCompetitorNow, unlockMoreChannels, pinVideo, unpinVideo, getCompetitorRemovalImpactAction } from './actions'
import { setChannelNiche, setOwnChannelNiche } from './niche-actions'
import { askForjaReading } from './forja-actions'

export const metadata = { title: 'Competidores' }
export const dynamic = 'force-dynamic'
/** "Sincronizar concorrentes" (chrome) runs under the page's limit: every Observatório page keeps 60 s. */
export const maxDuration = 60

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** "+25" is for admins only: can_admin_site_users() (super_admin / org_admin) (unlockMoreChannels checks it again). `podeEditar`: quem só lê vê a lista com as ações desligadas. */
async function permissoesDoSite(siteId: string): Promise<{ canUnlock: boolean; podeEditar: boolean }> {
  const res = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!res.ok) return { canUnlock: false, podeEditar: false }
  return { canUnlock: await canAdminSiteUsers(siteId), podeEditar: true }
}

/** Canais (port of canais.html) inside the Observatório chrome. */
export default async function CompetitorsPage({ searchParams }: { searchParams: Promise<ObsSearchParams> }) {
  const sp = await searchParams
  // The channel drawer reuses ?tab=outliers together with ?channel=; only a bare ?tab= is a legacy dashboard link.
  if (!one(sp.channel)) legacyTabRedirect(one(sp.tab))
  const { siteId, now, rows, obs, savedNiche, meuCanalLembrado, extra: permissoes } = await openObservatoryPage(permissoesDoSite)
  // a channel with a page (a competitor, or an own channel with videos) is sent there; an own channel without videos opens the list with no panel.
  competitorChannelRedirect(obs, one(sp.channel))
  // The chrome persists a valid ?niche= and drops an invalid one; here it is only read. parseNiche checks the form;
  // the engine says whether the niche exists (a saved or linked niche that no longer exists opens in Todos, without error).
  const parsed = parseNiche(one(sp.niche))
  const urlNiche = parsed != null && obs.scopeOf(parsed) === parsed ? parsed : null
  const niche = urlNiche ?? obs.scopeOf(savedNiche)
  // as views por dia do canal próprio vêm do diário, só para quem edita o site, DEPOIS da guarda de acesso; sem canal próprio nada é lido
  // A5 E5a T5: M3a e M8 de cada concorrente e os campos do canal, depois da guarda de acesso. O carregador não lança por canal; se lançar por inteiro,
  // a tela abre com "não carregou" em toda célula (nunca com medida inventada) e o erro vai ao Sentry. Independentes: rodam juntos.
  const carregarMedidas = async (): Promise<MedidasDoSite | null> => {
    try {
      return await carregarMedidasDoSite(getSupabaseServiceClient(), { siteId, obs, canais: obs.channels.filter(c => !c.own).map(c => c.id), agoraMs: now })
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'observatorio', step: 'medidas-telas-canais' } })
      return null
    }
  }
  // A5 E5a R9b: retratos públicos diários do canal próprio (MG20), só para Inscritos; dado público, igual para quem só lê. Falha vira 'erro' (pílula do motivo) e um evento.
  const carregarRetratosProprios = async (): Promise<ReadonlyMap<string, RetratosProprios> | 'erro'> => {
    try {
      return await lerRetratosProprios(getSupabaseServiceClient(), obs.ownChannels().map(c => c.id), now)
    } catch (err) {
      Sentry.captureException(err, { fingerprint: ['canais-ri', 'retratos-proprios'], tags: { component: 'observatorio', step: 'canais-ri' } })
      return 'erro'
    }
  }
  const [extras, medidas, retratosProprios] = await Promise.all([carregarExtrasProprio(obs, siteId, now), carregarMedidas(), carregarRetratosProprios()])
  const view = buildCanaisView(obs, {
    medidas,
    niche, nicheExplicit: urlNiche != null, lembrado: meuCanalLembrado, limit: rows.settings?.channel_limit ?? DEFAULT_CHANNEL_LIMIT, unlockStep: UNLOCK_STEP,
    channel: canalDoPainel(obs, one(sp.channel)), tab: one(sp.tab), add: one(sp.add), filter: one(sp.filter), direcao: one(sp.direcao), scale: one(sp.scale), fmt: one(sp.fmt),
    layout: one(sp.layout), sort: one(sp.sort), dir: one(sp.dir), nicheEditor: one(sp.nicheEditor),
  }, extras)
  // a coleta de retratos parou em todos os canais: um evento por abertura (o aviso da tela é a frase)
  if (view.resumo.semRetrato) {
    Sentry.captureMessage('observatório: nenhum canal tem registro recente (lista de Canais)', {
      level: 'warning', fingerprint: ['canais-sem-retrato'], tags: { component: 'observatorio', step: 'medidas-telas-canais' }, extra: { desde: view.resumo.semRetrato.desde },
    })
  }
  // A5 E5a R5: Referências e Inscritos. O modelo é puro e não importa Sentry; cada seção que lança volta em `falhas` e o erro vai ao Sentry daqui.
  // Se o modelo lançar por inteiro, as duas seções abrem em erro (frases do próprio modelo) e a lista de canais segue.
  let ri: RiView
  try {
    const r = buildRiView(obs, { agoraMs: now, niche, fmt: fmtDaOrdem(view.fmt), ordr: one(sp.ordr), ordi: one(sp.ordi), aba: one(sp.aba), meuCanalLembrado, retratosProprios })
    ri = r.view
    for (const f of r.falhas) Sentry.captureException(f.erro, { fingerprint: ['canais-ri', f.secao], tags: { component: 'observatorio', step: 'canais-ri' } })
  } catch (err) {
    Sentry.captureException(err, { fingerprint: ['canais-ri', 'tudo'], tags: { component: 'observatorio', step: 'canais-ri' } })
    ri = riEmErro(obs)
  }
  return (
    <ObservatoryChromeServer tab="canais" searchParams={sp} obs={obs} forja={view.forja} meuCanalLembrado={meuCanalLembrado}>
      <CanaisScreen
        view={view} ri={ri} canUnlock={permissoes.canUnlock} somenteLeitura={!permissoes.podeEditar}
        onAdd={addChannelFromCanais} onRemove={removeCompetitorChannel} onUnlock={unlockMoreChannels}
        onSetNiche={setChannelNiche} onSetOwnNiche={setOwnChannelNiche} onSyncOne={syncCompetitorNow} onAskForja={askForjaReading}
        onPin={pinVideo} onUnpin={unpinVideo} onRemovalImpact={getCompetitorRemovalImpactAction}
      />
    </ObservatoryChromeServer>
  )
}
