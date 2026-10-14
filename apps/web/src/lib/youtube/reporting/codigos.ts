/**
 * Catálogo de códigos do Reporting API (lote) e dos nomes da Analytics API.
 * Puro: sem import de banco nem de rede. Um lugar só para traduzir código em rótulo.
 *
 * Fonte: páginas de dimensões do Reporting API (traffic_source_type, operating_system,
 * device_type) e da Analytics API (insightTrafficSourceType, deviceType, operatingSystem).
 * O campo `nome` só é preenchido quando o par foi conferido nas duas páginas; sem par
 * certo fica `null` (melhor "sem par" do que par errado).
 */

export type TipoDetalhe = 'termo' | 'url' | 'video' | 'canal' | 'outro' | 'nenhum'

export interface IEntradaOrigem {
  nome: string | null
  rotulo: string
  detalhe: TipoDetalhe
}

export interface IEntradaCodigo {
  nome: string | null
  rotulo: string
}

export interface IRotulo {
  rotulo: string
  catalogado: boolean
}

export const ORIGEM_DE_BUSCA = '5'
export const ORIGEM_EXTERNA = '9'

export const ORIGEM_LOTE: Record<string, IEntradaOrigem> = {
  '0': { nome: 'NO_LINK_OTHER', rotulo: 'Direto ou desconhecido', detalhe: 'nenhum' },
  '1': { nome: 'ADVERTISING', rotulo: 'Publicidade no YouTube', detalhe: 'outro' },
  '3': { nome: 'SUBSCRIBER', rotulo: 'Recursos de navegação', detalhe: 'nenhum' },
  '4': { nome: 'YT_CHANNEL', rotulo: 'Canais do YouTube', detalhe: 'canal' },
  '5': { nome: 'YT_SEARCH', rotulo: 'Pesquisa do YouTube', detalhe: 'termo' },
  // Vídeos sugeridos. O 32 (Related video) tem texto parecido, mas o par com RELATED_VIDEO só
  // foi conferido para o 7: o 32 fica sem par.
  '7': { nome: 'RELATED_VIDEO', rotulo: 'Vídeos sugeridos', detalhe: 'video' },
  '8': { nome: 'YT_OTHER_PAGE', rotulo: 'Outros recursos do YouTube', detalhe: 'outro' },
  '9': { nome: 'EXT_URL', rotulo: 'Externa (links de outros sites)', detalhe: 'url' },
  '11': { nome: 'ANNOTATION', rotulo: 'Cards e anotações de vídeo', detalhe: 'video' },
  '14': { nome: 'PLAYLIST', rotulo: 'Playlists', detalhe: 'outro' },
  '17': { nome: 'NOTIFICATION', rotulo: 'Notificações', detalhe: 'outro' },
  // A Analytics API não tem valor próprio para a página da playlist (PLAYLIST a inclui): sem par.
  '18': { nome: null, rotulo: 'Páginas de playlist', detalhe: 'outro' },
  '19': { nome: null, rotulo: 'Programação de conteúdo reivindicado', detalhe: 'outro' },
  '20': { nome: 'END_SCREEN', rotulo: 'Tela final', detalhe: 'video' },
  '23': { nome: null, rotulo: 'Stories', detalhe: 'outro' },
  '24': { nome: 'SHORTS', rotulo: 'Shorts', detalhe: 'nenhum' },
  '25': { nome: 'PRODUCT_PAGE', rotulo: 'Páginas de produto', detalhe: 'outro' },
  '26': { nome: 'HASHTAGS', rotulo: 'Páginas de hashtag', detalhe: 'outro' },
  '27': { nome: 'SOUND_PAGE', rotulo: 'Páginas de som', detalhe: 'outro' },
  '28': { nome: 'LIVE_REDIRECT', rotulo: 'Redirecionamento de live', detalhe: 'nenhum' },
  '29': { nome: null, rotulo: 'Podcasts', detalhe: 'outro' },
  '30': { nome: 'VIDEO_REMIXES', rotulo: 'Vídeo remixado', detalhe: 'video' },
  '31': { nome: null, rotulo: 'Feed vertical de lives', detalhe: 'nenhum' },
  '32': { nome: null, rotulo: 'Vídeo relacionado', detalhe: 'video' },
}

export const APARELHO_LOTE: Record<string, IEntradaCodigo> = {
  '100': { nome: 'UNKNOWN_PLATFORM', rotulo: 'Desconhecido' },
  '101': { nome: 'DESKTOP', rotulo: 'Computador' },
  '102': { nome: 'TV', rotulo: 'TV' },
  '103': { nome: 'GAME_CONSOLE', rotulo: 'Console de videogame' },
  '104': { nome: 'MOBILE', rotulo: 'Celular' },
  '105': { nome: 'TABLET', rotulo: 'Tablet' },
}

// 1 a 32, sem o 8 (que não existe na documentação).
export const SISTEMA_LOTE: Record<string, IEntradaCodigo> = {
  '1': { nome: 'OTHER', rotulo: 'Outro' },
  '2': { nome: 'WINDOWS', rotulo: 'Windows' },
  '3': { nome: 'WINDOWS_MOBILE', rotulo: 'Windows Mobile' },
  '4': { nome: 'ANDROID', rotulo: 'Android' },
  '5': { nome: 'IOS', rotulo: 'iOS' },
  '6': { nome: 'SYMBIAN', rotulo: 'Symbian' },
  '7': { nome: 'BLACKBERRY', rotulo: 'BlackBerry' },
  '9': { nome: 'MACINTOSH', rotulo: 'Macintosh' },
  '10': { nome: 'PLAYSTATION', rotulo: 'PlayStation' },
  '11': { nome: 'BADA', rotulo: 'Bada' },
  '12': { nome: 'WEBOS', rotulo: 'webOS' },
  '13': { nome: 'LINUX', rotulo: 'Linux' },
  '14': { nome: 'HIPTOP', rotulo: 'Hiptop' },
  '15': { nome: 'MEEGO', rotulo: 'MeeGo' },
  '16': { nome: 'WII', rotulo: 'Wii' },
  '17': { nome: 'XBOX', rotulo: 'Xbox' },
  '18': { nome: 'PLAYSTATION_VITA', rotulo: 'PlayStation Vita' },
  '19': { nome: 'SMART_TV', rotulo: 'Smart TV' },
  '20': { nome: 'NINTENDO_3DS', rotulo: 'Nintendo 3DS' },
  '21': { nome: 'CHROMECAST', rotulo: 'Chromecast' },
  '22': { nome: 'TIZEN', rotulo: 'Tizen' },
  '23': { nome: 'FIREFOX', rotulo: 'Firefox OS' },
  '24': { nome: 'REALMEDIA', rotulo: 'RealMedia' },
  '25': { nome: 'KAIOS', rotulo: 'KaiOS' },
  '26': { nome: null, rotulo: 'Roku' },
  '27': { nome: null, rotulo: 'Nintendo Switch' },
  '28': { nome: null, rotulo: 'Apple tvOS' },
  '29': { nome: null, rotulo: 'Fire OS' },
  '30': { nome: null, rotulo: 'ChromeOS' },
  '31': { nome: 'VIDAA', rotulo: 'Vidaa' },
  '32': { nome: null, rotulo: 'VegaOS' },
}

function achar<T extends { nome: string | null }>(cat: Record<string, T>, valor: string): T | null {
  const direto = Object.hasOwn(cat, valor) ? cat[valor] : undefined
  if (direto) return direto
  for (const e of Object.values(cat)) {
    if (e.nome !== null && e.nome === valor) return e
  }
  return null
}

function rotular(cat: Record<string, IEntradaCodigo>, valor: string): IRotulo {
  const e = achar(cat, valor)
  if (e) return { rotulo: e.rotulo, catalogado: true }
  return { rotulo: /^\d+$/.test(valor) ? `código ${valor}` : valor, catalogado: false }
}

/** Aceita o código do lote ou o nome da Analytics API. */
export function rotuloOrigem(valor: string): IRotulo {
  return rotular(ORIGEM_LOTE, valor)
}

export function rotuloAparelho(valor: string): IRotulo {
  return rotular(APARELHO_LOTE, valor)
}

export function rotuloSistema(valor: string): IRotulo {
  return rotular(SISTEMA_LOTE, valor)
}

/** Que tipo de detalhe privado a origem carrega; fora do catálogo, 'outro'. */
export function tipoDoDetalhe(codigo: string): TipoDetalhe {
  return (Object.hasOwn(ORIGEM_LOTE, codigo) ? ORIGEM_LOTE[codigo]?.detalhe : undefined) ?? 'outro'
}

/**
 * Motivos fechados do normalizador. É o único texto que vai à coluna `error` de
 * `yt_reporting_reports` nesta etapa: o CÓDIGO. A frase sai da função abaixo.
 */
export const MOTIVOS_NORMALIZADOR = [
  'bruto_ausente',
  'gzip_invalido',
  'cabecalho_inesperado',
  'linha_invalida',
  'canal_inesperado',
  'dia_inesperado',
  'recusado_pelo_banco',
] as const

export type MotivoNormalizador = (typeof MOTIVOS_NORMALIZADOR)[number]

const FRASES: Record<MotivoNormalizador, string> = {
  bruto_ausente: 'o arquivo bruto do relatório não está guardado',
  gzip_invalido: 'o arquivo do relatório não abriu (compactação inválida)',
  cabecalho_inesperado: 'o cabeçalho do relatório não é o esperado',
  linha_invalida: 'o relatório tem uma linha que não pôde ser lida',
  canal_inesperado: 'o relatório traz linhas de outro canal',
  dia_inesperado: 'o relatório traz um dia fora do esperado',
  recusado_pelo_banco: 'o banco recusou a gravação das linhas do relatório',
}

export function motivoNormalizadorHumano(codigo: string): string {
  return Object.hasOwn(FRASES, codigo) ? FRASES[codigo as MotivoNormalizador] : 'motivo não catalogado'
}
