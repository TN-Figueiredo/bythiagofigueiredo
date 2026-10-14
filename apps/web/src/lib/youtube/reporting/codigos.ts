/**
 * Catálogo de códigos do Reporting API (lote) e dos nomes da Analytics API.
 * Puro: sem import de banco nem de rede. Um lugar só para traduzir código em rótulo.
 *
 * Fonte: páginas de dimensões do Reporting API (traffic_source_type, operating_system,
 * device_type) e da Analytics API (insightTrafficSourceType, deviceType, operatingSystem).
 * O campo `nome` só é preenchido quando o par foi conferido nas duas páginas; sem par
 * certo fica `null` (melhor "sem par" do que par errado).
 *
 * `detalhe` (que tipo de texto a origem carrega em `traffic_source_detail`) vem da seção
 * `traffic_source_detail` da documentação do Reporting API, que lista os tipos que têm detalhe e o
 * que ele é: 1 tipo de anúncio, 3 recurso do YouTube, 4 e 28 ID de canal, 5 termo de busca, 7 / 19 /
 * 20 / 27 / 30 ID de vídeo, 8 página, 9 URL externa, 17 tipo de notificação, 25 ID de produto,
 * 26 hashtag. Tipo que a documentação NÃO lista (0, 11, 14, 18, 23, 24, 29, 31, 32) é 'nenhum'.
 * Regra de privacidade para dúvida: entre "tem detalhe" e "nenhum", vale o que não deixa passar
 * texto de terceiros. Fora do catálogo, 'outro' (quem consome decide o que fazer com o detalhe).
 *
 * Valores da Analytics API sem código no lote (ficam fora, tratados como não catalogados):
 * origem CAMPAIGN_CARD, NO_LINK_EMBEDDED, PROMOTED, WATCH_WITH; aparelho AUTOMOTIVE, WEARABLE;
 * sistema DOCOMO.
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
  '3': { nome: 'SUBSCRIBER', rotulo: 'Recursos de navegação', detalhe: 'outro' },
  '4': { nome: 'YT_CHANNEL', rotulo: 'Canais do YouTube', detalhe: 'canal' },
  '5': { nome: 'YT_SEARCH', rotulo: 'Pesquisa do YouTube', detalhe: 'termo' },
  // Vídeos sugeridos. O 32 (Related video) tem texto parecido, mas o par com RELATED_VIDEO só
  // foi conferido para o 7: o 32 fica sem par.
  '7': { nome: 'RELATED_VIDEO', rotulo: 'Vídeos sugeridos', detalhe: 'video' },
  '8': { nome: 'YT_OTHER_PAGE', rotulo: 'Outros recursos do YouTube', detalhe: 'outro' },
  '9': { nome: 'EXT_URL', rotulo: 'Externa (links de outros sites)', detalhe: 'url' },
  '11': { nome: 'ANNOTATION', rotulo: 'Cards e anotações de vídeo', detalhe: 'nenhum' },
  '14': { nome: 'PLAYLIST', rotulo: 'Playlists', detalhe: 'nenhum' },
  '17': { nome: 'NOTIFICATION', rotulo: 'Notificações', detalhe: 'outro' },
  // A Analytics API não tem valor próprio para a página da playlist (PLAYLIST a inclui): sem par.
  '18': { nome: null, rotulo: 'Páginas de playlist', detalhe: 'nenhum' },
  '19': { nome: null, rotulo: 'Programação de conteúdo reivindicado', detalhe: 'video' },
  '20': { nome: 'END_SCREEN', rotulo: 'Tela final', detalhe: 'video' },
  '23': { nome: null, rotulo: 'Stories', detalhe: 'nenhum' },
  '24': { nome: 'SHORTS', rotulo: 'Shorts', detalhe: 'nenhum' },
  '25': { nome: 'PRODUCT_PAGE', rotulo: 'Páginas de produto', detalhe: 'outro' },
  '26': { nome: 'HASHTAGS', rotulo: 'Páginas de hashtag', detalhe: 'outro' },
  '27': { nome: 'SOUND_PAGE', rotulo: 'Páginas de som', detalhe: 'video' },
  '28': { nome: 'LIVE_REDIRECT', rotulo: 'Redirecionamento de live', detalhe: 'canal' },
  '29': { nome: null, rotulo: 'Podcasts', detalhe: 'nenhum' },
  '30': { nome: 'VIDEO_REMIXES', rotulo: 'Vídeo remixado', detalhe: 'video' },
  '31': { nome: null, rotulo: 'Feed vertical de lives', detalhe: 'nenhum' },
  '32': { nome: null, rotulo: 'Vídeo relacionado', detalhe: 'nenhum' },
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

const SEM_VALOR = 'sem valor'

function achar<T extends { nome: string | null }>(cat: Record<string, T>, valor: string): T | null {
  const direto = Object.hasOwn(cat, valor) ? cat[valor] : undefined
  if (direto) return direto
  for (const e of Object.values(cat)) {
    if (e.nome !== null && e.nome === valor) return e
  }
  return null
}

function rotular(cat: Record<string, IEntradaCodigo>, valor: string): IRotulo {
  const v = valor.trim()
  if (v === '') return { rotulo: SEM_VALOR, catalogado: false }
  const e = achar(cat, v)
  if (e) return { rotulo: e.rotulo, catalogado: true }
  return { rotulo: /^\d+$/.test(v) ? `código ${v}` : v, catalogado: false }
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
  const v = codigo.trim()
  return (Object.hasOwn(ORIGEM_LOTE, v) ? ORIGEM_LOTE[v]?.detalhe : undefined) ?? 'outro'
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
