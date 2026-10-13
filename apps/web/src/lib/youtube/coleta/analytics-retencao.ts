// Curva de retenção por vídeo da YouTube Analytics API (A5 E8): uma consulta por vídeo, `dimensions=elapsedVideoTimeRatio`.
// Lê por `columnHeaders[].name`, nunca por posição. O que não veio fica NULO, nunca zero; forma estranha é erro, não curva.
// O `fetch` vem de fora (quem chama passa o do prazo do passo). O corpo de erro do Google nunca é guardado.
import { AnalyticsApiError } from './analytics-diario'
import { motivoDoGoogle } from './google-erro'

const BASE = 'https://youtubeanalytics.googleapis.com/v2/reports'

/**
 * `startedWatching` e `stoppedWatching` ficam de fora de propósito: com esta dimensão a API responde 500 ou 200 vazio
 * (conferência C0.1).
 */
export const METRICAS_RETENCAO = ['audienceWatchRatio', 'relativeRetentionPerformance', 'totalSegmentImpressions'] as const
export const METRICAS_RETENCAO_BASICAS = ['audienceWatchRatio', 'relativeRetentionPerformance'] as const

export interface PontoRetencao {
  /** Fração decorrida do vídeo, de 0 a 1. */
  t: number
  /** Não é cortado: pode passar de 1 (a API conta releituras). */
  ratio: number
  relative: number | null
  segment_impressions: number | null
}

export interface RespostaRetencao {
  /** Ordenados por `t`. Vazio quando a API não tem curva para o vídeo e a janela (200 com `rows: []`; não é erro). */
  pontos: PontoRetencao[]
  /** As métricas nossas presentes no cabeçalho da resposta que valeu. */
  metricas: string[]
  /** Chamadas à API gastas (1 a 3). */
  chamadas: number
}

/**
 * Erro da API com a conta das chamadas gastas (a Tarefa 9 soma a cota por execução).
 * Continua sendo `AnalyticsApiError` (mesma mensagem fixa, só com o status; nunca o corpo do Google).
 */
export class AnalyticsRetencaoError extends AnalyticsApiError {
  constructor(status: number, reason: string | null, public readonly chamadas: number) {
    super(status, reason)
  }
}

/**
 * Chamada com id que não tem a forma do YouTube. Erro NOSSO de uso (nenhuma chamada foi gasta): o código do catálogo
 * é `excecao` (`motivoDoErro` devolve o mesmo), e a mensagem em português não leva o valor recusado.
 */
export class UsoInvalidoRetencaoError extends Error {
  readonly codigo = 'excecao'
  constructor(campo: 'videoId' | 'canalUc') {
    super(`${campo} inválido para a consulta de retenção`)
    this.name = 'UsoInvalidoRetencaoError'
  }
}

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/
const CANAL_UC_RE = /^UC[A-Za-z0-9_-]{22}$/

type Entrada = { token: string; canalUc: string; videoId: string; inicio: string; fim: string; f: typeof fetch }

function pedir(i: Entrada, metricas: readonly string[]): Promise<Response> {
  const url = new URL(BASE)
  url.searchParams.set('ids', `channel==${i.canalUc}`)
  url.searchParams.set('startDate', i.inicio)
  url.searchParams.set('endDate', i.fim)
  url.searchParams.set('dimensions', 'elapsedVideoTimeRatio')
  url.searchParams.set('filters', `video==${i.videoId};audienceType==ORGANIC`)
  url.searchParams.set('metrics', metricas.join(','))
  // Sem `sort`: a chamada conferida na C0.1 não tinha.
  return i.f(url.toString(), { headers: { Authorization: `Bearer ${i.token}` } })
}

/** Só número JSON finito. Texto, mesmo numérico, não é número aqui. */
const finito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export async function retencaoDoVideo(i: Entrada): Promise<RespostaRetencao> {
  if (!CANAL_UC_RE.test(i.canalUc)) throw new UsoInvalidoRetencaoError('canalUc')
  if (!VIDEO_ID_RE.test(i.videoId)) throw new UsoInvalidoRetencaoError('videoId')
  let chamadas = 1
  let basicas = false
  let repetiu500 = false
  let res = await pedir(i, METRICAS_RETENCAO)
  // No máximo 3 chamadas: 400 -> básicas; 500 -> a mesma uma vez, e de novo 500 -> básicas. Nunca se repete a básica.
  for (;;) {
    if (res.ok) break
    if (res.status === 400 && !basicas) {
      basicas = true
    } else if (res.status === 500 && !basicas && !repetiu500) {
      repetiu500 = true
    } else if (res.status === 500 && !basicas) {
      basicas = true
    } else {
      throw new AnalyticsRetencaoError(res.status, await motivoDoGoogle(res), chamadas)
    }
    chamadas += 1
    // A resposta descartada não fica com a conexão pendurada.
    void res.body?.cancel().catch(() => undefined)
    res = await pedir(i, basicas ? METRICAS_RETENCAO_BASICAS : METRICAS_RETENCAO)
  }

  // Forma estranha é erro de forma, nunca curva. Nenhum conteúdo da resposta vai na mensagem.
  const forma = () => new AnalyticsRetencaoError(200, 'forma_inesperada', chamadas)

  let corpo: unknown
  try {
    corpo = await res.json()
  } catch {
    throw new AnalyticsRetencaoError(res.status, 'corpo_invalido', chamadas)
  }
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) throw forma()
  const { columnHeaders, rows } = corpo as { columnHeaders?: unknown; rows?: unknown }
  // `rows` ausente (chave não veio) com o cabeçalho certo é "sem curva", como `rows: []`; null ou não-lista é forma estranha.
  if (!Array.isArray(columnHeaders) || (rows !== undefined && !Array.isArray(rows))) throw forma()

  // As colunas são conferidas ANTES de olhar as linhas: cabeçalho diferente do pedido é deriva de forma, mesmo vazio.
  const nomes = (columnHeaders as unknown[]).map(c =>
    c !== null && typeof c === 'object' ? (c as { name?: unknown }).name : undefined,
  )
  const posT = nomes.indexOf('elapsedVideoTimeRatio')
  const posRatio = nomes.indexOf('audienceWatchRatio')
  if (posT < 0 || posRatio < 0) throw forma()
  const posRelative = nomes.indexOf('relativeRetentionPerformance')
  const posImpressoes = nomes.indexOf('totalSegmentImpressions')
  const metricas = METRICAS_RETENCAO.filter(m => nomes.includes(m)) as string[]

  /** Ausente ou nulo: nulo (nunca 0). Presente e não-número: forma estranha. */
  const opcional = (linha: unknown[], pos: number): number | null => {
    if (pos < 0) return null
    const v = linha[pos]
    if (v === null || v === undefined) return null
    if (!finito(v)) throw forma()
    return v
  }

  const vistos = new Set<number>()
  const pontos: PontoRetencao[] = []
  for (const linha of (rows ?? []) as unknown[]) {
    if (!Array.isArray(linha)) throw forma()
    const t = linha[posT]
    const ratio = linha[posRatio]
    if (!finito(t) || !finito(ratio) || t < 0 || t > 1 || ratio < 0) throw forma()
    if (vistos.has(t)) throw forma()
    vistos.add(t)
    pontos.push({ t, ratio, relative: opcional(linha, posRelative), segment_impressions: opcional(linha, posImpressoes) })
  }
  pontos.sort((a, b) => a.t - b.t)
  return { pontos, metricas, chamadas }
}
