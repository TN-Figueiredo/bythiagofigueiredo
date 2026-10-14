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
const VALOR = /^[A-Za-z0-9_|]{1,80}$/
const PAIS = /^[A-Z]{2}$/

export interface LinhaDim {
  day: string
  /** Para `device_os`, `TIPO|SISTEMA` (por exemplo `MOBILE|ANDROID`). */
  valor: string
  views?: number
  engaged_views?: number
  watch_time_minutes?: number
}

export interface RespostaDimensao {
  linhas: LinhaDim[]
  /** `recusadas`: a API deu 400 para `engagedViews` e as linhas vêm sem ela. */
  estendidas: 'ok' | 'recusadas'
  /** Linhas descartadas por valor, país ou dia fora do formato ou da janela. */
  invalidas: number
}

interface Corpo {
  columnHeaders?: Array<{ name?: string }>
  rows?: unknown[][]
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
    throw new Error(`Família ${i.familia} é consultada por dia: inicio e fim têm de ser o mesmo dia.`)
  }

  let estendidas: RespostaDimensao['estendidas'] = 'ok'
  let res = await pedir(i, METRICAS_COM_ENGAGED)
  if (res.status === 400) {
    estendidas = 'recusadas'
    res = await pedir(i, METRICAS_SEM_ENGAGED)
  }
  if (!res.ok) throw new AnalyticsApiError(res.status, await motivoDoGoogle(res))

  let corpo: Corpo
  try {
    corpo = (await res.json()) as Corpo
  } catch {
    throw new AnalyticsApiError(res.status, 'corpo_invalido')
  }
  if (!Array.isArray(corpo.columnHeaders)) throw new AnalyticsApiError(200, 'corpo_sem_cabecalho')

  // Cabeçalho presente e nenhuma linha: o dia (ou a janela) não teve view. Não é erro e não inventa linha.
  if ((corpo.rows ?? []).length === 0) return { linhas: [], estendidas, invalidas: 0 }

  const nomes = corpo.columnHeaders.map(c => c.name)
  const nomesDim = DIMENSOES_DA_FAMILIA[i.familia].split(',')
  const posDim = nomesDim.map(n => nomes.indexOf(n))
  const faltaDim = nomesDim.find((_, k) => posDim[k]! < 0)
  if (faltaDim) throw new AnalyticsApiError(200, `sem_coluna_${faltaDim}`)
  const posDia = comDia ? nomes.indexOf('day') : -1
  if (comDia && posDia < 0) throw new AnalyticsApiError(200, 'sem_coluna_day')
  const posViews = nomes.indexOf('views')
  if (posViews < 0) throw new AnalyticsApiError(200, 'sem_coluna_views')
  const posMin = nomes.indexOf('estimatedMinutesWatched')
  const posEng = nomes.indexOf('engagedViews')

  const linhas: LinhaDim[] = []
  let invalidas = 0
  for (const linha of corpo.rows ?? []) {
    const partes = posDim.map(p => linha[p])
    if (!partes.every((p): p is string => typeof p === 'string')) {
      invalidas++
      continue
    }
    const valor = partes.join('|')
    const valorOk = i.familia === 'country' ? PAIS.test(valor) : VALOR.test(valor)
    const day = comDia ? linha[posDia] : i.inicio
    const diaOk = typeof day === 'string' && DIA.test(day) && day >= i.inicio && day <= i.fim
    if (!valorOk || !diaOk) {
      invalidas++
      continue
    }
    const out: LinhaDim = { day, valor }
    const views = numeroOuNada(linha[posViews])
    if (views !== undefined) out.views = views
    if (posEng >= 0) {
      const e = numeroOuNada(linha[posEng])
      if (e !== undefined) out.engaged_views = e
    }
    if (posMin >= 0) {
      const m = numeroOuNada(linha[posMin])
      if (m !== undefined) out.watch_time_minutes = m
    }
    linhas.push(out)
  }
  return { linhas, estendidas, invalidas }
}
