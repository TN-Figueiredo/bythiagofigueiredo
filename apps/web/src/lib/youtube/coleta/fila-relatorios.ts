// Ordem de download dos relatórios em lote (A5, E12). Módulo puro: sem banco e sem rede.
// O arquivo de um relatório some na origem 60 dias depois de gerado, ou 30 se for de histórico (gerado ao criar o
// job). A fila anda pelo que vence primeiro; a posição do tipo em REPORT_TYPES_ENABLED só desempata.
import { REACH_TYPES, REPORT_TYPES_ENABLED } from '@/lib/youtube/reporting/types'

export const DIA_MS = 86_400_000
/** Validade do arquivo na origem, em dias desde `create_time`. É a mesma regra que o passo usa para marcar `expirado_sem_baixar`. */
export const VALIDADE_DIAS = { historico: 30, corrente: 60 } as const
/** Faltando isto ou menos para vencer, o relatório passa na frente de tudo, inclusive do alcance. */
export const URGENTE_DIAS = 7

/** Quantos dias uma perda de relatório continua pintando o cron de vermelho (critérios): contados da criação do relatório
 *  (nota por relatório, criteria.ts) ou do vencimento na origem (nota agregada). Passou disto vira só `perdidos`. */
export const JANELA_PERDA_DIAS = 14
/** Folga entre o passo (que decide se um critério cobre a perda) e os critérios (que rodam minutos depois): na fronteira,
 *  mais vale uma nota repetida do que perda sem nota. Maior que o relógio global do cron (270 s). */
const MARGEM_COBERTURA_MS = 15 * 60_000

export interface ItemDaFila {
  report_type_id: string
  create_time: string
  is_backfill?: boolean | null
  /** MG13. Instante em que a origem respondeu 404 ou 410. Ausente ou nulo = sem registro de vencimento, nunca "não venceu". */
  expired_at?: string | null
}

export type RegistroDeVencimento = { tipo: 'origem'; em: string } | { tipo: 'sem_registro' }

/** O que o banco sabe sobre o vencimento na origem. Linha anterior à MG13, campo nulo ou ilegível: sem registro. */
export function registroDeVencimento(p: { expired_at?: string | null }): RegistroDeVencimento {
  const t = p.expired_at ? new Date(p.expired_at).getTime() : Number.NaN
  return Number.isNaN(t) ? { tipo: 'sem_registro' } : { tipo: 'origem', em: new Date(t).toISOString() }
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

/**
 * Os critérios persistentes (criteria.ts) já avisam desta perda, a cada execução, durante JANELA_PERDA_DIAS? Três portas:
 * (a) nota por relatório: `create_time` dentro da janela; (b) nota agregada: o arquivo venceu na origem (`venceEm` já passou)
 * há até JANELA_PERDA_DIAS dias; (c) MG13: a origem recusou (404/410) e `expired_at` está dentro da janela. Ficam de fora
 * só o que venceu há mais de 14 dias (cron parado, ou recusa registrada há mais de 14 dias). Dono único da nota: quem cobre avisa, o passo só anota o que ninguém cobre.
 * Dado ilegível nunca conta como coberto (cai na nota do passo).
 */
export function perdaCobertaPorCriterios(p: ItemDaFila, agora: number): boolean {
  const criado = new Date(p.create_time).getTime()
  if (Number.isNaN(criado)) return false
  const janela = JANELA_PERDA_DIAS * DIA_MS
  if (criado >= agora - janela + MARGEM_COBERTURA_MS) return true
  // (c) MG13: a origem recusou (404/410) e o instante está gravado; o critério por expired_at avisa durante a janela.
  const venc = registroDeVencimento(p)
  if (venc.tipo === 'origem' && Date.parse(venc.em) >= agora - janela + MARGEM_COBERTURA_MS) return true
  const vence = venceEm(p)
  return vence <= agora && vence >= agora - janela + MARGEM_COBERTURA_MS
}
