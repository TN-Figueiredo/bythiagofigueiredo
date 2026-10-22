// Borda dos lugares (F2 T6): `video_lugares` do site, calculado em memória e gravado só onde a entrada mudou.
// `calcularLugares` é pura (sem cliente); `gravarLugares` escreve; `sincronizarLugares` compõe leitura + cálculo + gravação.
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAll, type ObservatoryRows } from '../load'
import {
  entradaHash, extrairLugares, montarIndice, paresPadrao, chaveDoPar,
  type EntradaDeLugar, type IndiceDeLugar,
} from '../lugar/casar'

export interface ProprioRow { id: string; title: string; description: string | null; tags: string[]; is_short: boolean | null }

/** Localização gravada pelo YouTube no vídeo do competidor (`competitor_raw.raw->recordingDetails`). */
export interface RawDeLugar { locationDescription: string | null; lat: number | null; lng: number | null }
export interface LugarExistente { entrada_hash: string; semente_versao: number }

export interface LinhaDeLugar {
  video_id: string
  site_id: string
  origem: 'competidor' | 'proprio'
  chaves: string[]
  fonte: 'texto' | 'texto+coordenada'
  entrada_hash: string
  semente_versao: number
  computado_em: string
}

export interface CalculoDeLugares {
  /** Todas as linhas do site, uma por vídeo lido (sem lugar = `chaves: []`, nunca omitido). */
  linhas: LinhaDeLugar[]
  lugarDe: (videoId: string) => string[]
  /** O vídeo foi lido agora (terá linha em `video_lugares`); falso = podado ou desconhecido. */
  conhecido: (videoId: string) => boolean
  /** Só as que mudaram (sem linha gravada, `entrada_hash` ou `semente_versao` diferente). */
  regravar: LinhaDeLugar[]
  /** Linhas gravadas cujo vídeo não está mais no conjunto lido. */
  orfaos: string[]
  /** Texto do competidor/próprio por vídeo (título + tags), para os tokens do `parecido`. */
  textoDe: (videoId: string) => string
  contagens: { total: number; competidor: number; proprio: number; sem_lugar: number; regravados: number; inalterados: number; orfaos: number }
}

export class ErroSementeIncompleta extends Error {
  readonly motivo = 'semente_incompleta'
  constructor(lidos: number, esperados: number | null) {
    super(`semente_incompleta: lugar_aliases lidos ${lidos}, esperados ${esperados ?? 'desconhecido'}`)
    this.name = 'ErroSementeIncompleta'
  }
}

const BLOCO = 500

interface AliasRow {
  alias_norm: string; slug: string; ambiguo: boolean; semente_versao: number
  lugares: { pais_iso2: string } | Array<{ pais_iso2: string }> | null
}

/** Índice de lugar: `lugar_aliases` + `lugares` paginado e conferido contra `count: 'exact'` (senão `semente_incompleta`). */
export async function lerIndiceDeLugar(sb: SupabaseClient): Promise<IndiceDeLugar> {
  const rows = await readAll<AliasRow>('lugar_aliases', () =>
    sb.from('lugar_aliases').select('alias_norm, slug, ambiguo, semente_versao, lugares(pais_iso2)').order('alias_norm'))
  const { count, error } = await sb.from('lugar_aliases').select('alias_norm', { count: 'exact', head: true })
  if (error) throw new Error(`lugar_aliases (contagem): ${error.message}`)
  if (rows.length === 0 || count == null || rows.length !== count) throw new ErroSementeIncompleta(rows.length, count)
  let versao = 0
  const aliases = rows.map((r) => {
    if (r.semente_versao > versao) versao = r.semente_versao
    const l = Array.isArray(r.lugares) ? r.lugares[0] : r.lugares
    return { alias_norm: r.alias_norm, slug: r.slug, ambiguo: r.ambiguo, pais_iso2: l?.pais_iso2 ?? '' }
  })
  return montarIndice(aliases, versao)
}

interface RawRow { video_id: string | null; rd: unknown }

function numero(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

function rawDe(rd: unknown): RawDeLugar {
  const o = (rd && typeof rd === 'object' ? rd : {}) as { locationDescription?: unknown; location?: { latitude?: unknown; longitude?: unknown } | null }
  const desc = typeof o.locationDescription === 'string' && o.locationDescription.trim() !== '' ? o.locationDescription : null
  return { locationDescription: desc, lat: numero(o.location?.latitude), lng: numero(o.location?.longitude) }
}

/** As leituras de que `calcularLugares` precisa: localização do YouTube (nunca o `raw` inteiro) e as linhas já gravadas. */
export async function lerEntradasDeLugar(
  sb: SupabaseClient,
  siteId: string,
): Promise<{ raws: Map<string, RawDeLugar>; existentes: Map<string, LugarExistente> }> {
  const [rawRows, gravadas] = await Promise.all([
    readAll<RawRow>('competitor_raw', () =>
      sb.from('competitor_raw').select('video_id, rd:raw->recordingDetails').eq('site_id', siteId).eq('is_current', true).order('id')),
    readAll<{ video_id: string; entrada_hash: string; semente_versao: number }>('video_lugares', () =>
      sb.from('video_lugares').select('video_id, entrada_hash, semente_versao').eq('site_id', siteId).order('video_id')),
  ])
  const raws = new Map<string, RawDeLugar>()
  for (const r of rawRows) if (r.video_id) raws.set(r.video_id, rawDe(r.rd))
  const existentes = new Map<string, LugarExistente>()
  for (const g of gravadas) existentes.set(g.video_id, { entrada_hash: g.entrada_hash, semente_versao: g.semente_versao })
  return { raws, existentes }
}

/** Pura: O(V·T). Texto do competidor vem de `rows.versions` (`title` e `desc` atuais) + `tags`. */
export function calcularLugares(args: {
  siteId: string
  rows: ObservatoryRows
  proprios: readonly ProprioRow[]
  indice: IndiceDeLugar
  raws: ReadonlyMap<string, RawDeLugar>
  existentes: ReadonlyMap<string, LugarExistente>
  agora: Date
}): CalculoDeLugares {
  const { siteId, rows, proprios, indice, raws, existentes, agora } = args
  const computadoEm = agora.toISOString()

  const titulo = new Map<string, string>()
  const descricao = new Map<string, string>()
  for (const v of rows.versions) {
    if (!v.is_current || v.value_text == null) continue
    if (v.field === 'title') titulo.set(v.video_id, v.value_text)
    else if (v.field === 'desc') descricao.set(v.video_id, v.value_text)
  }
  const padrao = paresPadrao(rows.videos.map((v) => {
    const r = raws.get(v.id)
    return { canal: v.competitor_channel_id, lat: r?.lat ?? null, lng: r?.lng ?? null }
  }))

  const linhas: LinhaDeLugar[] = []
  const textos = new Map<string, string>()
  const empurrar = (id: string, origem: LinhaDeLugar['origem'], e: EntradaDeLugar): void => {
    const { chaves, fonte } = extrairLugares(e, indice)
    linhas.push({ video_id: id, site_id: siteId, origem, chaves, fonte, entrada_hash: entradaHash(e, indice.versao), semente_versao: indice.versao, computado_em: computadoEm })
  }

  for (const v of rows.videos) {
    const t = titulo.get(v.id) ?? v.title ?? ''
    const tags = v.tags ?? []
    const r = raws.get(v.id)
    const padraoDoCanal = r?.lat != null && r.lng != null && padrao.has(chaveDoPar(v.competitor_channel_id, r.lat, r.lng))
    textos.set(v.id, [t, ...tags].join(' '))
    empurrar(v.id, 'competidor', {
      titulo: t, tags, descricaoInicio: descricao.get(v.id) ?? '',
      locationDescription: r?.locationDescription ?? null, coordenadaPadraoDoCanal: padraoDoCanal,
    })
  }
  for (const p of proprios) {
    textos.set(p.id, [p.title, ...p.tags].join(' '))
    empurrar(p.id, 'proprio', {
      titulo: p.title, tags: p.tags, descricaoInicio: p.description ?? '', locationDescription: null, coordenadaPadraoDoCanal: false,
    })
  }

  const porVideo = new Map(linhas.map((l) => [l.video_id, l.chaves]))
  const regravar = linhas.filter((l) => {
    const e = existentes.get(l.video_id)
    return !e || e.entrada_hash !== l.entrada_hash || e.semente_versao !== l.semente_versao
  })
  const orfaos = [...existentes.keys()].filter((id) => !porVideo.has(id))
  return {
    linhas,
    lugarDe: (id) => porVideo.get(id) ?? [],
    conhecido: (id) => porVideo.has(id),
    regravar,
    orfaos,
    textoDe: (id) => textos.get(id) ?? '',
    contagens: {
      total: linhas.length,
      competidor: rows.videos.length,
      proprio: proprios.length,
      sem_lugar: linhas.filter((l) => l.chaves.length === 0).length,
      regravados: regravar.length,
      inalterados: linhas.length - regravar.length,
      orfaos: orfaos.length,
    },
  }
}

function emBlocos<T>(xs: readonly T[]): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += BLOCO) out.push(xs.slice(i, i + BLOCO))
  return out
}

/** Upsert em blocos de 500 só do que mudou + poda dos órfãos do site. Erro do banco lança (nunca engole). */
export async function gravarLugares(sb: SupabaseClient, siteId: string, calculo: CalculoDeLugares): Promise<void> {
  for (const bloco of emBlocos(calculo.regravar)) {
    const { error } = await sb.from('video_lugares').upsert(bloco, { onConflict: 'video_id' })
    if (error) throw new Error(`video_lugares (upsert): ${error.message}`)
  }
  for (const bloco of emBlocos(calculo.orfaos)) {
    const { error } = await sb.from('video_lugares').delete().eq('site_id', siteId).in('video_id', bloco)
    if (error) throw new Error(`video_lugares (poda): ${error.message}`)
  }
}

export async function sincronizarLugares(
  sb: SupabaseClient,
  siteId: string,
  rows: ObservatoryRows,
  proprios: ProprioRow[],
  indice: IndiceDeLugar,
  agora: Date,
): Promise<{ lugarDe: (videoId: string) => string[]; regravados: number; inalterados: number }> {
  const { raws, existentes } = await lerEntradasDeLugar(sb, siteId)
  const calculo = calcularLugares({ siteId, rows, proprios, indice, raws, existentes, agora })
  await gravarLugares(sb, siteId, calculo)
  return { lugarDe: calculo.lugarDe, regravados: calculo.regravar.length, inalterados: calculo.linhas.length - calculo.regravar.length }
}
