// Casamento determinístico de lugar (F2 T3). Sem banco: o índice vem de fora (montarIndice).
import { createHash } from 'node:crypto'
import { normalizarLugar } from './normalizar'

export { paresPadrao, chaveDoPar } from './coordenada'
export { normalizarLugar } from './normalizar'

export interface IndiceDeLugar {
  porAlias: Map<string, { slug: string; ambiguo: boolean; pais: string }>
  nMax: number
  versao: number
  /** ISO2 dos países que a semente conhece (a bandeira emoji só vira chave para eles). */
  paises: Set<string>
}

export interface EntradaDeLugar {
  titulo: string
  tags: readonly string[]
  descricaoInicio: string
  locationDescription: string | null
  coordenadaPadraoDoCanal: boolean
  /** ISO2 que aparecem em tag/descrição de ≥ 50% dos vídeos do canal (v2 a): padrão do canal, não conta sozinho. */
  paisesPadraoDoCanal?: readonly string[]
}

/** Versão da regra de lugar (entra no hash e no `rule_version`): sobe a cada mudança de regra, mesmo sem campo novo. */
export const LUGAR_REGRA_VERSAO = 2
const MAX_PAISES = 3
const DESCRICAO_MAX = 300
const PREPOSICOES_PT = new Set(['em'])
// Ambíguos em inglês: "in|to" não basta como segundo sinal (Yannis M8).
const AMBIGUOS_EN = new Set(['georgia', 'jordan', 'chad', 'turkey'])

export function montarIndice(
  aliases: ReadonlyArray<{ alias_norm: string; slug: string; ambiguo: boolean; pais_iso2: string }>,
  versao: number,
): IndiceDeLugar {
  const porAlias: IndiceDeLugar['porAlias'] = new Map()
  let nMax = 1
  const paises = new Set<string>()
  for (const a of aliases) {
    paises.add(a.pais_iso2)
    porAlias.set(a.alias_norm, { slug: a.slug, ambiguo: a.ambiguo, pais: a.pais_iso2 })
    const n = a.alias_norm.split(' ').length
    if (n > nMax) nMax = n
  }
  return { porAlias, nMax, versao, paises }
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

const RE_BANDEIRA = /[\u{1F1E6}-\u{1F1FF}]{2}/gu

/** ISO2 das bandeiras emoji do texto (ordem de aparição, sem repetir), só o que o regex reconhece; o filtro da semente é de `achar`. */
export function bandeirasDe(texto: string): string[] {
  const out: string[] = []
  for (const m of texto.matchAll(RE_BANDEIRA)) {
    const iso = [...m[0]].map((c) => String.fromCharCode((c.codePointAt(0) as number) - 0x1f1e6 + 65)).join('')
    if (!out.includes(iso)) out.push(iso)
  }
  return out
}

/** Janela deslizante: n de nMax a 1, o maior vence e consome os tokens. O(T·nMax). */
function achar(texto: string, origem: Origem, ind: IndiceDeLugar): Achado[] {
  const out: Achado[] = []
  // v2 c: bandeira emoji (dois indicadores regionais) = país, determinístico.
  for (const iso of bandeirasDe(texto)) {
    if (ind.paises.has(iso)) out.push({ origem, alias: `bandeira ${iso}`, slug: `pais:${iso}`, ambiguo: false, pais: iso, anterior: null })
  }
  const tokens = normalizarLugar(texto).split(' ').filter(Boolean)
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
  const padraoCanal = new Set(e.paisesPadraoDoCanal ?? [])
  const doTitulo = achar(e.titulo, 'titulo', ind)
  const paisesDoTitulo = new Set(doTitulo.map((a) => a.pais))
  // v2 a: país de tag/descrição que é padrão do canal só conta se o título também o traz.
  const doTexto = [
    ...e.tags.flatMap((t) => achar(t, 'tags', ind)),
    ...achar(e.descricaoInicio.slice(0, DESCRICAO_MAX), 'descricao', ind),
  ].filter((a) => !padraoCanal.has(a.pais) || paisesDoTitulo.has(a.pais))
  const achados: Achado[] = [
    ...doTitulo,
    ...doTexto,
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
  let tituloTemChave = false
  const processar = (lista: readonly Achado[]): void => {
    for (const a of lista) {
      // v2 b: com chave no título, tag/descrição não acrescentam país novo.
      if (tituloTemChave && (a.origem === 'tags' || a.origem === 'descricao') && !paises.includes(a.pais)) continue
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
      if (a.origem === 'titulo') tituloTemChave = true
    }
  }
  processar(doTitulo)
  // v2 a': sem chave no título, tag/descrição só valem se apontam UM único país (lista de países em tag é tag genérica).
  const paisesDoTexto = new Set(doTexto.filter((a) => !a.ambiguo || temSegundoSinal(a).ok).map((a) => a.pais))
  if (tituloTemChave || paisesDoTexto.size <= 1) processar(doTexto)
  processar(achados.filter((a) => a.origem === 'localizacao'))
  return { chaves, fonte: viaCoordenada ? 'texto+coordenada' : 'texto' }
}

export function entradaHash(e: EntradaDeLugar, versao: number): string {
  const json = JSON.stringify({
    v: versao,
    r: LUGAR_REGRA_VERSAO,
    b: bandeirasDe([e.titulo, ...e.tags, e.descricaoInicio.slice(0, DESCRICAO_MAX)].join('\n')),
    t: normalizarLugar(e.titulo),
    g: e.tags.map(normalizarLugar),
    d: normalizarLugar(e.descricaoInicio.slice(0, DESCRICAO_MAX)),
    l: e.locationDescription === null ? null : normalizarLugar(e.locationDescription),
    c: e.coordenadaPadraoDoCanal,
    p: [...(e.paisesPadraoDoCanal ?? [])].sort(),
  })
  return createHash('sha256').update(json).digest('hex')
}

const MINIMO_VIDEOS_PADRAO = 4
const JANELA_PADRAO = 30

/**
 * Padrão do canal no texto (v2 a): para cada canal, os ISO2 que aparecem em tag/descrição de ≥ 50% dos seus
 * {@link JANELA_PADRAO} vídeos mais recentes COM texto (tag ou descrição; vídeo sem texto não entra no denominador),
 * mínimo de 4 nessa base. Título não entra na conta. Sem `publicadoEm`, vale a ordem de entrada (últimos por último).
 */
export function paisesPadraoPorCanal(
  videos: ReadonlyArray<{ canal: string; tags: readonly string[]; descricaoInicio: string; publicadoEm?: string | null }>,
  ind: IndiceDeLugar,
): Map<string, string[]> {
  const porCanal = new Map<string, typeof videos[number][]>()
  for (const v of videos) {
    if (v.tags.length === 0 && v.descricaoInicio.trim() === '') continue
    const l = porCanal.get(v.canal) ?? []
    l.push(v)
    porCanal.set(v.canal, l)
  }
  const saida = new Map<string, string[]>()
  for (const [canal, todos] of porCanal) {
    const base = todos
      .map((v, i) => ({ v, i }))
      .sort((a, b) => (b.v.publicadoEm ?? '').localeCompare(a.v.publicadoEm ?? '') || a.i - b.i)
      .slice(0, JANELA_PADRAO)
      .map((x) => x.v)
    if (base.length < MINIMO_VIDEOS_PADRAO) continue
    const c = new Map<string, number>()
    for (const v of base) {
      const paises = new Set([
        ...v.tags.flatMap((t) => achar(t, 'tags', ind)),
        ...achar(v.descricaoInicio.slice(0, DESCRICAO_MAX), 'descricao', ind),
      ].filter((a) => !a.ambiguo).map((a) => a.pais))
      for (const p of paises) c.set(p, (c.get(p) ?? 0) + 1)
    }
    const padrao = [...c].filter(([, k]) => k / base.length >= 0.5).map(([p]) => p).sort()
    if (padrao.length > 0) saida.set(canal, padrao)
  }
  return saida
}
