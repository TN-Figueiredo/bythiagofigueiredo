import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { carregarMedidasDoSite, type MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { DEFAULT_CHANNEL_LIMIT, UNLOCK_STEP } from '@/lib/youtube/competitor-slots'
import type { RetratosProprios } from '@/lib/youtube/observatorio/retratos-proprios'
import { parseNiche } from '@/lib/youtube/observatorio/niche'
import type { EstadoDoPrivado } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { permissoesDoSite, type PermissoesDoSite } from '../_chrome/permissoes'
import { openObservatoryPage, type ObservatoryPage } from '../_chrome/page-data'
import { carregarExtrasProprio } from '../_proprio/carregar-extras'
import type { ExtrasProprio } from '../_proprio/extras'
import { canalDoPainel } from './legacy'
import { buildCanaisView } from './view-model'
import { fmtDaOrdem } from './formato'
import { buildRiView, riEmErro } from './ri-model'
import type { RiView } from './ri-tipos'

type Obs = ObservatoryPage<unknown>['obs']
export type { PermissoesDoSite } from '../_chrome/permissoes'

/**
 * O acesso ao diário que a lista leu, por canal próprio, como o pacote o entende (E17 degrau 1, Tarefa 8a, emenda 1: D-I1). A lista só lê o diário
 * (views por dia): o motivo do `VpdCanal` diz se a leitura foi negada ou falhou. `negativa` vem da guarda que leu o diário (`extras.negativa`, decisão 75): o empacotador lê nulo como
 * "não conferido", nunca como "sem o direito". Sem canal próprio no site: vazio (vira `na`, não `excluido`).
 */
export function privadoDaLista(extras: ExtrasProprio | undefined): EstadoDoPrivado {
  const acessoPorCanal: EstadoDoPrivado['acessoPorCanal'] = {}
  for (const [id, v] of extras?.vpd ?? []) acessoPorCanal[id] = { diario: v.motivo === 'sem-acesso' ? 'negado' : v.motivo === 'leitura-falhou' ? 'erro' : 'ok' }
  return { acessoPorCanal, negativa: extras?.negativa ?? null }
}

const one = (v: string | undefined): string | undefined => v

/**
 * Do conjunto aberto ao modelo de Canais: a MESMA função monta a tela (a página) e o pacote "Perguntar a uma IA" (E17 degrau 1, Tarefas 6b e 8a).
 * `sp` são os parâmetros planos da URL (primeira ocorrência de cada chave). O `siteId` não é parâmetro: vem da guarda.
 * `aoAbrir` roda logo depois de abrir o conjunto e ANTES de qualquer leitura privada: é onde a página redireciona o link de canal que tem página
 * (nenhuma leitura privada antes de um redirecionamento). A ação não passa nada.
 */
export async function montarCanais(sp: Record<string, string | undefined>, opcoes?: { aoAbrir?: (obs: Obs) => void }): Promise<{
  pagina: ObservatoryPage<PermissoesDoSite>; view: ReturnType<typeof buildCanaisView>; ri: RiView; recente: string | null
  estado: Record<string, string | undefined>; privado: EstadoDoPrivado
}> {
  const pagina = await openObservatoryPage(permissoesDoSite)
  const { siteId, now, rows, obs, savedNiche, meuCanalLembrado } = pagina
  opcoes?.aoAbrir?.(obs)
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
  // A5 E5a R9b: os retratos públicos diários do canal próprio (MG20) vêm do motor (`rows.ownSnapshots`, lidos uma vez em load.ts): lista, cabeçalho, Comparar e Cowork leem a mesma fonte. Falha = 'erro' (pílula do motivo; o evento vai ao Sentry no carregador).
  const retratosProprios: ReadonlyMap<string, RetratosProprios> | 'erro' = rows.ownSnapshots === 'erro' ? 'erro' : new Map(Object.entries(rows.ownSnapshots ?? {}))
  const [extras, medidas] = await Promise.all([carregarExtrasProprio(obs, siteId, now), carregarMedidas()])
  const view = buildCanaisView(obs, {
    medidas,
    niche, nicheExplicit: urlNiche != null, lembrado: meuCanalLembrado, limit: rows.settings?.channel_limit ?? DEFAULT_CHANNEL_LIMIT, unlockStep: UNLOCK_STEP,
    channel: canalDoPainel(obs, one(sp.channel)), tab: one(sp.tab), add: one(sp.add), filter: one(sp.filter), direcao: one(sp.direcao), scale: one(sp.scale), fmt: one(sp.fmt),
    layout: one(sp.layout), sort: one(sp.sort), dir: one(sp.dir), nicheEditor: one(sp.nicheEditor), retratosProprios,
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
  return { pagina, view, ri, recente: obs.SYNC.last == null ? null : obs.SYNC.title, estado: { ...sp, niche }, privado: privadoDaLista(extras) }
}
