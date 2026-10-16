import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { carregarMedidasDoSite, type MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { openObservatoryPage, type ObservatoryPage } from '../_chrome/page-data'
import { carregarProprioDaComparacao } from '../_proprio/carregar-extras'
import { buildCompararPack, type CompararPack } from './pack'
import { resolverPar } from './par-model'
import { privadoDaLista } from '../_canais/montar'
import type { EstadoDoPrivado } from '@/lib/youtube/observatorio/contexto-ia/tipos'

type ParIds = ReturnType<typeof resolverPar>

/**
 * Do conjunto aberto ao pacote de Comparar e ao par inicial: a MESMA função monta a tela (a página) e o pacote "Perguntar a uma IA"
 * (E17 degrau 1, Tarefa 8a). `sp` são os parâmetros planos da URL. A guarda vem antes de qualquer leitura; o `siteId` não é parâmetro.
 */
export async function montarComparar(sp: Record<string, string | undefined>): Promise<{
  pagina: ObservatoryPage<undefined>; pack: CompararPack; inicial: ParIds; recente: string | null; estado: ParIds; privado: EstadoDoPrivado
}> {
  const pagina = await openObservatoryPage()
  const { siteId, now, obs, meuCanalLembrado } = pagina
  // as views por dia e o cartão "Só o seu canal mede" dos canais próprios: lidos só para quem edita o site, depois da guarda; sem canal próprio no site
  // nada é consultado, e quem só lê recebe 'negado' sem nenhum número
  // o par da URL decide de quais canais próprios se lê a origem (7 dias): o seletor do navegador não volta ao servidor (D14)
  const inicial = resolverPar(buildCompararPack(obs, undefined, undefined, {}), sp.a, sp.b, meuCanalLembrado)
  // A5 E5a T7: as medidas de TODOS os concorrentes vão no pacote (o seletor troca de par sem rede). Falha por inteiro = `null`: cada lado diz "não carregou".
  const carregarMedidas = async (): Promise<MedidasDoSite | null> => {
    try {
      return await carregarMedidasDoSite(getSupabaseServiceClient(), { siteId, obs, canais: obs.channels.filter(c => !c.own).map(c => c.id), agoraMs: now })
    } catch (err) {
      Sentry.captureException(err, { tags: { component: 'observatorio', step: 'medidas-telas-comparar' } })
      return null
    }
  }
  const [{ extras, soSeuCanal }, medidas] = await Promise.all([
    carregarProprioDaComparacao(obs, siteId, now, undefined, inicial ? [inicial.a, inicial.b] : []),
    carregarMedidas(),
  ])
  const pack = buildCompararPack(obs, undefined, extras, soSeuCanal, medidas)
  // O acesso cru de cada leitura (E17 degrau 1, D-I1): o diário vem do que a lista também lê; o alcance, do cartão "Só o seu canal mede". `negativa` nasce nula.
  const privado = privadoDaLista(extras)
  for (const [id, d] of Object.entries(soSeuCanal)) privado.acessoPorCanal[id] = { diario: privado.acessoPorCanal[id]?.diario ?? 'ok', alcance: d.acesso }
  return { pagina, pack, inicial, recente: obs.SYNC.last == null ? null : obs.SYNC.title, estado: inicial, privado }
}
