import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { RENDERERS_TITULO, validarLeituras, type LeituraWatch } from '@/lib/youtube/teste-youtube/tipos'

export const VIDEO_ID = 'qIg9a7vqcNo'
export const TITULO_A = '5 - Como somos controlados - Consistência e Compromisso (Part 4)'
export const TITULO_B = 'Consistência e Compromisso (Part 4)'

type Miniatura = LeituraWatch['miniaturas'][number]

export interface LinhaDhash {
  arquivo: string
  sha16: string | null
  variante: string
  largura: number
  altura: number
  url: string | null
  dhash: string
  origem: string
}

const DIR = fileURLToPath(new URL('.', import.meta.url))

function tsv(nome: string): string[][] {
  const linhas = readFileSync(DIR + nome, 'utf8').split('\n').filter(l => l.length > 0)
  return linhas.slice(1).map(l => l.split('\t'))
}

const nulo = (s: string | undefined): string | null => (s === undefined || s === '' || s === '-' ? null : s)
const ms = (iso: string): number => Date.parse(iso)

export function linhasDhash(): LinhaDhash[] {
  return tsv('dhash.tsv').map(c => ({
    arquivo: c[0]!,
    sha16: nulo(c[1]),
    variante: c[2]!,
    largura: Number(c[3]),
    altura: Number(c[4]),
    url: nulo(c[5]),
    dhash: c[6]!,
    origem: c[7]!,
  }))
}

function varianteDaUrl(url: string): string {
  return url.split('?')[0]!.split('/').pop()!.replace(/\.jpg$/, '')
}

function carregarWatch(): LeituraWatch[] {
  const dh = linhasDhash()
  const porUrl = new Map<string, LinhaDhash>()
  for (const l of dh) if (l.url !== null && l.origem === 'pagina') porUrl.set(l.url, l)

  const titulos = tsv('titulos.tsv').filter(c => c[1] === 'teste' && c[2] === 'watch')
  const blocos = tsv('paginas-watch.tsv')
  if (blocos.length !== 360) throw new Error(`paginas-watch: esperadas 360 linhas, vieram ${blocos.length}`)

  let rodada = -1
  let anterior = Number.NEGATIVE_INFINITY
  const leituras = titulos.map((c, k) => {
    const em = c[0]!
    if (ms(em) - anterior > 30_000) rodada++
    anterior = ms(em)
    const b = Number(c[4]) === 3
    const bloco = blocos.slice(k * 6, k * 6 + 6)
    const miniaturas: Miniatura[] = bloco.map(linha => {
      if (Math.abs(ms(linha[0]!) - ms(em)) > 2000) throw new Error(`paginas-watch: bloco ${k} longe da leitura (${linha[0]} x ${em})`)
      const url = linha[3]!
      const host = new URL(url).host
      const variante = varianteDaUrl(url)
      const d = porUrl.get(url)
      if (!d) {
        return { url, host, variante, largura: null, altura: null, http: null, etag: null, sha16: null, dhash: null }
      }
      return { url, host, variante, largura: d.largura, altura: d.altura, http: 200, etag: null, sha16: null, dhash: d.dhash }
    })
    return {
      youtubeVideoId: VIDEO_ID,
      lidaEm: em,
      rodadaId: `r${rodada}`,
      origemRede: 'mac-casa',
      idioma: 'pt-BR',
      erro: null,
      tituloOficial: TITULO_A,
      titulo_oficial_fonte: 'videoDetails',
      rendicoesSqp: null, // o experimento não contou
      titulosExibidos: RENDERERS_TITULO.map(renderer => ({ renderer, texto: b ? TITULO_B : TITULO_A })),
      miniaturas,
    } satisfies LeituraWatch
  })

  const porRodada = new Map<string, number>()
  for (const l of leituras) porRodada.set(l.rodadaId, (porRodada.get(l.rodadaId) ?? 0) + 1)
  if (porRodada.size !== 20 || [...porRodada.values()].some(n => n !== 3)) {
    throw new Error('titulos: esperadas 20 rodadas de 3 leituras')
  }
  return leituras
}

function carregarSondas(): LeituraWatch[] {
  const porSha = new Map<string, LinhaDhash>()
  for (const l of linhasDhash()) if (l.origem === 'sonda' && l.sha16 !== null) porSha.set(`${l.variante}|${l.sha16}`, l)

  const linhas = tsv('sondas.tsv').filter(c => c[1] === 'teste')
  const voltas: string[][][] = []
  let anterior = Number.NEGATIVE_INFINITY
  for (const c of linhas) {
    if (ms(c[0]!) - anterior > 30_000) voltas.push([])
    anterior = ms(c[0]!)
    voltas[voltas.length - 1]!.push(c)
  }
  return voltas.map((volta, n) => ({
    youtubeVideoId: VIDEO_ID,
    lidaEm: volta[0]![0]!,
    rodadaId: `s${n}`,
    origemRede: 'mac-casa',
    idioma: null,
    erro: null,
    tituloOficial: null,
    titulo_oficial_fonte: null,
    rendicoesSqp: null,
    titulosExibidos: [],
    miniaturas: volta.map(c => {
      const [, , host, variante, modo, http, etag, sha] = c as [string, string, string, string, string, string, string, string]
      const url = `https://${host}/vi/${VIDEO_ID}/${variante}.jpg${modo === 'semcache' ? '?r=semcache' : ''}`
      const status = Number(http)
      const base = { url, host, variante, http: status, etag: nulo(etag), sha16: nulo(sha) }
      if (status !== 200) return { ...base, largura: null, altura: null, dhash: null }
      const d = porSha.get(`${variante}|${sha}`)
      if (!d) throw new Error(`sondas: sem dhash para ${variante}|${sha}`)
      return { ...base, largura: d.largura, altura: d.altura, dhash: d.dhash }
    }),
  }))
}

export function carregarQIg9(): { leituras: LeituraWatch[]; sondas: LeituraWatch[] } {
  const leituras = carregarWatch()
  const sondas = carregarSondas()
  const r = validarLeituras([...leituras, ...sondas])
  if (r.invalidas > 0) throw new Error(`fixture: ${r.invalidas} leituras inválidas`)
  return { leituras, sondas }
}
