// Casamento determinístico de lugar (F2 T3). Sem banco: o índice vem de fora (montarIndice).
import { createHash } from 'node:crypto'
import { normalizarLugar } from './normalizar'

export { paresPadrao, chaveDoPar } from './coordenada'
export { normalizarLugar } from './normalizar'

export interface IndiceDeLugar {
  porAlias: Map<string, { slug: string; ambiguo: boolean; pais: string }>
  nMax: number
  versao: number
}

export interface EntradaDeLugar {
  titulo: string
  tags: readonly string[]
  descricaoInicio: string
  locationDescription: string | null
  coordenadaPadraoDoCanal: boolean
}

const MAX_PAISES = 3
const DESCRICAO_MAX = 300
const PREPOSICOES_PT = new Set(['em', 'na', 'no'])
// Ambíguos em inglês: "in|to" não basta como segundo sinal (Yannis M8).
const AMBIGUOS_EN = new Set(['georgia', 'jordan', 'chad', 'turkey'])

export function montarIndice(
  aliases: ReadonlyArray<{ alias_norm: string; slug: string; ambiguo: boolean; pais_iso2: string }>,
  versao: number,
): IndiceDeLugar {
  const porAlias: IndiceDeLugar['porAlias'] = new Map()
  let nMax = 1
  for (const a of aliases) {
    porAlias.set(a.alias_norm, { slug: a.slug, ambiguo: a.ambiguo, pais: a.pais_iso2 })
    const n = a.alias_norm.split(' ').length
    if (n > nMax) nMax = n
  }
  return { porAlias, nMax, versao }
}

type Origem = 'titulo' | 'tags' | 'descricao' | 'localizacao'

interface Achado {
  origem: Origem
  alias: string
  slug: string
  ambiguo: boolean
  pais: string
  anterior: string | null
}

/** Janela deslizante: n de nMax a 1, o maior vence e consome os tokens. O(T·nMax). */
function achar(texto: string, origem: Origem, ind: IndiceDeLugar): Achado[] {
  const tokens = normalizarLugar(texto).split(' ').filter(Boolean)
  const out: Achado[] = []
  let i = 0
  while (i < tokens.length) {
    let casou = false
    for (let n = Math.min(ind.nMax, tokens.length - i); n >= 1; n--) {
      const alias = tokens.slice(i, i + n).join(' ')
      const e = ind.porAlias.get(alias)
      if (e) {
        out.push({ origem, alias, ...e, anterior: i > 0 ? (tokens[i - 1] ?? null) : null })
        i += n
        casou = true
        break
      }
    }
    if (!casou) i++
  }
  return out
}

export function extrairLugares(
  e: EntradaDeLugar,
  ind: IndiceDeLugar,
): { chaves: string[]; fonte: 'texto' | 'texto+coordenada' } {
  const usaLocal = e.locationDescription !== null && !e.coordenadaPadraoDoCanal
  const achados: Achado[] = [
    ...achar(e.titulo, 'titulo', ind),
    ...e.tags.flatMap((t) => achar(t, 'tags', ind)),
    ...achar(e.descricaoInicio.slice(0, DESCRICAO_MAX), 'descricao', ind),
    ...(usaLocal ? achar(e.locationDescription as string, 'localizacao', ind) : []),
  ]

  const temSegundoSinal = (a: Achado): { ok: boolean; viaLocal: boolean } => {
    const outro = achados.find(
      (b) => b !== a && !b.ambiguo && b.pais === a.pais && b.alias !== a.alias && b.origem !== 'titulo',
    )
    if (outro) return { ok: true, viaLocal: outro.origem === 'localizacao' }
    if (
      !AMBIGUOS_EN.has(a.alias) &&
      a.anterior !== null &&
      PREPOSICOES_PT.has(a.anterior)
    ) {
      return { ok: true, viaLocal: false }
    }
    return { ok: false, viaLocal: false }
  }

  const chaves: string[] = []
  const paises: string[] = []
  let viaCoordenada = false
  for (const a of achados) {
    let veioDoLocal = a.origem === 'localizacao'
    if (a.ambiguo) {
      const s = temSegundoSinal(a)
      if (!s.ok) continue
      veioDoLocal = veioDoLocal || s.viaLocal
    }
    if (!paises.includes(a.pais)) {
      if (paises.length >= MAX_PAISES) continue
      paises.push(a.pais)
    }
    const doPais = `pais:${a.pais}`
    if (!chaves.includes(a.slug)) chaves.push(a.slug)
    if (!chaves.includes(doPais)) chaves.push(doPais)
    if (veioDoLocal) viaCoordenada = true
  }
  return { chaves, fonte: viaCoordenada ? 'texto+coordenada' : 'texto' }
}

export function entradaHash(e: EntradaDeLugar, versao: number): string {
  const json = JSON.stringify({
    v: versao,
    t: normalizarLugar(e.titulo),
    g: e.tags.map(normalizarLugar),
    d: normalizarLugar(e.descricaoInicio.slice(0, DESCRICAO_MAX)),
    l: e.locationDescription === null ? null : normalizarLugar(e.locationDescription),
    c: e.coordenadaPadraoDoCanal,
  })
  return createHash('sha256').update(json).digest('hex')
}
