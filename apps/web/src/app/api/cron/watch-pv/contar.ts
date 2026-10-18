/**
 * Contagem pura de uma página de watch (portão P-V da S4). Sem rede, sem espera, sem regex com `.*?` sobre o corpo.
 * Rota temporária: sai no lote da S4 (Tarefa 14 do plano).
 */
export const VIDEO_PV = 'qIg9a7vqcNo'

/** Os 15 ids da rajada (vídeos próprios públicos) mais o do teste, nesta ordem. */
export const IDS_RAJADA: readonly string[] = [
  'S1iMQVIOFL4', 'r_3QZBKHqU8', 'L7AAl8-2eAw', 'N6UYPe1XBXM', 'l2ZcAWDBqX4', 'BKczyNOMdoc', 'c-854vZoH1M',
  'P5QuSE1gL78', 'iLVy8mcEvwk', 'HSKiot-PDm8', 'q57zkJR-kMo', 'yJl_YzInZ3U', 'IZM5b1aq1J0', 'eibJk0L8zzc',
  'JWjvfUozxY0', VIDEO_PV,
]

export interface ContagemPv {
  http: number
  renderers: number
  braco: 'A' | 'B' | '?'
  hl: string | null
  gl: string | null
  oficial: boolean
  consentimento: boolean
  roboSemTitulo: boolean
  jogadorBloqueado: boolean
}

const RENDERERS = ['"videoPrimaryInfoRenderer"', '"playerOverlayVideoDetailsRenderer"', '"videoTitleHeaderViewModel"'] as const
// O B é sufixo do A (TITULO_B de carregar.ts): as aspas de abertura são obrigatórias.
const REGEX_B = /"Consist[^"]{0,30}Compromisso \(Part 4\)"/
const REGEX_A = /5 - Como somos controlados - Consist[^"]{0,40}Part 4\)/
const VALOR_CURTO = /^[A-Za-z0-9-]{1,12}$/

function valorDe(html: string, chave: string): string | null {
  const marcador = `"${chave}":"`
  const i = html.indexOf(marcador)
  if (i < 0) return null
  const ini = i + marcador.length
  const fim = html.indexOf('"', ini)
  if (fim < 0 || fim - ini > 12) return null
  const valor = html.slice(ini, fim)
  return VALOR_CURTO.test(valor) ? valor : null
}

function temOficial(html: string, v: string): boolean {
  const og = '<meta property="og:title" content="'
  const i = html.indexOf(og)
  if (i >= 0 && html.charAt(i + og.length) !== '"' && i + og.length < html.length) return true
  // `"videoDetails":{}` (vazio) não conta: exige o videoId do vídeo e um title em até 4 KB.
  const vd = `"videoDetails":{"videoId":"${v}"`
  const j = html.indexOf(vd)
  if (j < 0) return false
  const janela = html.slice(j, j + 4096)
  const k = janela.indexOf('"title":"')
  return k >= 0 && janela.charAt(k + 9) !== '"'
}

export function contarPagina(html: string, status: number, redirecionadoPara: string | null, v: string = VIDEO_PV): ContagemPv {
  const renderers = RENDERERS.reduce((n, r) => n + (html.indexOf(r) >= 0 ? 1 : 0), 0)
  // Sem os 3 renderers o título A também aparece em videoDetails/og:title: o braço seria falso.
  const braco: ContagemPv['braco'] =
    renderers === 3 ? (REGEX_B.test(html) ? 'B' : REGEX_A.test(html) ? 'A' : '?') : '?'
  const minusculo = html.toLowerCase()
  const textoRobo = minusculo.indexOf('not a bot') >= 0 || minusculo.indexOf('não é um robô') >= 0
  const loginRequired = html.indexOf('"LOGIN_REQUIRED"') >= 0
  return {
    http: status,
    renderers,
    braco,
    hl: valorDe(html, 'HL'),
    gl: valorDe(html, 'GL'),
    oficial: temOficial(html, v),
    consentimento: (redirecionadoPara?.indexOf('consent.youtube.com') ?? -1) >= 0 || html.indexOf('consent.youtube.com') >= 0,
    roboSemTitulo: renderers === 0 && (textoRobo || loginRequired),
    jogadorBloqueado: renderers > 0 && loginRequired,
  }
}

/** Uma rodada é mista quando, entre as leituras com braço conhecido, aparecem A e B. */
export function rodadaMista(bracos: ReadonlyArray<ContagemPv['braco']>): boolean {
  const conhecidos = bracos.filter((b) => b !== '?')
  return conhecidos.includes('A') && conhecidos.includes('B')
}
