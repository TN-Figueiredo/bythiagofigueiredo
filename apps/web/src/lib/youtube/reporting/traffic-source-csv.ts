// Leitor do CSV de `channel_traffic_source_a3` (origem de tráfego por vídeo e dia). Puro: sem banco, sem rede.
// Escrito contra o cabeçalho REAL (15 colunas); o teste roda sobre o arquivo exportado, com o detalhe mascarado.
// Campo com aspas é linha inválida, nunca lido por aproximação. País e inscrito são somados (a tabela é por
// vídeo, dia, origem e detalhe). O detalhe da origem pode ser termo pesquisado, dado privado: nenhuma mensagem
// de erro daqui leva o conteúdo de linha alguma.
import { createHash } from 'node:crypto'
import { cleanText } from '@/lib/youtube/competitor-capture'

export const CABECALHO_TRAFEGO = [
  'date', 'channel_id', 'video_id', 'live_or_on_demand', 'subscribed_status', 'country_code',
  'traffic_source_type', 'traffic_source_detail', 'views', 'engaged_views', 'watch_time_minutes',
  'average_view_duration_seconds', 'average_view_duration_percentage', 'red_views', 'red_watch_time_minutes',
] as const

export class CsvTrafegoError extends Error {
  constructor(public readonly motivo: 'cabecalho_inesperado' | 'linha_invalida') {
    super(`CSV de tráfego: ${motivo}`)
    this.name = 'CsvTrafegoError'
  }
}

export interface LinhaTrafego {
  /** AAAA-MM-DD, o dia como veio do relatório (só reformatado). */
  day: string
  channelId: string
  videoId: string
  /** Código da origem como veio ('4', '5', '8', '9'...). */
  sourceType: string
  /** Detalhe bruto da linha (só aparado): quem agrega normaliza. */
  detail: string
  views: number
  watchTimeMinutes: number
}

export interface DetalheDoDia {
  day: string
  videoId: string
  sourceType: string
  /** Até 300 pontos de código (`cortarDetalhe`). */
  detail: string
  /** sha256 hexadecimal do detalhe normalizado INTEIRO, antes do corte. */
  detailHash: string
  views: number
  watchTimeMinutes: number
}

/** Linhas agregadas e a contagem das que somaram zero e saíram. Objeto simples: sobrevive a `.map`, spread e JSON. */
export interface TrafegoAgregado {
  linhas: DetalheDoDia[]
  descartadasZeradas: number
}

const DATA = /^(\d{4})(\d{2})(\d{2})$/
const INTEIRO = /^\d+$/
/** Decimal sem sinal, hexadecimal nem binário; aceita notação científica (o YouTube emite 1.0E-4 para valor minúsculo). */
const NUMERO = /^\d+(\.\d+)?([eE][+-]?\d+)?$/
/** Teto de minutos por linha: acima disso (9e300) é lixo, e a soma em agregarTrafego nunca chega a Infinity. */
const LIMITE_MINUTOS = 1e9
const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/
const ID_CANAL = /^UC[A-Za-z0-9_-]{22}$/
const TIPO = /^[A-Za-z0-9_]{1,40}$/
/** Origem "site externo": o detalhe é uma URL, que pode carregar query e fragmento (e e-mail dentro). */
const ORIGEM_EXTERNA = '9'
const LIMITE_DETALHE = 300

/** Confere ano, mês e dia pelo calendário (20260229 e 20261345 não existem). */
function dataExiste(ano: number, mes: number, dia: number): boolean {
  if (ano < 1) return false
  const t = new Date(Date.UTC(ano, mes - 1, dia))
  t.setUTCFullYear(ano) // Date.UTC trata anos 0–99 como 1900–1999
  return t.getUTCFullYear() === ano && t.getUTCMonth() === mes - 1 && t.getUTCDate() === dia
}

export function lerTrafego(csv: string): LinhaTrafego[] {
  const linhas = csv.split(/\r?\n/).filter(l => l.trim().length > 0)
  const cab = (linhas[0] ?? '').split(',').map(c => c.trim())
  const esperado: readonly string[] = CABECALHO_TRAFEGO
  if (cab.length !== esperado.length || !esperado.every(c => cab.includes(c))) throw new CsvTrafegoError('cabecalho_inesperado')
  const pos = (nome: string) => cab.indexOf(nome)
  const iData = pos('date')
  const iCanal = pos('channel_id')
  const iVideo = pos('video_id')
  const iTipo = pos('traffic_source_type')
  const iDetalhe = pos('traffic_source_detail')
  const iViews = pos('views')
  const iMin = pos('watch_time_minutes')

  return linhas.slice(1).map((l) => {
    const c = l.split(',').map(x => x.trim())
    if (c.length !== cab.length || l.includes('"')) throw new CsvTrafegoError('linha_invalida')
    const d = DATA.exec(c[iData]!)
    const tipo = c[iTipo]!
    const minutos = c[iMin]!
    if (
      !d || !dataExiste(Number(d[1]), Number(d[2]), Number(d[3])) || !ID_CANAL.test(c[iCanal]!) || !ID_VIDEO.test(c[iVideo]!)
      || !TIPO.test(tipo) || !INTEIRO.test(c[iViews]!) || !NUMERO.test(minutos)
    ) throw new CsvTrafegoError('linha_invalida')
    const views = Number(c[iViews])
    const watchTimeMinutes = Number(minutos)
    if (!Number.isSafeInteger(views) || !Number.isFinite(watchTimeMinutes) || watchTimeMinutes > LIMITE_MINUTOS) throw new CsvTrafegoError('linha_invalida')
    return {
      day: `${d[1]}-${d[2]}-${d[3]}`, channelId: c[iCanal]!, videoId: c[iVideo]!, sourceType: tipo,
      detail: c[iDetalhe]!, views, watchTimeMinutes,
    }
  })
}

/** Limpa o que o Postgres rejeita; na origem externa corta no primeiro `?` ou `#`; apara. As outras origens ficam inteiras. */
export function normalizarDetalhe(sourceType: string, bruto: string): string {
  let t = cleanText(bruto)
  if (sourceType === ORIGEM_EXTERNA) {
    const i = t.search(/[?#]/)
    if (i >= 0) t = t.slice(0, i)
  }
  return t.trim()
}

/** Corta por ponto de código (não por unidade UTF-16: meio emoji o `jsonb` recusa e o relatório ficaria preso na fila). */
export function cortarDetalhe(s: string): string {
  return cleanText(Array.from(s).slice(0, LIMITE_DETALHE).join(''))
}

/** Não separa por canal: quem chama confere o canal das linhas antes de agregar.
 *  Soma por (vídeo, dia, origem, hash do detalhe inteiro); linha que soma 0 views e 0 minutos sai e é contada. */
export function agregarTrafego(linhas: readonly LinhaTrafego[]): TrafegoAgregado {
  const grupos = new Map<string, DetalheDoDia>()
  for (const l of linhas) {
    const inteiro = normalizarDetalhe(l.sourceType, l.detail)
    const detailHash = createHash('sha256').update(inteiro).digest('hex')
    const chave = JSON.stringify([l.videoId, l.day, l.sourceType, detailHash])
    const g = grupos.get(chave)
    if (g) { g.views += l.views; g.watchTimeMinutes += l.watchTimeMinutes; continue }
    grupos.set(chave, {
      day: l.day, videoId: l.videoId, sourceType: l.sourceType, detail: cortarDetalhe(inteiro), detailHash,
      views: l.views, watchTimeMinutes: l.watchTimeMinutes,
    })
  }
  const todas = [...grupos.values()]
  const uteis = todas.filter(g => g.views !== 0 || g.watchTimeMinutes !== 0)
  return { linhas: uteis, descartadasZeradas: todas.length - uteis.length }
}
