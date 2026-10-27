import { z } from 'zod'
import type { CampoNome, RestoreStatus } from '@/lib/youtube/ab-restore'
import type { DisplayLabel } from '@/lib/youtube/ab-types'
import type { NoArConfirmado, NoArLido } from '@/lib/youtube/ab-no-ar'
import type { ResultadoSaida } from '@/lib/youtube/ab-settle'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { detalheDaRecusa } from '@/lib/youtube/ab-lab-pagina/painel-textos'

/** Frase única da recusa por tentativa em voo (F-D4). Usada por pausar, encerrar, reverter, retomar e forçar rotação. */
export const MSG_VARIANTE_DA_VEZ = 'Não foi possível escolher a variante da vez. Recarregue a página e tente de novo.'
export const MSG_YOUTUBE_NAO_ACEITOU = 'O YouTube não aceitou a troca. Tente de novo; se repetir, confira o vídeo no YouTube Studio.'
export const MSG_EM_ANDAMENTO = 'Outra tentativa está em andamento. Tente de novo em instantes.'
export const MSG_SEM_PERMISSAO_VARIANTE = 'Só quem administra o site pode deixar uma variante no ar. Você pode voltar ao original.'
export const MSG_JA_ENCERRADO = 'Este teste já não está neste estado. Recarregue a página.'
export const MSG_MUDOU = 'O teste mudou em outra aba. Reabra para decidir.'
export const MSG_PEDIDO_INVALIDO = 'Pedido inválido. Recarregue a página e tente de novo.'
export const MSG_OUTRO_TESTE = 'Outro teste está em andamento neste vídeo. O Lab não troca título nem thumbnail daqui enquanto ele durar.'
export const MSG_RESTORE_ILEGIVEL = 'Não consegui ler o estado da volta ao original. Nada foi alterado. Recarregue a página; se repetir, confira o vídeo no YouTube Studio.'
export const MSG_FALHA_SAIDA = 'Não foi possível concluir agora. Recarregue a página e confira o estado do teste.'
export const MSG_DESTINO_INVALIDO = 'Variante inválida para este teste.'

/** Contrato do diálogo "O que fica no vídeo?" (Tarefa 15). */
export type ResultadoAcaoSaida =
  | { ok: true; resultado: 'feito'; campos: RestoreStatus }
  | { ok: true; resultado: 'precisa_confirmar'; campos: Array<{ campo: CampoNome; valor_atual: string }> }
  | { ok: false; resultado: 'em_andamento' | 'ja_encerrado' | 'mudou'; error: string }
  | { ok: false; resultado: 'sem_permissao' | 'erro'; error: string }

export type OpcaoEncerrar =
  | { destino: 'original'; seqVisto: number }
  | { destino: 'variante'; varianteId: string; forcar?: boolean; seqVisto: number }

/** `seqVisto` vem da rede: só pode restringir (no pior caso recusa), nunca abre nada. */
export const seqVistoSchema = z.number().int().nonnegative()

export function traduzirSaida(r: ResultadoSaida): ResultadoAcaoSaida {
  switch (r.resultado) {
    case 'feito': return { ok: true, resultado: 'feito', campos: r.campos }
    case 'precisa_confirmar': return { ok: true, resultado: 'precisa_confirmar', campos: r.campos }
    case 'mudou': return { ok: false, resultado: 'mudou', error: MSG_MUDOU }
    case 'perdido': // M7b: o resultado não foi gravado; para as telas antigas é uma tentativa em curso (a escolha trata `perdido` à parte)
    case 'em_andamento': return { ok: false, resultado: 'em_andamento', error: MSG_EM_ANDAMENTO }
    case 'ja_encerrado': return { ok: false, resultado: 'ja_encerrado', error: MSG_JA_ENCERRADO }
    case 'sem_permissao': return { ok: false, resultado: 'sem_permissao', error: MSG_SEM_PERMISSAO_VARIANTE }
    case 'outro_teste': return { ok: false, resultado: 'ja_encerrado', error: MSG_OUTRO_TESTE }
    case 'teste_youtube': return { ok: false, resultado: 'erro', error: r.motivo } // F1a-dado: teste do YouTube em andamento no vídeo
    case 'destino_invalido': return { ok: false, resultado: 'erro', error: MSG_DESTINO_INVALIDO } // Y-D2
  }
}

/** Erro de sessão (requireEditAccess lança 'unauthenticated' | 'forbidden') vira sem_permissao. */
export function recusaDeSessao(e: unknown): ResultadoAcaoSaida {
  return { ok: false, resultado: 'sem_permissao', error: e instanceof Error ? e.message : 'forbidden' }
}

/** Id da variante is_original do teste (filtrado pelo site), ou null. */
export async function varianteOriginalId(testId: string, siteId: string): Promise<string | null> {
  const supabase = getSupabaseServiceClient()
  const { data: teste } = await supabase.from('ab_tests').select('id').eq('id', testId).eq('site_id', siteId).maybeSingle()
  if (!teste) return null
  const { data } = await supabase.from('ab_test_variants').select('id').eq('test_id', testId).eq('is_original', true).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

// ---- M7b: escolher qualquer versão num teste concluído ----

/** Por que a escrita da escolha foi recusada; uma frase do Logan por valor (T7a). O YouTube só é culpado quando foi chamado. */
export type PorqueRecusou = 'youtube' | 'drift' | 'sem_original' | 'sem_tempo' | 'arquivo_indisponivel'

export type ResultadoEscolha =
  | { ok: true; resultado: 'no_ar'; noAr: NoArConfirmado; restoreSeq: number }
  | { ok: true; resultado: 'guardado'; restoreSeq: number }
  | { ok: true; resultado: 'precisa_confirmar'; campos: Array<{ campo: CampoNome; valor_atual: string }> }
  | { ok: false; resultado: 'recusou'; porque: PorqueRecusou; noAr: NoArLido; entrou: CampoNome[]; restoreSeq: number; error: string }
  | { ok: false; resultado: 'incerto'; restoreSeq: number | null }
  | { ok: false; resultado: 'mudou' | 'ja_encerrado' | 'em_andamento' | 'outro_teste' | 'teste_youtube' | 'sem_permissao' | 'erro'; error: string }

export type ResultadoConferir =
  | { ok: true; estado: 'escrevendo' }
  | { ok: true; estado: 'lido'; noAr: NoArConfirmado; restoreSeq: number; fonte: 'registro' | 'youtube' }
  | { ok: true; estado: 'nao_propagou'; noAr: NoArConfirmado; titulo: 'conferido' | 'nao_lido' }
  | { ok: true; estado: 'lido_misto'; porCampo: Partial<Record<CampoNome, DisplayLabel>>; restoreSeq: number }
  | { ok: true; estado: 'nenhuma_versao'; restoreSeq: number }
  | { ok: false; estado: 'sem_leitura' | 'sem_permissao' | 'ja_encerrado'; error: string }

/** Texto de `error` por motivo da recusa (T7a, Logan); a tela monta o aviso com as letras em `painel-textos.ts`. */
export const MSG_RECUSA: Record<PorqueRecusou, string> = {
  youtube: detalheDaRecusa('youtube', { S: null, X: null }),
  drift: detalheDaRecusa('drift', { S: null, X: null }),
  sem_original: detalheDaRecusa('sem_original', { S: null, X: null }),
  sem_tempo: detalheDaRecusa('sem_tempo', { S: null, X: null }),
  arquivo_indisponivel: detalheDaRecusa('arquivo_indisponivel', { S: null, X: null }),
}
