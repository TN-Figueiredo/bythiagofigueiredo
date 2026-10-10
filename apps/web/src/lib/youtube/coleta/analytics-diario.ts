// Diário por vídeo da YouTube Analytics API (spec, seção 6 — lote L2): uma chamada por vídeo, `dimensions=day`.
// Lê por `columnHeaders[].name`, nunca por posição. O que não veio fica AUSENTE (vira nulo no banco), nunca zero.
// O `fetch` vem de fora: quem chama passa o do prazo do passo. O corpo de erro do Google nunca é guardado.
import { motivoDoGoogle } from './google-erro'

const BASE = 'https://youtubeanalytics.googleapis.com/v2/reports'

export type ColunaDiario =
  | 'views' | 'engaged_views' | 'watch_time_minutes' | 'avg_view_duration_seconds' | 'avg_view_percentage'
  | 'likes' | 'comments' | 'shares' | 'subscribers_gained' | 'subscribers_lost' | 'card_impressions' | 'card_click_rate'

export const METRICAS_BASE: readonly string[] = [
  'views', 'estimatedMinutesWatched', 'averageViewDuration', 'averageViewPercentage',
  'likes', 'comments', 'shares', 'subscribersGained', 'subscribersLost',
]
/** Podem ser recusadas (400) por canal ou vídeo; nesse caso a chamada se repete só com a base. */
export const METRICAS_ESTENDIDAS: readonly string[] = ['engagedViews', 'cardImpressions', 'cardClickRate']

const COLUNA_DA_METRICA: Readonly<Record<string, ColunaDiario>> = {
  views: 'views',
  engagedViews: 'engaged_views',
  estimatedMinutesWatched: 'watch_time_minutes',
  averageViewDuration: 'avg_view_duration_seconds',
  averageViewPercentage: 'avg_view_percentage',
  likes: 'likes',
  comments: 'comments',
  shares: 'shares',
  subscribersGained: 'subscribers_gained',
  subscribersLost: 'subscribers_lost',
  cardImpressions: 'card_impressions',
  cardClickRate: 'card_click_rate',
}

const DIA = /^\d{4}-\d{2}-\d{2}$/

/** Resposta não-ok (ou ilegível) da Analytics API. Leva só o status e o `reason`; nunca o corpo. */
export class AnalyticsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string | null,
  ) {
    super(`YouTube Analytics API HTTP ${status}`)
    this.name = 'AnalyticsApiError'
  }
}

export interface DiaDoVideo {
  day: string
  /** Só o que veio. Métrica ausente não tem chave (nulo, nunca zero). */
  valores: Partial<Record<ColunaDiario, number>>
}

export interface RespostaDiario {
  dias: DiaDoVideo[]
  /** `recusadas`: a API deu 400 para a lista estendida e os dias vêm só com a base. */
  estendidas: 'ok' | 'recusadas'
}

interface Corpo {
  columnHeaders?: Array<{ name?: string }>
  rows?: unknown[][]
}

function numeroOuNada(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  // Texto vazio ou só de espaços não é número: Number('  ') é 0, e "nulo, nunca zero".
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function pedir(
  i: { token: string; canalUc: string; videoId: string; inicio: string; fim: string; f: typeof fetch },
  metricas: readonly string[],
): Promise<Response> {
  const url = new URL(BASE)
  url.searchParams.set('ids', `channel==${i.canalUc}`)
  url.searchParams.set('startDate', i.inicio)
  url.searchParams.set('endDate', i.fim)
  url.searchParams.set('dimensions', 'day')
  url.searchParams.set('filters', `video==${i.videoId}`)
  url.searchParams.set('sort', 'day')
  url.searchParams.set('metrics', metricas.join(','))
  return i.f(url.toString(), { headers: { Authorization: `Bearer ${i.token}` } })
}

export async function diarioDoVideo(i: {
  token: string
  canalUc: string
  videoId: string
  inicio: string
  fim: string
  f: typeof fetch
}): Promise<RespostaDiario> {
  let estendidas: RespostaDiario['estendidas'] = 'ok'
  let res = await pedir(i, [...METRICAS_BASE, ...METRICAS_ESTENDIDAS])
  if (res.status === 400) {
    estendidas = 'recusadas'
    res = await pedir(i, METRICAS_BASE)
  }
  if (!res.ok) throw new AnalyticsApiError(res.status, await motivoDoGoogle(res))

  let corpo: Corpo
  try {
    corpo = (await res.json()) as Corpo
  } catch {
    throw new AnalyticsApiError(res.status, 'corpo_invalido')
  }

  const linhas = corpo.rows ?? []
  if (linhas.length === 0) return { dias: [], estendidas }

  const nomes = (corpo.columnHeaders ?? []).map(c => c.name)
  const posDia = nomes.indexOf('day')
  if (posDia < 0) throw new AnalyticsApiError(200, 'sem_coluna_day')

  const dias: DiaDoVideo[] = []
  for (const linha of linhas) {
    const day = linha[posDia]
    if (typeof day !== 'string' || !DIA.test(day)) throw new AnalyticsApiError(200, 'dia_invalido')
    const valores: Partial<Record<ColunaDiario, number>> = {}
    nomes.forEach((nome, pos) => {
      const coluna = nome ? COLUNA_DA_METRICA[nome] : undefined
      if (!coluna) return
      const n = numeroOuNada(linha[pos])
      if (n !== undefined) valores[coluna] = n
    })
    dias.push({ day, valores })
  }
  return { dias, estendidas }
}
