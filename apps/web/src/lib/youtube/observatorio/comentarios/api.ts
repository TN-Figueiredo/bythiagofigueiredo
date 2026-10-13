// A5 · E14: as quatro chamadas à YouTube Data API da coleta de comentários.
// Regras duras: o corpo de sucesso passa por `sanitizeForDb` na entrada (um ponto só); todo erro sai como `ComentariosErro`
// com mensagem FIXA (só o código): nenhum texto da API, nenhuma URL e nenhuma chave de API chega a exceção, log ou Sentry.
import { optCount, sanitizeForDb } from '../../competitor-capture'
import { ComentariosErro, type CodigoComentariosErro } from './erro'

const BASE_PADRAO = 'https://www.googleapis.com/youtube/v3'
/** A API recusa mais de 50 ids por chamada (`invalidFilters`). */
const IDS_MAX = 50
const RAZAO_OK = /^[A-Za-z]{1,40}$/
const RAZOES_DE_COTA: ReadonlySet<string> = new Set(['quotaExceeded', 'dailyLimitExceeded'])
/** Limite por segundo ou por usuário: passa sozinho, então NUNCA vira `proibido` (perda aceita). */
const RAZOES_DE_TAXA: ReadonlySet<string> = new Set(['rateLimitExceeded', 'userRateLimitExceeded'])

export interface ApiComentarios {
  conversas(videoId: string): Promise<unknown>
  inscritos(ids: string[]): Promise<unknown>
  porId(ids: string[]): Promise<unknown>
  contagem(videoId: string): Promise<number | null>
  unidades(): number
}

type Rec = Record<string, unknown>
const ehRec = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x)

function tempoEsgotado(e: unknown): boolean {
  const nome = typeof e === 'object' && e !== null ? (e as { name?: unknown }).name : undefined
  return nome === 'TimeoutError' || nome === 'AbortError'
}

/**
 * `error.errors[0].reason` do corpo de erro, só se tiver a forma de um código (letras, até 40). Corpo ilegível: null.
 * Corpo que estoura o tempo ao ser lido NÃO é "ilegível": lança `tempo_esgotado` (senão um 403 viraria `proibido`, perda aceita).
 */
async function razaoDe(res: Response): Promise<string | null> {
  try {
    const corpo: unknown = await res.json()
    const erro = ehRec(corpo) ? corpo.error : undefined
    const lista = ehRec(erro) && Array.isArray(erro.errors) ? erro.errors : []
    const primeiro: unknown = lista[0]
    const razao = ehRec(primeiro) ? primeiro.reason : undefined
    return typeof razao === 'string' && RAZAO_OK.test(razao) ? razao : null
  } catch (e) {
    if (tempoEsgotado(e)) throw new ComentariosErro('tempo_esgotado', res.status)
    return null
  }
}

function classificar(status: number, razao: string | null): CodigoComentariosErro {
  if (status === 403) {
    if (razao === 'commentsDisabled') return 'comentarios_desligados'
    if (razao !== null && RAZOES_DE_COTA.has(razao)) return 'cota_esgotada'
    if (razao !== null && RAZOES_DE_TAXA.has(razao)) return 'limite_de_taxa'
    return 'proibido'
  }
  if (status === 429) return 'limite_de_taxa'
  if (status === 408) return 'tempo_esgotado'
  if (status === 404 && razao === 'videoNotFound') return 'video_nao_encontrado'
  if (status === 400) return 'http_400'
  if (status >= 500) return 'http_5xx'
  return 'http_4xx'
}

export function criarApi(o: { apiKey: string; fetchImpl?: typeof fetch; timeoutMs: number; base?: string }): ApiComentarios {
  const fetchImpl = o.fetchImpl ?? fetch
  const base = o.base ?? BASE_PADRAO
  let unidades = 0

  /**
   * Uma chamada: soma a unidade ANTES do fetch, classifica o erro, limpa o corpo, exige `items` em lista.
   * `semItemsSeVazio`: só `channels.list` omite `items` quando nenhum id existe; com `pageInfo.totalResults === 0` (e sem `error`)
   * isso é "nenhum canal encontrado" (`items: []`). Sem o zero explícito continua sendo falha.
   */
  async function chamar(caminho: string, params: string, semItemsSeVazio = false): Promise<{ items: unknown[] } & Rec> {
    unidades++
    const url = `${base}/${caminho}?${params}&key=${encodeURIComponent(o.apiKey)}`
    let res: Response
    try {
      res = await fetchImpl(url, { signal: AbortSignal.timeout(o.timeoutMs) })
    } catch (e) {
      throw new ComentariosErro(tempoEsgotado(e) ? 'tempo_esgotado' : 'rede')
    }
    if (!res.ok) throw new ComentariosErro(classificar(res.status, await razaoDe(res)), res.status)

    let corpo: unknown
    try {
      corpo = await res.json()
    } catch (e) {
      // O erro do JSON.parse cita um pedaço do corpo: troca pela mensagem fixa.
      throw new ComentariosErro(tempoEsgotado(e) ? 'tempo_esgotado' : 'resposta_ilegivel', res.status)
    }
    if (!ehRec(corpo)) throw new ComentariosErro('resposta_ilegivel', res.status)
    const limpo = sanitizeForDb(corpo).value
    if (limpo.error === undefined && semItemsSeVazio && limpo.items === undefined && ehRec(limpo.pageInfo) && limpo.pageInfo.totalResults === 0) {
      return { ...limpo, items: [] }
    }
    if (limpo.error !== undefined || !Array.isArray(limpo.items)) throw new ComentariosErro('resposta_sem_lista', res.status)
    return { ...limpo, items: limpo.items }
  }

  function idsValidos(ids: string[]): void {
    // Erro de programação do chamador: nada foi pedido, nada foi gasto.
    if (ids.length > IDS_MAX) throw new ComentariosErro('http_400')
  }
  const lista = (ids: string[]): string => ids.map(encodeURIComponent).join(',')

  return {
    conversas: (videoId) => chamar('commentThreads',
      `part=snippet,replies&videoId=${encodeURIComponent(videoId)}&order=relevance&maxResults=100&textFormat=plainText`),
    async inscritos(ids) {
      idsValidos(ids)
      if (ids.length === 0) return { items: [] }
      return chamar('channels', `part=statistics&id=${lista(ids)}`, true)
    },
    async porId(ids) {
      idsValidos(ids)
      if (ids.length === 0) return { items: [] }
      return chamar('comments', `part=snippet&id=${lista(ids)}&textFormat=plainText`)
    },
    async contagem(videoId) {
      const corpo = await chamar('videos', `part=statistics&id=${encodeURIComponent(videoId)}`)
      const primeiro = corpo.items[0]
      const stats = ehRec(primeiro) && ehRec(primeiro.statistics) ? primeiro.statistics : undefined
      return optCount(stats?.commentCount)
    },
    unidades: () => unidades,
  }
}
