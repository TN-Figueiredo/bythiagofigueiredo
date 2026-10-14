import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { openObservatoryPage, type ObservatoryPage } from '../_chrome/page-data'
import { buildMudancasView } from './view-model'
import { loadSwipeRows, savedFromRows } from './swipe-rows'

type Linhas = Awaited<ReturnType<typeof loadSwipeRows>>

/**
 * Do conjunto aberto ao modelo de Mudanças: a MESMA função monta a tela (a página) e o pacote "Perguntar a uma IA" (E17 degrau 1,
 * Tarefa 8a). `sp` são os parâmetros planos da URL (primeira ocorrência de cada chave). O `siteId` não é parâmetro: vem da guarda.
 */
export async function montarMudancas(sp: Record<string, string | undefined>): Promise<{
  pagina: ObservatoryPage<Linhas>; view: ReturnType<typeof buildMudancasView>; recente: string | null; estado: Record<string, string | undefined>
}> {
  const pagina = await openObservatoryPage(loadSwipeRows)
  const { obs, savedNiche, extra: rows } = pagina
  // parseNiche checks the form; the engine says whether the niche exists (an unknown one opens in Todos)
  const niche = obs.scopeOf(parseNiche(sp.niche) ?? savedNiche)
  const { saved, keys } = savedFromRows(obs, rows)
  const estado = { ...sp, niche }
  const view = buildMudancasView(obs, estado, saved, keys)
  return { pagina, view, recente: obs.SYNC.last == null ? null : obs.SYNC.title, estado }
}
