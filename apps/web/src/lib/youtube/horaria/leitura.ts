/**
 * As chamadas da leitura horária (A5 E16, Tarefa 8): `videos.list` da YouTube Data API, em blocos de 50 ids,
 * em ondas de até 4 blocos em paralelo.
 *
 * Este módulo não chama o Sentry e não devolve texto: a falha é um tipo de uma lista fechada mais o número do HTTP.
 * Depois de um 403 de cota nenhuma onda nova começa (os ids que sobraram vão para `idsQueFicaram`).
 * A chave de API só existe dentro da URL passada ao `fetch`; a URL e o corpo do erro nunca saem daqui.
 * Dado ausente: contagem que a API não deu é nula (ou `semContagem`), nunca zero; HTTP 200 sem lista de itens é
 * falha do bloco, não "ninguém foi devolvido".
 */
import { optCount } from '@/lib/youtube/competitor-capture'
import { HORARIA_CHAMADA_MS } from '@/lib/youtube/agenda/relogio'
import { RULES } from '@/lib/youtube/observatorio/rules'

export interface Contagem { ytId: string; lidoEm: string; views: number; likes: number | null; comments: number | null; privacidade: string | null }
export type FalhaLeitura = 'api_http' | 'api_sem_lista' | 'api_tempo' | 'api_cota' | 'api_vazia'
export interface ResultadoLeitura {
  contagens: Contagem[]
  chamadas: number
  falhas: number
  idsQueFicaram: string[]
  naoDevolvidos: number
  idsNaoDevolvidos: string[]
  semContagem: number
  aoVivo: number
  cotaEsgotada: boolean
  primeiraFalha?: { tipo: FalhaLeitura; http: number | null }
}

/** A `YOUTUBE_API_BASE` de `competitor-sync.ts` é privada; esta é a daqui. */
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'
const PARTES = 'statistics,liveStreamingDetails,status'
const BLOCO = 50
const ONDA = 4
const RAZOES_DE_COTA: ReadonlySet<string> = new Set(['quotaExceeded', 'dailyLimitExceeded'])

type Rec = Record<string, unknown>
const isRec = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x)
const textoNaoVazio = (x: unknown): boolean => typeof x === 'string' && x.length > 0

/** Resultado de um bloco, antes de entrar no total. */
interface Bloco {
  ids: string[]
  falha?: { tipo: FalhaLeitura; http: number | null }
  cota?: boolean
  contagens: Contagem[]
  devolvidos: Set<string>
  semContagem: number
  aoVivo: number
}

const tempoEsgotado = (e: unknown): boolean => {
  const nome = isRec(e) || e instanceof Error ? (e as { name?: unknown }).name : undefined
  return nome === 'TimeoutError' || nome === 'AbortError'
}

/** 403 de cota: lê a razão do corpo (sem guardar o texto). Corpo ilegível não é cota. */
async function eCota(res: Response): Promise<boolean> {
  try {
    const corpo: unknown = await res.json()
    const erro = isRec(corpo) ? corpo.error : undefined
    const lista = isRec(erro) && Array.isArray(erro.errors) ? erro.errors : []
    return lista.some(e => isRec(e) && typeof e.reason === 'string' && RAZOES_DE_COTA.has(e.reason))
  } catch {
    return false
  }
}

async function lerBloco(ids: string[], apiKey: string, fetchImpl: typeof fetch, agora: () => number): Promise<Bloco> {
  const b: Bloco = { ids, contagens: [], devolvidos: new Set(), semContagem: 0, aoVivo: 0 }
  const falhou = (tipo: FalhaLeitura, http: number | null): Bloco => { b.falha = { tipo, http }; return b }

  let res: Response
  try {
    res = await fetchImpl(`${YOUTUBE_API_BASE}/videos?part=${PARTES}&id=${ids.map(encodeURIComponent).join(',')}&key=${encodeURIComponent(apiKey)}`, {
      signal: AbortSignal.timeout(HORARIA_CHAMADA_MS),
    })
  } catch (e) {
    return tempoEsgotado(e) ? falhou('api_tempo', null) : falhou('api_http', null)
  }
  const lidoEm = new Date(agora()).toISOString()

  if (!res.ok) {
    if (res.status === 403 && await eCota(res)) { b.cota = true; return falhou('api_cota', 403) }
    return falhou('api_http', res.status)
  }

  let corpo: unknown
  try {
    corpo = await res.json()
  } catch (e) {
    return tempoEsgotado(e) ? falhou('api_tempo', null) : falhou('api_sem_lista', null)
  }
  if (!isRec(corpo) || corpo.error !== undefined || !Array.isArray(corpo.items)) return falhou('api_sem_lista', null)
  if (corpo.items.length === 0 && ids.length > RULES.hourly.emptyAnswerMin) return falhou('api_vazia', null)

  const pedidos = new Set(ids)
  for (const it of corpo.items) {
    if (!isRec(it) || typeof it.id !== 'string' || !pedidos.has(it.id) || b.devolvidos.has(it.id)) continue
    b.devolvidos.add(it.id)

    const live = isRec(it.liveStreamingDetails) ? it.liveStreamingDetails : undefined
    if (live && textoNaoVazio(live.actualStartTime) && !textoNaoVazio(live.actualEndTime)) { b.aoVivo++; continue }

    const st = isRec(it.statistics) ? it.statistics : undefined
    const views = st ? optCount(st.viewCount) : null
    if (views === null || views < 0) { b.semContagem++; continue }

    const status = isRec(it.status) ? it.status : undefined
    b.contagens.push({
      ytId: it.id,
      lidoEm,
      views,
      likes: optCount(st?.likeCount),
      comments: optCount(st?.commentCount),
      privacidade: typeof status?.privacyStatus === 'string' ? status.privacyStatus : null,
    })
  }
  return b
}

export async function lerContadores(
  ytIds: readonly string[],
  o: { apiKey: string; fetchImpl?: typeof fetch; agora?: () => number; podeComecar: () => boolean },
): Promise<ResultadoLeitura> {
  const fetchImpl = o.fetchImpl ?? fetch
  const agora = o.agora ?? Date.now
  const unicos = [...new Set(ytIds.filter(id => typeof id === 'string' && id.length > 0))]
  const blocos: string[][] = []
  for (let i = 0; i < unicos.length; i += BLOCO) blocos.push(unicos.slice(i, i + BLOCO))

  const r: ResultadoLeitura = {
    contagens: [], chamadas: 0, falhas: 0, idsQueFicaram: [], naoDevolvidos: 0, idsNaoDevolvidos: [],
    semContagem: 0, aoVivo: 0, cotaEsgotada: false,
  }

  for (let i = 0; i < blocos.length; i += ONDA) {
    if (!o.podeComecar()) {
      for (const b of blocos.slice(i)) r.idsQueFicaram.push(...b)
      break
    }
    const onda = blocos.slice(i, i + ONDA)
    r.chamadas += onda.length
    const feitos = await Promise.all(onda.map(ids => lerBloco(ids, o.apiKey, fetchImpl, agora)))
    for (const b of feitos) {
      if (b.falha) {
        r.falhas++
        r.idsQueFicaram.push(...b.ids)
        if (!r.primeiraFalha) r.primeiraFalha = b.falha
        if (b.cota) r.cotaEsgotada = true
        continue
      }
      r.contagens.push(...b.contagens)
      r.semContagem += b.semContagem
      r.aoVivo += b.aoVivo
      for (const id of b.ids) {
        if (!b.devolvidos.has(id)) { r.naoDevolvidos++; r.idsNaoDevolvidos.push(id) }
      }
    }
    // cota esgotada: os blocos em voo terminaram acima; nenhuma onda nova começa e o que sobrou é contado
    if (r.cotaEsgotada) {
      for (const b of blocos.slice(i + ONDA)) r.idsQueFicaram.push(...b)
      break
    }
  }
  return r
}
