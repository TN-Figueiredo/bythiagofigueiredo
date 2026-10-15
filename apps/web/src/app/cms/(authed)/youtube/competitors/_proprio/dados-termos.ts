// A5 · E5b · Tarefa 9: a entrada dos termos de pesquisa e sites de fora (servidor). SÓ QUEM EDITA o site lê: o termo digitado por um
// espectador é conteúdo de terceiro. O site vem de DENTRO do token de leitura (`a.prova.siteId`) e é a edição DESSE site que é provada
// aqui, para ninguém juntar a edição de um site com a leitura de outro. Sem uma das duas provas: `negado`, sem consultar e sem criar o
// cliente de serviço. Quem barra a chamada direta de `lerDetalheDaOrigem` é a varredura (`proprio-varredura.test.ts`), não o leitor.
import 'server-only'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import { mapLimit } from '@/lib/youtube/observatorio/load'
import { edicaoValida, provarEdicao } from '@/lib/youtube/observatorio/proprio/edicao'
import { leituraValida, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { ErroLeituraDimensoes, lerDetalheDaOrigem, type DetalheCanal } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { avisarFalhaDeLeitura } from './dados-origem'
import { CHAMADAS_EM_VOO, chamadasDe, juntarConjunto } from './origem-trechos'

export async function lerTermosESites(a: {
  canalId: string
  ytIds: readonly string[]
  de: DiaYt
  ate: DiaYt
  agora: number
  prova: LeituraPrivadaDoSite | null
}): Promise<Privado<DetalheCanal>> {
  if (!leituraValida(a.prova)) return { acesso: 'negado' }
  const leitura = a.prova
  // `provarEdicao` engole o erro e devolve nulo; se mesmo assim lançar, quem não prova não lê
  let edicao: Awaited<ReturnType<typeof provarEdicao>> = null
  try { edicao = await provarEdicao(leitura.siteId) } catch { edicao = null }
  if (!edicaoValida(edicao)) return { acesso: 'negado' }
  const hoje = dayPt(new Date(a.agora))
  try {
    const chamadas = chamadasDe(a.ytIds, a.de, a.ate)
    const sb = getSupabaseServiceClient()
    const lidas = await mapLimit(chamadas, CHAMADAS_EM_VOO, async c => {
      const r = await lerDetalheDaOrigem(sb, { leitura, canalId: a.canalId, hoje, ytIds: c.ytIds, de: c.de, ate: c.ate })
      if (r.acesso !== 'ok') throw new ErroLeituraDimensoes('detalhe-da-origem', 'erro_de_banco', null, 0)
      return { c, dado: r.dado }
    })
    const conjunto = juntarConjunto(lidas.map(l => ({ trecho: l.c.trecho, lote: l.c.lote, conjunto: l.dado.conjunto })))
    return { acesso: 'ok', dado: { canalId: a.canalId, de: a.de, ate: a.ate, conjunto, descartados: lidas.reduce((s, l) => s + l.dado.descartados, 0) } }
  } catch (e) {
    avisarFalhaDeLeitura('ler-termos', e)
    return { acesso: 'erro' }
  }
}
