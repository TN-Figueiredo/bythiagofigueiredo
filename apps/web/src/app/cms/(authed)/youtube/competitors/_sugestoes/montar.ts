import { observatoryNow } from '@/lib/youtube/observatorio/now'
import { dataSp, modeloDeSugestoes, empacotarSugestoes, SUGESTOES_NO_PACOTE } from '../_contexto-ia/sugestoes'
import type { PacoteMontado } from '../_contexto-ia/index'
import { abrirSugestoes } from './dados'

/** F2 T8: do que a guarda deixa ler ao pacote `sugestoes`. Sem acesso devolve `null` ("não encontrado"). */
export async function montarSugestoes(): Promise<PacoteMontado | null> {
  const agora = new Date(observatoryNow())
  const lista = await abrirSugestoes(agora, SUGESTOES_NO_PACOTE)
  if (!lista) return null
  return { modelo: empacotarSugestoes(modeloDeSugestoes(lista, agora)), recente: lista.computado_em === null ? null : dataSp(lista.computado_em), estado: {} }
}
