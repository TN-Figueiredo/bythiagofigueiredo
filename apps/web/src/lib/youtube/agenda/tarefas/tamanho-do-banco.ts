import { rodarTamanhoDoBanco } from '@/lib/youtube/observatorio/arquivo/medir-tamanho'
import { retentarBlobsDeRemocoes, retentarMiniaturasPendentes } from '@/lib/youtube/observatorio/arquivo/remover'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { DEFINICAO_TAMANHO_DO_BANCO } from '../definicoes'
import { comPrazo } from '../relogio'
import type { ContextoTarefa, ResultadoTarefa, Tarefa } from '../tipos'

/** Só tenta apagar as miniaturas pendentes se sobrarem mais que isto até o `fimAteMs`; a tentativa em si usa no máximo 20 s e deixa 5 s de folga. */
const SOBRA_MINIMA_MS = 25_000
const TENTATIVA_MAX_MS = 20_000
const FOLGA_MS = 5_000

/** M9 T13: os blobs dos canais removidos, com o máximo que SOBRA das miniaturas e o prazo que resta. Nunca troca o estado; `flag_desligada` fica visível no detalhe. */
async function blobsDasRemocoes(c: ContextoTarefa, detalhe: Record<string, number>, maximo: number): Promise<void> {
  // Retenção de 90 dias da prova de ausência encerrada (Phil I1): barata, sem Blob, não depende do prazo nem da flag.
  try {
    const p = await c.sb.rpc('obs_archive_absence_prune', { p_dias: 90 })
    if (!p.error && typeof p.data === 'number' && p.data > 0) detalhe.ausencia_podadas = p.data
  } catch { /* a próxima rodada tenta */ }
  const sobra = c.t0 + DEFINICAO_TAMANHO_DO_BANCO.fimAteMs - c.agora()
  if (!(sobra > SOBRA_MINIMA_MS)) { detalhe.blobs_remocoes_sem_tempo = 1; return }
  const prazoMs = Math.min(TENTATIVA_MAX_MS, sobra - FOLGA_MS)
  try {
    const r = await comPrazo(retentarBlobsDeRemocoes(c.sb, { agoraMs: c.agora(), maximo, prazoMs }), prazoMs)
    if ('estourou' in r) detalhe.blobs_remocoes_sem_tempo = 1
    else if ('porque' in r.valor) {
      if (r.valor.porque === 'flag_desligada') detalhe.blobs_remocoes_flag_desligada = 1
      else detalhe.blobs_remocoes_nao_tentadas = 1
    } else {
      detalhe.blobs_remocoes_apagadas = r.valor.apagadas
      detalhe.blobs_remocoes_pendentes = r.valor.pendentes
      if (r.valor.foraDoPrefixo > 0) detalhe.blobs_remocoes_fora_do_prefixo = r.valor.foraDoPrefixo
    }
  } catch {
    detalhe.blobs_remocoes_nao_tentadas = 1
  }
}

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
    let sobrou = RULES.archive.blobRetryMaxPerDay
    if ('estourou' in r) detalhe.miniaturas_sem_tempo = 1
    else if ('porque' in r.valor) detalhe.miniaturas_nao_tentadas = 1
    else {
      detalhe.miniaturas_apagadas = r.valor.apagadas
      detalhe.miniaturas_pendentes = r.valor.pendentes
      if (r.valor.foraDoPrefixo > 0) detalhe.miniaturas_fora_do_prefixo = r.valor.foraDoPrefixo
      sobrou = Math.max(0, sobrou - r.valor.apagadas)
    }
    await blobsDasRemocoes(c, detalhe, sobrou)
  } catch {
    detalhe.miniaturas_nao_tentadas = 1
  }
  return { ...medida, detalhe }
}

export const tamanhoDoBanco: Tarefa = { ...DEFINICAO_TAMANHO_DO_BANCO, rodar: c => rodarComMiniaturas(c) }
