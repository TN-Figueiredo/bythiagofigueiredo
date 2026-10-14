import type { SupabaseClient } from '@supabase/supabase-js'
import { lerPendenciasDoArquivo, type PendenciasDoArquivo } from '@/lib/youtube/observatorio/arquivo/ler-pendencias'
import { lerSinalDoBanco, type SinalLido } from '@/lib/youtube/observatorio/arquivo/ler-sinal'
import { extrasDoDisparo, FRASE_SINAL_NAO_LIDO } from './extras-arquivo'
import { PROOF_MIN_MS } from './fecho'
import { comPrazo } from './relogio'

/**
 * (A5 E10, Tarefa 9, passo 7) O sinal do tamanho do banco e as pendências do arquivo no caminho SEM agenda (`OBS_AGENDA=off` ou a guarda da MG10
 * falhando): a rota chama esta função logo depois de `rodarAntesDoLoteAntigo`. É a mesma `extrasDoDisparo` do caminho com agenda, com
 * `todas: null`, `agendaDesde: null` e `tamanhoOkHa36h: null`. Nunca lança; `banco` nunca volta vazio (ou traz o estado, ou `nao_lido`).
 */
export interface ArquivoSemAgenda { problemas: string[]; notas: string[]; acao: string[]; banco: Record<string, unknown> }

export async function lerArquivoSemAgenda(o: {
  supabase: SupabaseClient
  agora?: () => number
  ler?: { sinal: typeof lerSinalDoBanco; pendencias: typeof lerPendenciasDoArquivo }
}): Promise<ArquivoSemAgenda> {
  const agora = o.agora ?? Date.now
  const ler = o.ler ?? { sinal: lerSinalDoBanco, pendencias: lerPendenciasDoArquivo }
  try {
    const [sinal, pendencias] = await Promise.all([
      comPrazo(ler.sinal(o.supabase, agora()), PROOF_MIN_MS).then(
        (r): SinalLido | { porque: 'prazo' } => ('estourou' in r ? { porque: 'prazo' } : r.valor),
        (): SinalLido => ({ porque: 'excecao' }),
      ),
      comPrazo(ler.pendencias(o.supabase, agora()), PROOF_MIN_MS).then(
        (r): PendenciasDoArquivo | { porque: 'prazo' } => ('estourou' in r ? { porque: 'prazo' } : r.valor),
        (): { porque: 'prazo' } => ({ porque: 'prazo' }),
      ),
    ])
    const x = extrasDoDisparo({ todas: null, sinal, agoraMs: agora(), agendaDesde: null, pendencias, tamanhoOkHa36h: null })
    return { problemas: x.problemas, notas: x.notas, acao: x.acao, banco: x.banco }
  } catch {
    return { problemas: [], notas: [FRASE_SINAL_NAO_LIDO], acao: [FRASE_SINAL_NAO_LIDO], banco: { nao_lido: 'excecao' } }
  }
}
