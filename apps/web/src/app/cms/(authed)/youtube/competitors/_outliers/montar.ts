import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { carregarMedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { openObservatoryPage, type ObservatoryPage } from '../_chrome/page-data'
import { buildOutliersView, type EntradaDeIdade } from './view-model'
import { dadosDeIdade } from './idade-dados'

/**
 * As views aos 7 e aos 30 dias dos vídeos (E5a T8). Nunca derruba a tela: se a leitura lançar por inteiro, a entrada é `'erro'` (as colunas dizem "não
 * carregou", as duas opções de ordem ficam desligadas e o multiplicador segue); o erro vai ao Sentry.
 */
async function carregarIdades(pagina: ObservatoryPage<undefined>, estado: Record<string, string | undefined>): Promise<EntradaDeIdade> {
  const { siteId, now, obs } = pagina
  try {
    // Só os canais que têm vídeo na lista filtrada (portão Phil I5): a lista inteira, sem corte de página, na ordem do multiplicador, ainda sem as idades.
    const lista = buildOutliersView(obs, { ...estado, sort: 'mult', limit: '1000000' }).pageIds
    const doVideo = new Map(obs.videos.map(v => [v.id, v.ch]))
    const canais = [...new Set(lista.flatMap(id => { const ch = doVideo.get(id); return ch === undefined ? [] : [ch] }))].filter(id => obs.channel(id)?.own === false)
    if (!canais.length) return { hojeSP: spDateOf(now), m1: new Map(), videos: new Map(), foraDoNormal: new Map() }
    const medidas = await carregarMedidasDoSite(getSupabaseServiceClient(), { siteId, obs, canais, agoraMs: now })
    return dadosDeIdade(medidas, spDateOf(now))
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'observatorio', step: 'medidas-telas-outliers' } })
    return 'erro'
  }
}

/**
 * Do conjunto aberto ao modelo de Outliers: a MESMA função monta a tela (a página) e o pacote "Perguntar a uma IA" (E17 degrau 1,
 * Tarefa 8a). `sp` são os parâmetros planos da URL. O `siteId` não é parâmetro: vem da guarda.
 */
export async function montarOutliers(sp: Record<string, string | undefined>): Promise<{
  pagina: ObservatoryPage<undefined>; view: ReturnType<typeof buildOutliersView>; niche: string
  recente: string | null; estado: Record<string, string | undefined>
}> {
  const pagina = await openObservatoryPage()
  const { obs, savedNiche } = pagina
  // The chrome persists a valid ?niche= (resolveNiche); here it is only read. An invalid one falls back to the saved niche.
  // parseNiche checks the form; the engine says whether the niche exists (an unknown ?niche= falls back to the saved niche, like a malformed one).
  const urlNiche = parseNiche(sp.niche === 'all' ? 'todos' : sp.niche)
  const niche = urlNiche != null && obs.scopeOf(urlNiche) === urlNiche ? urlNiche : obs.scopeOf(savedNiche)
  const estado = { ...sp, niche }
  const view = buildOutliersView(obs, estado, await carregarIdades(pagina, estado))
  return { pagina, view, niche, recente: obs.SYNC.last == null ? null : obs.SYNC.title, estado }
}
