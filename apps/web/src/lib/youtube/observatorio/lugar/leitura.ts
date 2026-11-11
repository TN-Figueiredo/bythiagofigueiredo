// Leitor único dos lugares dos vídeos de competidores (A4 R4 T7): UM mapa por site e por cálculo (`niche_signals_estado.computed_at`),
// em cache. A ação `consultar` e `definicoes` leem por aqui; ninguém mais abre `video_lugares` para perguntar "onde".
// Formato compacto (ids, slugs e índices): 15.000 vídeos cabem em ~700 KB, abaixo do orçamento da entrada (1,5 MB).
import * as Sentry from '@sentry/nextjs'
import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readAll } from '../load'
import { ENTRADAS, comChaveFixa } from '../cache-tag'
import { ORCAMENTO_DA_ENTRADA } from '../medidas-telas/carregar-do-site'
import type { lerEstadoDaAba } from '../sinais/leitura'

/** Sobe quando o formato do mapa guardado muda. */
const MAPA_V = 1
/** A entrada é por cálculo (a chave leva `computado_em`); o prazo só limita o tempo que uma entrada órfã fica guardada. */
const VALIDADE_S = 21_600
const MINIMO_NA_LISTA = 3
/** Etiqueta própria: a coleta expira a do Observatório a cada 20 min, e esta entrada já é por cálculo (a chave leva o `computed_at`). */
export const etiquetaDosLugares = (siteId: string): string => 'observatorio-lugares:' + siteId

export interface MapaDeLugares {
  ids: string[]
  slugs: string[]
  /** Para cada vídeo de `ids`, os índices em `slugs` (vazio = linha com chaves `{}`, "sem lugar"). */
  chavesPorVideo: number[][]
  /** Quantas `semente_versao` há nas linhas: mais de uma = recálculo em andamento. */
  versoes: number
  lidoEm: number
}

interface LinhaGravada { video_id: string; chaves: string[] | null; semente_versao: number }

/** Passou do orçamento: não é guardado (lançar dentro do cache não guarda), mas o mapa lido segue para quem pediu. */
class AcimaDoOrcamento extends Error {
  constructor(readonly mapa: MapaDeLugares) { super('mapa de lugares acima do orçamento da entrada'); this.name = 'AcimaDoOrcamento' }
}

function montar(linhas: LinhaGravada[], lidoEm: number): MapaDeLugares {
  const unicos = new Set<string>()
  for (const l of linhas) for (const c of l.chaves ?? []) unicos.add(c)
  const slugs = [...unicos].sort()
  const indice = new Map(slugs.map((s, i) => [s, i]))
  const versoes = new Set<number>()
  const ids: string[] = []
  const chavesPorVideo: number[][] = []
  for (const l of linhas) {
    versoes.add(l.semente_versao)
    ids.push(l.video_id)
    chavesPorVideo.push([...new Set(l.chaves ?? [])].map((c) => indice.get(c)!).sort((a, b) => a - b))
  }
  return { ids, slugs, chavesPorVideo, versoes: versoes.size, lidoEm }
}

/**
 * O mapa de lugares do site, lido do banco uma vez por cálculo. A chave leva o `computed_at` de quem já foi lido (o chamador o tem de
 * `lerEstadoDaAba`): cálculo novo, entrada nova; a de antes nunca serve o novo. Erro lança dentro do cache (falha não é guardada).
 */
export async function lerMapaDeLugares(db: SupabaseClient, siteId: string, computadoEm: string | null): Promise<MapaDeLugares> {
  const ler = async (): Promise<MapaDeLugares> => {
    const linhas = await readAll<LinhaGravada>('video_lugares', () =>
      db.from('video_lugares').select('video_id, chaves, semente_versao').eq('site_id', siteId).eq('origem', 'competidor').order('video_id'))
    const mapa = montar(linhas, Date.now())
    if (JSON.stringify(mapa).length > ORCAMENTO_DA_ENTRADA) throw new AcimaDoOrcamento(mapa)
    return mapa
  }
  try {
    return await unstable_cache(comChaveFixa(ENTRADAS.lugares, ler), [ENTRADAS.lugares, String(MAPA_V), siteId, computadoEm ?? 'nunca'], { tags: [etiquetaDosLugares(siteId)], revalidate: VALIDADE_S })()
  } catch (e) {
    if (!(e instanceof AcimaDoOrcamento)) throw e
    Sentry.captureMessage('observatório: mapa de lugares acima do orçamento da entrada (não guardado)', {
      level: 'warning', fingerprint: ['lugares', 'acima_do_orcamento'], tags: { component: 'observatorio', step: 'lugares' }, extra: { videos: e.mapa.ids.length },
    })
    return e.mapa
  }
}

/** O slug existe na semente (`lugares`)? Lido ANTES do cache: slug inexistente nunca abre (nem cria) uma entrada. Erro de leitura é `falhou`, nunca `nao_existe`. */
export async function situacaoDoSlug(db: SupabaseClient, slug: string): Promise<'existe' | 'nao_existe' | 'falhou'> {
  try {
    const r = await db.from('lugares').select('slug').eq('slug', slug).maybeSingle()
    if (r.error) return 'falhou'
    return r.data ? 'existe' : 'nao_existe'
  } catch { return 'falhou' }
}

/** Os vídeos marcados com o lugar. Slug sem nenhum vídeo dá conjunto vazio. */
export function marcadosDe(m: MapaDeLugares, slug: string): Set<string> {
  const i = m.slugs.indexOf(slug)
  const out = new Set<string>()
  if (i < 0) return out
  m.chavesPorVideo.forEach((cs, k) => { if (cs.includes(i)) out.add(m.ids[k]!) })
  return out
}

function posicoes(m: MapaDeLugares): Map<string, number> {
  const p = new Map<string, number>()
  m.ids.forEach((v, k) => p.set(v, k))
  return p
}

/** Os slugs do vídeo; `[]` = linha com chaves vazias ("sem lugar"); `null` = o vídeo não tem linha. Para muitos vídeos use `semLinha`/`marcadosDe` (cada chamada monta o índice). */
export function lugaresDe(m: MapaDeLugares, videoId: string): string[] | null {
  const k = posicoes(m).get(videoId)
  return k === undefined ? null : m.chavesPorVideo[k]!.map((i) => m.slugs[i]!)
}

/** Dos ids do conjunto, os que não têm linha (chegaram depois do cálculo). */
export function semLinha(m: MapaDeLugares, idsDoConjunto: Iterable<string>): string[] {
  const p = posicoes(m)
  return [...idsDoConjunto].filter((v) => !p.has(v))
}

/** Lugares com pelo menos `minimo` vídeos; mais vídeos primeiro, empate pelo slug. */
export function contagemPorLugar(m: MapaDeLugares, minimo: number = MINIMO_NA_LISTA): Array<{ slug: string; n: number }> {
  const n = new Array<number>(m.slugs.length).fill(0)
  for (const cs of m.chavesPorVideo) for (const i of cs) n[i]!++
  return m.slugs.map((slug, i) => ({ slug, n: n[i]! })).filter((x) => x.n >= minimo).sort((a, b) => b.n - a.n || (a.slug < b.slug ? -1 : 1))
}

/** Estado do cálculo de lugares do site: leitura que falhou não é "nunca"; sem cálculo e com a tarefa desligada é `desligado`. */
export function estadoDoLugar(estadoDaAba: Awaited<ReturnType<typeof lerEstadoDaAba>>, ligado: boolean): 'ok' | 'atrasado' | 'nunca' | 'desligado' | 'falhou' {
  if (estadoDaAba === null) return 'falhou'
  if (!estadoDaAba.calculado) return ligado ? 'nunca' : 'desligado'
  return estadoDaAba.velho ? 'atrasado' : 'ok'
}
