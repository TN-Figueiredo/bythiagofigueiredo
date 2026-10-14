import { parseNiche } from '@/lib/youtube/observatorio/niche'
import { openObservatoryPage, type ObservatoryPage } from '../_chrome/page-data'
import { buildInsightsView } from './view-model'

/**
 * Do conjunto aberto ao modelo de Insights: a MESMA função monta a tela (a página) e o pacote "Perguntar a uma IA" (E17 degrau 1,
 * Tarefa 8a). `sp` são os parâmetros planos da URL. O `siteId` não é parâmetro: vem da guarda.
 */
export async function montarInsights(sp: Record<string, string | undefined>): Promise<{
  pagina: ObservatoryPage<undefined>; view: ReturnType<typeof buildInsightsView>; heatMode: 'views' | 'uploads'; recente: string | null
  estado: { niche: string; fmt: string | undefined; heat: 'views' | 'uploads' }
}> {
  const pagina = await openObservatoryPage()
  const { obs, savedNiche } = pagina
  // parseNiche checks the form; the engine says whether the niche exists (an unknown one opens in Todos)
  const niche = obs.scopeOf(parseNiche(sp.niche) ?? savedNiche)
  const view = buildInsightsView(obs, { niche, fmt: sp.fmt })
  const heatMode = sp.heat === 'views' ? 'views' : 'uploads'
  return { pagina, view, heatMode, recente: obs.SYNC.last == null ? null : obs.SYNC.title, estado: { niche, fmt: sp.fmt, heat: heatMode } }
}
