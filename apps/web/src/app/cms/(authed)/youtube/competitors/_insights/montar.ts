import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { carregarMedidasDoSite, type MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import { parseNiche, type Niche } from '@/lib/youtube/observatorio/niche'
import { openObservatoryPage, type ObservatoryPage } from '../_chrome/page-data'
import { buildInsightsView } from './view-model'
import { direcaoDoNicho, parseLeitura } from './direcao-nicho-model'

/**
 * Quem sobe e quem desce (E5a T9). Carrega as medidas SÓ dos canais concorrentes do nicho: o canal próprio não tem entrada em `porCanal` e o modelo o
 * escreve só com o nome. Nunca derruba a tela: se a leitura lançar por inteiro, o cartão vai em erro (sem posição nenhuma) e o erro vai ao Sentry.
 */
async function carregarDirecao(pagina: ObservatoryPage<undefined>, niche: Niche, leitura: string | undefined) {
  const { siteId, now, obs } = pagina
  const concorrentes = obs.channels.filter(c => !c.own && c.niche === niche)
  let medidas: MedidasDoSite | 'erro' = 'erro'
  if (concorrentes.length) {
    try {
      medidas = await carregarMedidasDoSite(getSupabaseServiceClient(), { siteId, obs, canais: concorrentes.map(c => c.id), agoraMs: now })
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'observatorio', step: 'medidas-telas-insights' } })
    }
  }
  return direcaoDoNicho(medidas, concorrentes.map(c => ({ id: c.id, name: c.name, href: obs.link.canais({ channel: c.id }) })), {
    leitura: parseLeitura(leitura), hojeSP: spDateOf(now), nicho: obs.nicheLabel(niche),
    seusCanais: obs.channels.filter(c => c.own && c.niche === niche).map(c => c.name),
  })
}

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
  const base = buildInsightsView(obs, { niche, fmt: sp.fmt })
  const view = niche === 'todos' ? base : { ...base, direcaoNicho: await carregarDirecao(pagina, niche, sp.leitura) }
  const heatMode = sp.heat === 'views' ? 'views' : 'uploads'
  return { pagina, view, heatMode, recente: obs.SYNC.last == null ? null : obs.SYNC.title, estado: { niche, fmt: sp.fmt, heat: heatMode } }
}
