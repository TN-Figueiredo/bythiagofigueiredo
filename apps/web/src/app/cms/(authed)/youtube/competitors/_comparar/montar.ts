import { openObservatoryPage, type ObservatoryPage } from '../_chrome/page-data'
import { carregarProprioDaComparacao } from '../_proprio/carregar-extras'
import { buildCompararPack, type CompararPack } from './pack'
import { resolverPar } from './par-model'

type ParIds = ReturnType<typeof resolverPar>

/**
 * Do conjunto aberto ao pacote de Comparar e ao par inicial: a MESMA função monta a tela (a página) e o pacote "Perguntar a uma IA"
 * (E17 degrau 1, Tarefa 8a). `sp` são os parâmetros planos da URL. A guarda vem antes de qualquer leitura; o `siteId` não é parâmetro.
 */
export async function montarComparar(sp: Record<string, string | undefined>): Promise<{
  pagina: ObservatoryPage<undefined>; pack: CompararPack; inicial: ParIds; recente: string | null; estado: ParIds
}> {
  const pagina = await openObservatoryPage()
  const { siteId, now, obs, meuCanalLembrado } = pagina
  // as views por dia e o cartão "Só o seu canal mede" dos canais próprios: lidos só para quem edita o site, depois da guarda; sem canal próprio no site
  // nada é consultado, e quem só lê recebe 'negado' sem nenhum número
  // o par da URL decide de quais canais próprios se lê a origem (7 dias): o seletor do navegador não volta ao servidor (D14)
  const inicial = resolverPar(buildCompararPack(obs, undefined, undefined, {}), sp.a, sp.b, meuCanalLembrado)
  const { extras, soSeuCanal } = await carregarProprioDaComparacao(obs, siteId, now, undefined, inicial ? [inicial.a, inicial.b] : [])
  const pack = buildCompararPack(obs, undefined, extras, soSeuCanal)
  return { pagina, pack, inicial, recente: obs.SYNC.last == null ? null : obs.SYNC.title, estado: inicial }
}
