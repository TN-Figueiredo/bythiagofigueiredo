// Leitor anônimo da watch (A5 S4, Tarefa 6). Nunca lança por falha de página/transporte; erro de opção lança TypeError antes da rede.
import { leituraWatchSchema, RENDERERS_TITULO, type LeituraWatch } from '@/lib/youtube/teste-youtube'
import { ACCEPT_LANGUAGE_LEITOR, USER_AGENT_LEITOR, urlWatch } from './cabecalhos'
import { sondarMiniatura } from './miniatura'
import { extrairDaWatch, type CodigoErroWatch } from './parser'

export interface OpcoesLeitor {
  rodadaId: string
  origemRede: 'vercel' | 'forja' | 'mac-casa'
  fetchImpl?: typeof fetch
  agora?: () => number
  timeoutMs?: number
  sondarMiniatura?: boolean
}

export interface ResultadoLeitor {
  leitura: LeituraWatch
  http: number | null
  jogadorBloqueado: boolean
}

const REGEX_ID = /^[A-Za-z0-9_-]{11}$/
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ORIGENS: ReadonlySet<string> = new Set(['vercel', 'forja', 'mac-casa'])

class TempoEsgotado extends Error {}

function validarOpcoes(ytId: string, opts: OpcoesLeitor): void {
  if (typeof ytId !== 'string' || !REGEX_ID.test(ytId)) throw new TypeError('ytId inválido')
  if (typeof opts.rodadaId !== 'string' || !REGEX_UUID.test(opts.rodadaId)) throw new TypeError('rodadaId deve ser uuid')
  if (!ORIGENS.has(opts.origemRede)) throw new TypeError('origemRede fora do catálogo')
  if (opts.timeoutMs !== undefined && !(Number.isFinite(opts.timeoutMs) && opts.timeoutMs > 0)) throw new TypeError('timeoutMs inválido')
}

function leituraDeErro(ytId: string, opts: OpcoesLeitor, lidaEm: number, erro: CodigoErroWatch, rendicoesSqp: number | null = null): LeituraWatch {
  return {
    youtubeVideoId: ytId,
    lidaEm: new Date(lidaEm).toISOString(),
    rodadaId: opts.rodadaId,
    origemRede: opts.origemRede,
    idioma: null,
    erro,
    tituloOficial: null,
    titulo_oficial_fonte: null,
    rendicoesSqp,
    titulosExibidos: RENDERERS_TITULO.map((renderer) => ({ renderer, texto: null })),
    miniaturas: [],
  }
}

function codigoDeStatus(status: number, location: string | null): CodigoErroWatch | null {
  if (status >= 300 && status < 400) return (location ?? '').includes('consent.youtube.com') ? 'consentimento' : 'redirecionado'
  if (status === 429) return 'http_429'
  if (status >= 400 && status < 500) return 'http_4xx'
  if (status >= 500) return 'http_5xx'
  return null
}

/** Corre o texto contra o sinal: um fetch falso que ignora o sinal ainda vira `timeout`. */
function textoComSinal(res: Response, sinal: AbortSignal): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (sinal.aborted) return reject(new TempoEsgotado())
    const aoAbortar = (): void => reject(new TempoEsgotado())
    sinal.addEventListener('abort', aoAbortar, { once: true })
    res.text().then(
      (t) => { sinal.removeEventListener('abort', aoAbortar); resolve(t) },
      (e: unknown) => { sinal.removeEventListener('abort', aoAbortar); reject(e) },
    )
  })
}

function ehTempo(e: unknown, sinal: AbortSignal): boolean {
  if (sinal.aborted || e instanceof TempoEsgotado) return true
  return typeof e === 'object' && e !== null && 'name' in e && (e.name === 'AbortError' || e.name === 'TimeoutError')
}

/** A miniatura dura no máximo o que resta do prazo da leitura (e 5 s); com menos de 1 s de sobra, não se sonda. */
async function miniaturaDentroDoPrazo(ytId: string, f: typeof fetch, restanteMs: number): Promise<LeituraWatch['miniaturas']> {
  if (restanteMs < 1_000) return []
  return [await sondarMiniatura(ytId, f, Math.min(5_000, restanteMs))]
}

export async function lerWatchSemCookie(ytId: string, opts: OpcoesLeitor): Promise<ResultadoLeitor> {
  validarOpcoes(ytId, opts)
  const f = opts.fetchImpl ?? fetch
  const agora = opts.agora ?? Date.now
  const timeoutTotal = opts.timeoutMs ?? 10_000
  const sinal = AbortSignal.timeout(timeoutTotal)
  const inicioMs = agora()

  const falha = (erro: CodigoErroWatch, http: number | null, sqp: number | null = null): ResultadoLeitor =>
    ({ leitura: leituraDeErro(ytId, opts, agora(), erro, sqp), http, jogadorBloqueado: false })

  let status: number
  let html = ''
  let codigo: CodigoErroWatch | null
  try {
    const res = await f(urlWatch(ytId), {
      method: 'GET',
      headers: { 'user-agent': USER_AGENT_LEITOR, 'accept-language': ACCEPT_LANGUAGE_LEITOR },
      redirect: 'manual',
      cache: 'no-store',
      signal: sinal,
    })
    status = res.status
    codigo = codigoDeStatus(status, res.headers.get('location'))
    if (codigo === null) html = await textoComSinal(res, sinal)
    else void res.body?.cancel().catch(() => undefined)
  } catch (e) {
    return falha(ehTempo(e, sinal) ? 'timeout' : 'rede', null)
  }
  if (codigo !== null) return falha(codigo, status)

  try {
    const ex = extrairDaWatch(html, ytId)
    if (ex.erro !== null) return falha(ex.erro, status, ex.rendicoesSqp)
    const lidaEm = agora()
    const bruta: LeituraWatch = {
      youtubeVideoId: ytId,
      lidaEm: new Date(lidaEm).toISOString(),
      rodadaId: opts.rodadaId,
      origemRede: opts.origemRede,
      idioma: ex.idioma,
      erro: null,
      tituloOficial: ex.tituloOficial,
      titulo_oficial_fonte: ex.titulo_oficial_fonte,
      rendicoesSqp: ex.rendicoesSqp,
      titulosExibidos: ex.titulosExibidos,
      miniaturas: opts.sondarMiniatura === true ? await miniaturaDentroDoPrazo(ytId, f, timeoutTotal - (agora() - inicioMs)) : [],
    }
    const ok = leituraWatchSchema.safeParse(bruta)
    if (!ok.success) return falha('parser', status)
    return { leitura: ok.data, http: status, jogadorBloqueado: ex.jogadorBloqueado }
  } catch {
    return falha('parser', status)
  }
}
