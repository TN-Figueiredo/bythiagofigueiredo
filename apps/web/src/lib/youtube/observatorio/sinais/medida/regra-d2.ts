// F2b, núcleo puro da medida da hipótese D2 ("destino esquentou"): constantes, métricas e montagem dos pares.
// Sem banco, sem relógio, sem import da leitura (§3.7: nenhum leitor paralelo).
import { addDays, dayPt, diffDias } from '../../../coleta/day-pt'
import { JANELA_DIAS } from '../../../coleta/e11-config'
import { ORIGEM_DE_BUSCA, ORIGEM_LOTE } from '../../../reporting/codigos'

export const REGRA_D2 = {
  versao: 1,
  preDias: 28,
  posDias: 30,
  fechaReportingEmDias: 34,
  // pós + janela de revisão da coleta (a Analytics revisa os últimos JANELA_DIAS dias) + 1 dia para o último dia sair da revisão
  fechaAnalyticsEmDias: 30 + JANELA_DIAS + 1,
  desisteEmDias: 60,
  pisoPre: 30,
  eventosMinimos: 10,
  folgaV0Dias: 2,
  limiteVistosDias: 120,
} as const

export const VERSAO_REGRA_D2 = `d2-v${REGRA_D2.versao}`

export type FonteD2 = 'R1' | 'R2' | 'R3' | 'R4' | 'R5'

export type MetricaD2 =
  | 'views_total' | 'impressoes_total' | 'impressoes_busca' | 'impressoes_canal' | 'impressoes_sugeridos' | 'impressoes_inicio'
  | 'views_sugeridos' | 'views_busca' | 'views_inicio' | 'prova_related'

/** Linha de descarte do par inteiro (não é métrica medida). */
export type MetricaLinha = MetricaD2 | 'par'

export const FONTE_DA_METRICA: Record<MetricaD2, FonteD2> = {
  views_total: 'R1',
  impressoes_total: 'R2',
  impressoes_busca: 'R3',
  impressoes_canal: 'R3',
  impressoes_sugeridos: 'R3',
  impressoes_inicio: 'R3',
  views_sugeridos: 'R4',
  views_busca: 'R4',
  views_inicio: 'R4',
  prova_related: 'R5',
}

/** O código da origem pelo NOME do YouTube, sempre lido da tabela de `reporting/codigos.ts`. */
function codigoDe(nome: string): string {
  const achado = Object.entries(ORIGEM_LOTE).find(([, e]) => e.nome === nome)
  if (!achado) throw new Error(`origem desconhecida: ${nome}`)
  return achado[0]
}

/** Códigos de R3/R5 (reporting) e nomes de R4 (Analytics `insightTrafficSourceType`) por métrica. */
export const CODIGO_DA_METRICA: Record<Exclude<MetricaD2, 'views_total' | 'impressoes_total'>, string> = {
  impressoes_busca: ORIGEM_DE_BUSCA,
  impressoes_canal: codigoDe('YT_CHANNEL'),
  impressoes_sugeridos: codigoDe('RELATED_VIDEO'),
  impressoes_inicio: codigoDe('SUBSCRIBER'),
  views_sugeridos: 'RELATED_VIDEO',
  views_busca: 'YT_SEARCH',
  views_inicio: 'SUBSCRIBER',
  prova_related: codigoDe('RELATED_VIDEO'),
}

export type MotivoDescarte = 'pre_contaminado' | 'contaminacao_desconhecida' | 'sem_alvo' | 'sem_controle'

/** Par vindo da fila do banco (chave já resolvida, A7). `chavesEmEvento`: outros eventos `destino` quentes na janela. */
export interface ParDaFila { id: string; chave: string; publicadoEm: string; chavesEmEvento: string[] }

export interface ProprioD2 {
  id: string
  youtubeId: string
  publicadoEm: string
  /** chaves de lugar do vídeo (`video_lugares`) */
  chaves: string[]
  semLugar: boolean
}

export interface EntradaPares {
  pares: ParDaFila[]
  /** chave -> `published_at` dos outliers vistos com ela */
  vistosPorChave: Map<string, string[]>
  proprios: ProprioD2[]
  /** id do par -> youtube ids de `evidence.proprios` do sinal */
  alvoDeEvidence: Map<string, string[]>
  v0: string | null
  hoje: string
}

export interface Par {
  id: string
  chave: string
  pubDia: string
  preInicio: string
  preFim: string
  posInicio: string
  posFim: string
  /** youtube ids */
  alvo: string[]
  controle: string[]
  chavesEmEvento: string[]
  descarte: MotivoDescarte | null
}

const diaDe = (iso: string): string => (iso.length === 10 ? iso : dayPt(new Date(iso)))

/** Menor índice com `a[i] >= x` (a ordenado). */
function primeiroMaiorOuIgual(a: string[], x: string): number {
  let lo = 0
  let hi = a.length
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (a[m]! < x) lo = m + 1
    else hi = m
  }
  return lo
}

export function contarProprios(proprios: ProprioD2[]): { semLugar: number } {
  return { semLugar: proprios.filter(p => p.semLugar).length }
}

export function montarPares(e: EntradaPares): Par[] {
  // dias de publicação por chave, ordenados uma vez
  const diasPorChave = new Map<string, string[]>()
  for (const [k, pubs] of e.vistosPorChave) diasPorChave.set(k, pubs.map(diaDe).sort())
  const v0Dia = e.v0 === null ? null : diaDe(e.v0)
  const medidos = e.proprios.filter(p => !p.semLugar)

  return e.pares.map((p): Par => {
    const pubDia = diaDe(p.publicadoEm)
    const preInicio = addDays(pubDia, -REGRA_D2.preDias)
    const preFim = addDays(pubDia, -1)
    const base = {
      id: p.id, chave: p.chave, pubDia, preInicio, preFim,
      posInicio: addDays(pubDia, 1), posFim: addDays(pubDia, REGRA_D2.posDias),
      chavesEmEvento: p.chavesEmEvento,
    }
    const descarta = (descarte: MotivoDescarte, alvo: string[] = [], controle: string[] = []): Par => ({ ...base, alvo, controle, descarte })

    if (v0Dia === null || diffDias(addDays(v0Dia, -REGRA_D2.folgaV0Dias), preInicio) < 0) return descarta('contaminacao_desconhecida')
    const dias = diasPorChave.get(p.chave) ?? []
    const i = primeiroMaiorOuIgual(dias, preInicio)
    if (i < dias.length && dias[i]! <= preFim) return descarta('pre_contaminado')

    const antes = (x: ProprioD2): boolean => diaDe(x.publicadoEm) < preInicio
    const idsAlvo = new Set(e.alvoDeEvidence.get(p.id) ?? [])
    const alvo = medidos.filter(x => idsAlvo.has(x.youtubeId) && antes(x)).map(x => x.youtubeId)
    if (alvo.length === 0) return descarta('sem_alvo')
    const controle = medidos.filter(x => !x.chaves.includes(p.chave) && !idsAlvo.has(x.youtubeId) && antes(x)).map(x => x.youtubeId)
    if (controle.length === 0) return descarta('sem_controle', alvo)
    return { ...base, alvo, controle, descarte: null }
  })
}
