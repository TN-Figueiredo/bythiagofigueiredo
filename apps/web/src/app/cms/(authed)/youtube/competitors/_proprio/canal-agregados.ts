/**
 * As contas puras que a tela do canal próprio divide entre o cabeçalho, "Como o canal está" e a aba de % assistido (A4 13.3). Puro: recebe o
 * dado privado JÁ LIDO e não lê banco. Regra de ouro (este sistema falha em VERDE): não medido nunca vira zero. Dia sem linha é não medido; linha
 * com 0 é zero medido. Sem o que somar, o resultado é nulo com o MOTIVO, nunca 0. % assistido acima de 100 é dado válido (trecho revisto): a
 * média passa de 100 e nada recorta.
 */
import { addDays, diffDias } from '@/lib/youtube/coleta/day-pt'
import type { DiaAlcance, Periodo, ResumoAlcance } from '@/lib/youtube/observatorio/proprio/dias'
import { JANELA_ASSISTIDO_DIAS, POUCAS_VIEWS, type MotivoSemAssistido } from '@/lib/youtube/observatorio/proprio/assistido'
import { taxaComIntervalo, type TaxaComIntervalo } from '@/lib/youtube/observatorio/proprio/taxa'
import type { DiarioCanal, DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { foraDoTetoDe, MIN_DIAS_VPD } from '@/lib/youtube/observatorio/proprio/vpd'

/** Decisão do dono: com menos dias com dado que isto a tela diz que ainda não dá para dizer, em vez de cravar um número. */
export const MIN_DIAS_ASSISTIDO = MIN_DIAS_VPD
/** Abaixo disto (views na base) o % assistido do canal sai com "só N views: pouco para uma média". */
export const POUCAS_VIEWS_MEDIA = 30
export { POUCAS_VIEWS }

/** A taxa de clique do canal (cliques estimados ÷ impressões) com o intervalo de 95%. Sem impressão, ou com cliques não medidos em algum dia: nula, nunca 0%. */
export function taxaDoCanal(r: ResumoAlcance): TaxaComIntervalo | null {
  if (r.imp == null || r.imp <= 0 || r.cliques == null) return null
  return taxaComIntervalo(r.cliques, r.imp)
}

export interface AssistidoCanal {
  /** pontos (de 0 em diante; pode passar de 100); null = sem número (veja `motivo`) */
  pct: number | null
  /** views da base: a soma das views dos dias que entraram */
  n: number
  /** dias distintos que entraram */
  dias: number
  /** vídeos que entraram */
  videos: number
  janela: { de: DiaYt; ate: DiaYt } | null
  motivo: MotivoAssistidoCanal | null
  /** dos vídeos pedidos, quantos ficaram além do teto do diário e NÃO foram lidos: o % é só dos lidos e a tela diz */
  foraDoTeto: number
}

/** Os motivos do vídeo mais um: há views na janela, mas o YouTube não entregou o % assistido de nenhum dia (a coleta dele ainda não rodou). */
export type MotivoAssistidoCanal = MotivoSemAssistido | 'sem-percentual'

const SEM_PCT = { pct: null, n: 0, dias: 0, videos: 0, foraDoTeto: 0 } as const

/**
 * O % assistido do canal: a média do percentual de cada dia, pesada pelas views do dia, entre os vídeos pedidos, nos 28 dias que terminam no
 * último dia gravado do canal. Entra o dia com views > 0 e percentual medido. É a mesma conta de `assistidoDoVideo`, somada entre os vídeos.
 */
export function assistidoDoCanal(d: Privado<DiarioCanal>, ytIds: readonly string[]): AssistidoCanal {
  if (d.acesso === 'negado') return { ...SEM_PCT, janela: null, motivo: 'sem-acesso' }
  if (d.acesso === 'erro') return { ...SEM_PCT, janela: null, motivo: 'leitura-falhou' }
  const { ultimoDia } = d.dado
  if (ultimoDia == null) return { ...SEM_PCT, janela: null, motivo: 'sem-diario' }
  const foraDoTeto = foraDoTetoDe(d.dado, ytIds)
  const de = addDays(ultimoDia, -(JANELA_ASSISTIDO_DIAS - 1))
  const janela = { de, ate: ultimoDia }
  const pedidos = new Set(ytIds)
  const dias = new Set<DiaYt>()
  const videos = new Set<string>()
  let soma = 0
  let n = 0
  let viuSemPct = false
  for (const l of d.dado.linhas) {
    if (!pedidos.has(l.ytId) || l.dia < de || l.dia > ultimoDia) continue
    if (l.views != null && l.views > 0 && l.pctAssistido == null) viuSemPct = true
    if (l.views == null || l.views <= 0 || l.pctAssistido == null) continue
    soma += l.pctAssistido * l.views
    n += l.views
    dias.add(l.dia)
    videos.add(l.ytId)
  }
  if (n === 0) return { ...SEM_PCT, foraDoTeto, janela, motivo: viuSemPct ? 'sem-percentual' : 'sem-views' }
  return { pct: soma / n, n, dias: dias.size, videos: videos.size, janela, motivo: null, foraDoTeto }
}

/**
 * Views por dia, soma dos vídeos pedidos, nos 28 dias que terminam no último dia gravado. Dia com alguma linha de views é medido (a soma pode ser 0:
 * zero medido); dia sem linha com views é NÃO medido (nunca zero). Os dias saem no formato do gráfico por dia (`DiaAlcance`, o valor em `imp`, sem cliques).
 */
export function viewsDoCanalPorDia(d: Privado<DiarioCanal>, ytIds: readonly string[]): { periodo: Periodo | null; dias: DiaAlcance[]; foraDoTeto: number } {
  if (d.acesso !== 'ok' || d.dado.ultimoDia == null) return { periodo: null, dias: [], foraDoTeto: 0 }
  const ate = d.dado.ultimoDia
  const de = addDays(ate, -(JANELA_ASSISTIDO_DIAS - 1))
  const pedidos = new Set(ytIds)
  const soma = new Map<DiaYt, number>()
  for (const l of d.dado.linhas) {
    if (!pedidos.has(l.ytId) || l.views == null || l.dia < de || l.dia > ate) continue
    soma.set(l.dia, (soma.get(l.dia) ?? 0) + l.views)
  }
  const dias: DiaAlcance[] = []
  for (let dia = de; dia <= ate; dia = addDays(dia, 1)) {
    const v = soma.get(dia)
    if (v == null) dias.push({ dia, situacao: 'nao-medido', motivo: 'sem-relatorio', imp: null, cliques: null })
    else dias.push({ dia, situacao: v === 0 ? 'zero-medido' : 'com-impressoes', motivo: null, imp: v, cliques: null })
  }
  return { periodo: { de, ate, dias: JANELA_ASSISTIDO_DIAS }, dias, foraDoTeto: foraDoTetoDe(d.dado, ytIds) }
}

/** As views dos 28 dias que terminam no último dia gravado, de um vídeo. Nula quando ele não tem nenhuma linha com views (não medido, nunca 0). */
export function views28DoVideo(d: Privado<DiarioCanal>, ytId: string): number | null {
  if (d.acesso !== 'ok' || d.dado.ultimoDia == null) return null
  const ate = d.dado.ultimoDia
  const de = addDays(ate, -(JANELA_ASSISTIDO_DIAS - 1))
  let soma = 0
  let achou = false
  for (const l of d.dado.linhas) {
    if (l.ytId !== ytId || l.views == null || l.dia < de || l.dia > ate) continue
    soma += l.views
    achou = true
  }
  return achou ? soma : null
}

/**
 * Quantos dos dias esperados a soma de `views28DoVideo` realmente cobre. Esperados = os dias da janela de 28 que o vídeo já existia (da publicação, ou do
 * começo da janela se publicado antes, até o último dia gravado, os dois contam; no mínimo 1). Medidos = dias distintos do vídeo com views medidas (um dia
 * com zero view medido conta). Sem nenhuma linha com views: nula, como `views28DoVideo` (não medido nunca vira "0 de 28"). Com `medidos < esperados` as views
 * dos 28 dias estão SUBCONTADAS e a tela diz quantos dias foram medidos em vez de mostrar o número como se fosse cheio.
 */
export function cobertura28DoVideo(d: Privado<DiarioCanal>, ytId: string, publicadoEm: DiaYt | null): { medidos: number; esperados: number } | null {
  if (d.acesso !== 'ok' || d.dado.ultimoDia == null) return null
  const ate = d.dado.ultimoDia
  const de = addDays(ate, -(JANELA_ASSISTIDO_DIAS - 1))
  const dias = new Set<DiaYt>()
  for (const l of d.dado.linhas) {
    if (l.ytId !== ytId || l.views == null || l.dia < de || l.dia > ate) continue
    dias.add(l.dia)
  }
  if (dias.size === 0) return null
  const comeco = publicadoEm != null && publicadoEm > de ? publicadoEm : de
  const esperados = Math.max(1, diffDias(comeco, ate) + 1)
  return { medidos: dias.size, esperados }
}
