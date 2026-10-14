import { rodarTamanhoDoBanco } from '@/lib/youtube/observatorio/arquivo/medir-tamanho'
import { retentarMiniaturasPendentes } from '@/lib/youtube/observatorio/arquivo/remover'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { DEFINICAO_TAMANHO_DO_BANCO } from '../definicoes'
import { comPrazo } from '../relogio'
import type { ContextoTarefa, ResultadoTarefa, Tarefa } from '../tipos'

/** Só tenta apagar as miniaturas pendentes se sobrarem mais que isto até o `fimAteMs`; a tentativa em si usa no máximo 20 s e deixa 5 s de folga. */
const SOBRA_MINIMA_MS = 25_000
const TENTATIVA_MAX_MS = 20_000
const FOLGA_MS = 5_000

/**
 * `tamanho_do_banco` (A5 E10): a medida diária (`rodarTamanhoDoBanco`) e, depois dela, a nova tentativa das miniaturas pendentes de canais já
 * removidos. O resultado da tarefa é SEMPRE o da medida: a tentativa só acrescenta números ao `detalhe` e nunca troca `ok` por `erro`. Só roda
 * quando a medida deu `ok` (uma vez por dia, porque a tarefa não roda de novo no dia depois do `ok`: `blobRetryMaxPerDay` é o máximo do dia).
 */
async function rodarComMiniaturas(c: ContextoTarefa): Promise<ResultadoTarefa> {
  const medida = await rodarTamanhoDoBanco(c)
  if (medida.estado !== 'ok') return medida
  const detalhe: Record<string, number> = { ...(medida.detalhe ?? {}) }
  const sobra = c.t0 + DEFINICAO_TAMANHO_DO_BANCO.fimAteMs - c.agora()
  if (!(sobra > SOBRA_MINIMA_MS)) return { ...medida, detalhe: { ...detalhe, miniaturas_sem_tempo: 1 } }
  const prazoMs = Math.min(TENTATIVA_MAX_MS, sobra - FOLGA_MS)
  try {
    const r = await comPrazo(
      retentarMiniaturasPendentes(c.sb, { agoraMs: c.agora(), maximo: RULES.archive.blobRetryMaxPerDay, prazoMs }),
      prazoMs,
    )
    if ('estourou' in r) detalhe.miniaturas_sem_tempo = 1
    else if ('porque' in r.valor) detalhe.miniaturas_nao_tentadas = 1
    else {
      detalhe.miniaturas_apagadas = r.valor.apagadas
      detalhe.miniaturas_pendentes = r.valor.pendentes
      if (r.valor.foraDoPrefixo > 0) detalhe.miniaturas_fora_do_prefixo = r.valor.foraDoPrefixo
    }
  } catch {
    detalhe.miniaturas_nao_tentadas = 1
  }
  return { ...medida, detalhe }
}

export const tamanhoDoBanco: Tarefa = { ...DEFINICAO_TAMANHO_DO_BANCO, rodar: c => rodarComMiniaturas(c) }
