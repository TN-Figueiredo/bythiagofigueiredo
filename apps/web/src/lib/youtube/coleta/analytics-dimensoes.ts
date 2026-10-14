// Dimensões da YouTube Analytics API por vídeo (A5 E11): origem de tráfego, aparelho e sistema, país e inscrito ou não.
// Uma função por consulta; lê por `columnHeaders[].name`, nunca por posição. O que não veio fica AUSENTE (nulo no
// banco), nunca zero. O `fetch` vem de fora, como em `analytics-diario.ts`. O corpo de erro do Google nunca é guardado.
import { AnalyticsApiError } from './analytics-diario'
import { motivoDoGoogle } from './google-erro'

const BASE = 'https://youtubeanalytics.googleapis.com/v2/reports'

export type Familia = 'traffic_source' | 'device_os' | 'country' | 'subscribed_status'

/**
 * `com_dia`: uma consulta por vídeo para a janela inteira, com `day` entre as dimensões.
 * `por_dia`: uma consulta por vídeo e dia (a combinação `day,country` é recusada pela API: conferência C0.2).
 * A conferência C0.2b pode trocar as três primeiras para `por_dia` mudando só esta constante.
 */
export const MODO_DA_FAMILIA: Readonly<Record<Familia, 'com_dia' | 'por_dia'>> = {
  traffic_source: 'com_dia',
  device_os: 'com_dia',
  subscribed_status: 'com_dia',
  country: 'por_dia',
}

export const DIMENSOES_DA_FAMILIA: Readonly<Record<Familia, string>> = {
  traffic_source: 'insightTrafficSourceType',
  device_os: 'deviceType,operatingSystem',
  country: 'country',
  subscribed_status: 'subscribedStatus',
}

const METRICAS_COM_ENGAGED = ['views', 'estimatedMinutesWatched', 'engagedViews'] as const
const METRICAS_SEM_ENGAGED = ['views', 'estimatedMinutesWatched'] as const

const DIA = /^\d{4}-\d{2}-\d{2}$/
// Cada parte da dimensão (a junção de `device_os` usa `|`): `|` dentro de uma parte tornaria a junção ambígua.
const PARTE = /^[A-Za-z0-9_]{1,40}$/
const PAIS = /^[A-Z]{2}$/

export interface LinhaDim {
  day: string
  /** Para `device_os`, `TIPO|SISTEMA` (por exemplo `MOBILE|ANDROID`). */
  valor: string
  views?: number
  engaged_views?: number
  watch_time_minutes?: number
}

/**
 * Erro da API com a conta das chamadas gastas (a Tarefa 7 soma a cota e o teto por execução).
 * Continua sendo `AnalyticsApiError` (mesma mensagem fixa, sem corpo do Google).
 */
export class AnalyticsDimensaoError extends AnalyticsApiError {
  constructor(status: number, reason: string | null, public readonly chamadas: number) {
    super(status, reason)
  }
}

/** Erro de programação do chamador (nunca vem do Google): nenhuma chamada foi feita. */
export class UsoInvalidoDimensoesError extends Error {
  readonly codigo = 'uso_invalido'
  readonly chamadas = 0
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'UsoInvalidoDimensoesError'
  }
}

export interface RespostaDimensao {
  linhas: LinhaDim[]
  /** `recusadas`: a API deu 400 para `engagedViews` e as linhas vêm sem ela. */
  estendidas: 'ok' | 'recusadas'
  /** Linhas descartadas por valor, país ou dia fora do formato ou da janela. */
  invalidas: number
  /** Chamadas à API gastas: 1, ou 2 quando `engagedViews` foi recusada e a consulta repetiu sem ela. */
  chamadas: number
}

interface Corpo {
  columnHeaders?: unknown
  rows?: unknown
}

function numeroOuNada(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

interface Entrada {
  token: string
  canalUc: string
  videoId: string
  familia: Familia
  inicio: string
  fim: string
  f: typeof fetch
}

function pedir(i: Entrada, metricas: readonly string[]): Promise<Response> {
  const dims = DIMENSOES_DA_FAMILIA[i.familia]
  const comDia = MODO_DA_FAMILIA[i.familia] === 'com_dia'
  const url = new URL(BASE)
  url.searchParams.set('ids', `channel==${i.canalUc}`)
  url.searchParams.set('startDate', i.inicio)
  url.searchParams.set('endDate', i.fim)
  url.searchParams.set('dimensions', comDia ? `day,${dims}` : dims)
  url.searchParams.set('filters', `video==${i.videoId}`)
  if (comDia) url.searchParams.set('sort', 'day')
  url.searchParams.set('metrics', metricas.join(','))
  return i.f(url.toString(), { headers: { Authorization: `Bearer ${i.token}` } })
}

export async function dimensaoDoVideo(i: Entrada): Promise<RespostaDimensao> {
  const comDia = MODO_DA_FAMILIA[i.familia] === 'com_dia'
  if (!comDia && i.inicio !== i.fim) {
    throw new UsoInvalidoDimensoesError(`A família ${i.familia} é consultada por dia: início e fim têm de ser o mesmo dia.`)
  }

  let chamadas = 1
  let estendidas: RespostaDimensao['estendidas'] = 'ok'
  let res = await pedir(i, METRICAS_COM_ENGAGED)
  if (res.status === 400) {
    estendidas = 'recusadas'
    chamadas = 2
    res = await pedir(i, METRICAS_SEM_ENGAGED)
  }
  if (!res.ok) throw new AnalyticsDimensaoError(res.status, await motivoDoGoogle(res), chamadas)
  // Forma estranha da resposta é erro de forma (vermelho), nunca zero nem linha sem número. Nenhum conteúdo da linha vai na mensagem.
  const forma = (reason: string) => new AnalyticsDimensaoError(200, reason, chamadas)

  let corpo: Corpo | null
  try {
    corpo = (await res.json()) as Corpo | null
  } catch {
    throw new AnalyticsDimensaoError(res.status, 'corpo_invalido', chamadas)
  }
  if (corpo === null || typeof corpo !== 'object' || !Array.isArray(corpo.columnHeaders)) throw forma('corpo_sem_cabecalho')

  // As colunas são conferidas ANTES de olhar as linhas: cabeçalho diferente do pedido é deriva de forma, mesmo num dia vazio.
  const nomes = (corpo.columnHeaders as unknown[]).map(c => (c !== null && typeof c === 'object' ? (c as { name?: unknown }).name : undefined))
  const nomesDim = DIMENSOES_DA_FAMILIA[i.familia].split(',')
  const posDim = nomesDim.map(n => nomes.indexOf(n))
  const faltaDim = nomesDim.find((_, k) => posDim[k]! < 0)
  if (faltaDim) throw forma(`sem_coluna_${faltaDim}`)
  const posDia = comDia ? nomes.indexOf('day') : -1
  if (comDia && posDia < 0) throw forma('sem_coluna_day')
  const posViews = nomes.indexOf('views')
  if (posViews < 0) throw forma('sem_coluna_views')
  const posMin = nomes.indexOf('estimatedMinutesWatched')
  const posEng = nomes.indexOf('engagedViews')

  // `rows` ausente ou nulo com o cabeçalho certo: o dia (ou a janela) não teve view. Não é erro e não inventa linha.
  const brutas = corpo.rows ?? []
  if (!Array.isArray(brutas)) throw forma('corpo_invalido')

  const linhas: LinhaDim[] = []
  const vistas = new Set<string>()
  let invalidas = 0
  for (const linha of brutas as unknown[]) {
    if (!Array.isArray(linha)) throw forma('corpo_invalido')
    const partes = posDim.map(p => linha[p])
    if (!partes.every((p): p is string => typeof p === 'string')) {
      invalidas++
      continue
    }
    if (partes.some(p => p.includes('|'))) throw forma('corpo_invalido')
    const valor = partes.join('|')
    const valorOk = i.familia === 'country' ? PAIS.test(valor) : partes.every(p => PARTE.test(p))
    const day = comDia ? linha[posDia] : i.inicio
    const diaOk = typeof day === 'string' && DIA.test(day) && day >= i.inicio && day <= i.fim
    if (!valorOk || !diaOk) {
      invalidas++
      continue
    }
    const views = numeroOuNada(linha[posViews])
    // views e engagedViews vão para colunas bigint: negativo ou fracionário derrubaria a gravação inteira no banco.
    if (views === undefined || views < 0 || !Number.isInteger(views)) throw forma('corpo_invalido')
    const chave = `${day}\u0000${valor}`
    if (vistas.has(chave)) throw forma('corpo_invalido')
    vistas.add(chave)
    const out: LinhaDim = { day, valor, views }
    if (posEng >= 0) {
      const e = numeroOuNada(linha[posEng])
      if (e !== undefined && (e < 0 || !Number.isInteger(e))) throw forma('corpo_invalido')
      if (e !== undefined) out.engaged_views = e
    }
    if (posMin >= 0) {
      const m = numeroOuNada(linha[posMin])
      if (m !== undefined && m < 0) throw forma('corpo_invalido')
      if (m !== undefined) out.watch_time_minutes = m
    }
    linhas.push(out)
  }
  return { linhas, estendidas, invalidas, chamadas }
}
