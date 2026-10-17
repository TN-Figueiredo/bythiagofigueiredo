import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { abrirFila } from './dados'
import { buildFilaView, lerMostrar, type FilaView } from './view-model'

/**
 * Da fila lida ao modelo de "Saíram do YouTube": a MESMA função monta a tela (a página) e o pacote "Perguntar a uma IA" (E17 degrau 1,
 * Tarefa 16). `sp` são os parâmetros planos da URL (primeira ocorrência de cada chave). O `siteId` não é parâmetro: vem da guarda em `abrirFila`,
 * que devolve `sem_acesso` a quem não edita o site.
 */
export async function montarFila(sp: Record<string, string | undefined>): Promise<{ view: FilaView; recente: string | null; estado: Record<string, string | undefined> }> {
  const mostrar = lerMostrar(sp.mostrar)
  const leitura = await abrirFila(mostrar)
  const view = buildFilaView(leitura, { agoraMs: observatoryNow(), mostrar })
  return { view, recente: null, estado: { ...sp, mostrar: String(mostrar) } }
}
