// Ordem de download dos relatórios em lote (A5, E12). Módulo puro: sem banco e sem rede.
// O arquivo de um relatório some na origem 60 dias depois de gerado, ou 30 se for de histórico (gerado ao criar o
// job). A fila anda pelo que vence primeiro; a posição do tipo em REPORT_TYPES_ENABLED só desempata.
import { REACH_TYPES, REPORT_TYPES_ENABLED } from '@/lib/youtube/reporting/types'

export const DIA_MS = 86_400_000
/** Validade do arquivo na origem, em dias desde `create_time`. É a mesma regra que o passo usa para marcar `expirado_sem_baixar`. */
export const VALIDADE_DIAS = { historico: 30, corrente: 60 } as const
/** Faltando isto ou menos para vencer, o relatório passa na frente de tudo, inclusive do alcance. */
export const URGENTE_DIAS = 7

export interface ItemDaFila {
  report_type_id: string
  create_time: string
  is_backfill?: boolean | null
}

const ALCANCE: readonly string[] = REACH_TYPES
const TIPOS: readonly string[] = REPORT_TYPES_ENABLED

/** Texto ilegível vira 0 (o mais antigo possível): dado ruim vai para a FRENTE da fila, nunca para o fim. */
const criadoEm = (p: ItemDaFila): number => {
  const t = new Date(p.create_time).getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Instante (epoch ms) em que o arquivo some na origem. Sem a marca de histórico vale o prazo curto. */
export function venceEm(p: ItemDaFila): number {
  const dias = p.is_backfill === false ? VALIDADE_DIAS.corrente : VALIDADE_DIAS.historico
  return criadoEm(p) + dias * DIA_MS
}

/**
 * Três faixas: (0) vence em até URGENTE_DIAS, de qualquer tipo; (1) alcance, que é o que as telas leem e nunca passa
 * de poucos por dia; (2) o resto. Dentro da faixa: vencimento crescente, depois a posição do tipo, depois a criação.
 */
export function ordenarFila<T extends ItemDaFila>(fila: readonly T[], agora: number): T[] {
  const prioridade = (tipo: string): number => {
    const i = TIPOS.indexOf(tipo)
    return i === -1 ? TIPOS.length : i
  }
  const faixa = (p: T): number =>
    venceEm(p) - agora <= URGENTE_DIAS * DIA_MS ? 0 : ALCANCE.includes(p.report_type_id) ? 1 : 2
  return [...fila].sort((a, b) =>
    faixa(a) - faixa(b)
    || venceEm(a) - venceEm(b)
    || prioridade(a.report_type_id) - prioridade(b.report_type_id)
    || criadoEm(a) - criadoEm(b))
}
