// Parser da página watch (A5 S4, Tarefa 4). Texto de terceiros: indexOf + varredura de chaves, nunca regex `.*?` sobre o corpo.
import { RENDERERS_TITULO, normalizarTitulo } from '@/lib/youtube/teste-youtube'

export const VERSAO_LEITOR = 2

export type CodigoErroWatch =
  | 'http_429' | 'http_4xx' | 'http_5xx' | 'consentimento' | 'redirecionado' | 'verificacao_robo'
  | 'indisponivel' | 'sem_initial_data' | 'sem_idioma' | 'timeout' | 'rede' | 'parser' | 'fora_do_formato'

export const CODIGOS_BLOQUEIO: ReadonlySet<CodigoErroWatch> = new Set<CodigoErroWatch>(['consentimento', 'verificacao_robo', 'http_429'])

export interface ExtracaoWatch {
  erro: CodigoErroWatch | null
  titulosExibidos: Array<{ renderer: string; texto: string | null }>
  tituloOficial: string | null
  titulo_oficial_fonte: 'videoDetails' | 'og_title' | null
  idioma: string | null
  rendicoesSqp: number | null
  jogadorBloqueado: boolean
}

const PROFUNDIDADE_MAX = 60
const MARCADORES_DATA = ['var ytInitialData = ', 'window["ytInitialData"] = ', 'ytInitialData = '] as const
const MARCADORES_PLAYER = ['var ytInitialPlayerResponse = ', 'window["ytInitialPlayerResponse"] = ', 'ytInitialPlayerResponse = '] as const
const MARCADOR_CFG = 'ytcfg.set('
const REGEX_IDIOMA = /^[a-z]{2,3}(-([A-Z]{2}|[0-9]{3}))?$/

/** Fim (exclusivo) do objeto que começa em `ini` (deve ser `{`), respeitando strings e escapes; -1 se não fecha. */
function fimDoObjeto(s: string, ini: number): number {
  let d = 0
  let emString = false
  let esc = false
  for (let j = ini; j < s.length; j++) {
    const c = s.charCodeAt(j)
    if (emString) {
      if (esc) esc = false
      else if (c === 92) esc = true
      else if (c === 34) emString = false
    } else if (c === 34) emString = true
    else if (c === 123) d++
    else if (c === 125) {
      d--
      if (d === 0) return j + 1
    }
  }
  return -1
}

/** JSON do objeto que segue `marcador` (1ª ocorrência em diante); null se ausente ou ilegível. */
export function jsonApos(html: string, marcador: string): unknown | null {
  let de = 0
  for (;;) {
    const i = html.indexOf(marcador, de)
    if (i < 0) return null
    const ini = i + marcador.length
    if (html.charCodeAt(ini) === 123) {
      const fim = fimDoObjeto(html, ini)
      if (fim > 0) {
        try {
          return JSON.parse(html.slice(ini, fim)) as unknown
        } catch {
          // segue para a próxima ocorrência
        }
      }
    }
    de = ini
  }
}

function jsonDeUm(html: string, marcadores: readonly string[]): unknown | null {
  for (const m of marcadores) {
    const v = jsonApos(html, m)
    if (v !== null) return v
  }
  return null
}

type Obj = Record<string, unknown>
function ehObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Primeiro nó (pré-ordem) com a chave `chave`, até a profundidade máxima. */
function acharChave(v: unknown, chave: string, prof = 0): unknown | undefined {
  if (prof > PROFUNDIDADE_MAX) return undefined
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = acharChave(x, chave, prof + 1)
      if (r !== undefined) return r
    }
  } else if (ehObj(v)) {
    if (chave in v) return v[chave]
    for (const x of Object.values(v)) {
      const r = acharChave(x, chave, prof + 1)
      if (r !== undefined) return r
    }
  }
  return undefined
}

function textoDoRenderer(renderer: string, no: unknown): string | null {
  if (!ehObj(no)) return null
  let bruto: string | null = null
  if (renderer === 'videoPrimaryInfoRenderer') {
    const t = no.title
    if (ehObj(t) && Array.isArray(t.runs)) {
      bruto = t.runs.map((r) => (ehObj(r) && typeof r.text === 'string' ? r.text : '')).join('')
    }
  } else if (renderer === 'playerOverlayVideoDetailsRenderer') {
    const t = no.title
    if (ehObj(t) && typeof t.simpleText === 'string') bruto = t.simpleText
  } else if (renderer === 'videoTitleHeaderViewModel') {
    const t = no.videoTitle
    if (ehObj(t) && typeof t.content === 'string') bruto = t.content
  }
  if (bruto === null || normalizarTitulo(bruto) === '') return null
  return bruto
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
function decodificarEntidades(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-z]{2,6});/g, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m
    }
    return ENTIDADES[e] ?? m
  })
}

function ogTitle(html: string): string | null {
  const m = '<meta property="og:title" content="'
  const i = html.indexOf(m)
  if (i < 0) return null
  const ini = i + m.length
  const fim = html.indexOf('"', ini)
  if (fim < 0 || fim - ini > 2000) return null
  const t = decodificarEntidades(html.slice(ini, fim))
  return normalizarTitulo(t) === '' ? null : t
}

export function normalizarIdioma(hl: string | null, gl: string | null): string | null {
  if (hl === null || hl === '') return null
  const r = hl.includes('-') ? hl : gl !== null && gl !== '' ? `${hl}-${gl}` : hl
  return REGEX_IDIOMA.test(r) ? r : null
}

function idiomaDe(html: string): string | null {
  const cfg = jsonApos(html, MARCADOR_CFG)
  if (!ehObj(cfg)) return null
  const hl = typeof cfg.HL === 'string' ? cfg.HL : null
  const gl = typeof cfg.GL === 'string' ? cfg.GL : null
  return normalizarIdioma(hl, gl)
}

function contarSqp(html: string, ytId: string): number {
  const alvo = `ytimg.com/vi/${ytId}/`
  const distintos = new Set<string>()
  let de = 0
  for (;;) {
    const i = html.indexOf(alvo, de)
    if (i < 0) break
    de = i + alvo.length
    const janela = html.slice(de, de + 400)
    const q = janela.indexOf('?sqp=')
    if (q < 0 || q > 100 || /["'\s<>\\]/.test(janela.slice(0, q))) continue
    const resto = janela.slice(q + 5)
    let f = 0
    while (f < resto.length && /[A-Za-z0-9_%=+/-]/.test(resto[f] as string)) f++
    if (f > 0) distintos.add(resto.slice(0, f))
  }
  return distintos.size
}

const VAZIO = (erro: CodigoErroWatch, rendicoesSqp: number | null = null): ExtracaoWatch => ({
  erro,
  titulosExibidos: RENDERERS_TITULO.map((renderer) => ({ renderer, texto: null })),
  tituloOficial: null,
  titulo_oficial_fonte: null,
  idioma: null,
  rendicoesSqp,
  jogadorBloqueado: false,
})

function extrair(html: string, ytId: string): ExtracaoWatch {
  const data = jsonDeUm(html, MARCADORES_DATA)
  const player = jsonDeUm(html, MARCADORES_PLAYER)
  const sqp = contarSqp(html, ytId)

  const exibidos = RENDERERS_TITULO.map((renderer) => ({ renderer: renderer as string, texto: textoDoRenderer(renderer, acharChave(data, renderer)) }))
  const renderersPresentes = RENDERERS_TITULO.filter((r) => acharChave(data, r) !== undefined).length
  const algumTexto = exibidos.some((t) => t.texto !== null)

  const status = ehObj(player) && ehObj(player.playabilityStatus) && typeof player.playabilityStatus.status === 'string'
    ? player.playabilityStatus.status
    : null

  if (data === null && !algumTexto) {
    if (html.includes('consent.youtube.com')) return VAZIO('consentimento', sqp)
    const min = html.toLowerCase()
    if (status === 'LOGIN_REQUIRED' || min.includes('not a bot') || min.includes('não é um robô')) return VAZIO('verificacao_robo', sqp)
    return VAZIO('sem_initial_data', sqp)
  }
  if (!algumTexto && (status === 'ERROR' || status === 'UNPLAYABLE')) return VAZIO('indisponivel', sqp)
  if (!algumTexto && status === 'LOGIN_REQUIRED') return VAZIO('verificacao_robo', sqp)

  let tituloOficial: string | null = null
  let fonte: ExtracaoWatch['titulo_oficial_fonte'] = null
  const vd = ehObj(player) && ehObj(player.videoDetails) ? player.videoDetails : null
  if (vd !== null && typeof vd.title === 'string' && normalizarTitulo(vd.title) !== '') {
    tituloOficial = vd.title
    fonte = 'videoDetails'
  } else {
    const og = ogTitle(html)
    if (og !== null) {
      tituloOficial = og.endsWith(' - YouTube') ? og.slice(0, -' - YouTube'.length) : og
      fonte = 'og_title'
    }
  }

  const idioma = idiomaDe(html)
  if (idioma === null && (algumTexto || tituloOficial !== null)) return VAZIO('sem_idioma', sqp)
  return {
    erro: null,
    titulosExibidos: exibidos,
    tituloOficial,
    titulo_oficial_fonte: fonte,
    idioma,
    rendicoesSqp: sqp,
    jogadorBloqueado: status === 'LOGIN_REQUIRED' && renderersPresentes >= 1,
  }
}

/** Nunca lança: exceção interna vira `erro: 'parser'`. */
export function extrairDaWatch(html: string, ytId: string): ExtracaoWatch {
  try {
    return extrair(html, ytId)
  } catch {
    return VAZIO('parser')
  }
}
