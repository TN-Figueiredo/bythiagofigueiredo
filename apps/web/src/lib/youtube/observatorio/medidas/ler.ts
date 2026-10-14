import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DAY } from '../time'
import { FALTAS_DE_MARCA, type FaltaDeMarca } from './tipos'
import type { FaltaLida, IdadeDeMarca, Leitura, MarcaLida } from './m1'
import type { RetratoDoCanal } from './direcao'
import type { CampoDeMudanca } from './subida'

/**
 * New (A5, E4, Tarefa 13): os leitores de servidor das medidas. Recebem o cliente por parâmetro (quem chama é a página, depois da
 * guarda dela) e NUNCA lançam: o que não foi lido vira `{ lido: false, causa }`, nunca lista vazia. Nenhum texto de exceção sai daqui.
 * Todo leitor, menos `lerCanal`, lê o canal primeiro (com o filtro de site) e para se ele não responder.
 */
export type CausaNaoLida = 'schema_ausente' | 'erro_do_banco' | 'cortado' | 'canal_de_outro_site'
export type Parte<T> = { lido: true; dados: T } | { lido: false; causa: CausaNaoLida }

const PAGINA = 1000
const MAX_PAGINAS = 50
const BLOCO = 150
/** Função, tabela ou coluna que a migration ainda não criou. */
const SCHEMA_AUSENTE = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])

type Obj = Record<string, unknown>
const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const ehNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const numOuNulo = (v: unknown): number | null => (ehNum(v) ? v : null)
const txtOuNulo = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const boolOuNulo = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
const msDe = (v: unknown): number | null => {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}
const naoLido = (causa: CausaNaoLida): { lido: false; causa: CausaNaoLida } => ({ lido: false, causa })
const lido = <T>(dados: T): Parte<T> => ({ lido: true, dados })

function causaDoErro(err: unknown): CausaNaoLida {
  if (ehObj(err) && typeof err.code === 'string' && SCHEMA_AUSENTE.has(err.code)) return 'schema_ausente'
  return 'erro_do_banco'
}

type Resposta = { data: unknown; error: unknown }
type Lote = { ok: true; linhas: Obj[] } | { ok: false; causa: CausaNaoLida }

/** Lê todas as páginas de 1.000. Página cheia depois do teto de páginas: `cortado` (nunca devolve o pedaço como se fosse tudo). */
async function paginar(pedir: (de: number, ate: number) => PromiseLike<Resposta>, maxPaginas: number): Promise<Lote> {
  const linhas: Obj[] = []
  try {
    for (let p = 0; p < maxPaginas; p++) {
      const r = await pedir(p * PAGINA, p * PAGINA + PAGINA - 1)
      if (r.error !== null && r.error !== undefined) return { ok: false, causa: causaDoErro(r.error) }
      if (!Array.isArray(r.data)) return { ok: false, causa: 'erro_do_banco' }
      for (const x of r.data) if (ehObj(x)) linhas.push(x)
      if (r.data.length < PAGINA) return { ok: true, linhas }
    }
    return { ok: false, causa: 'cortado' }
  } catch {
    return { ok: false, causa: 'erro_do_banco' }
  }
}

function blocos(ids: readonly string[]): string[][] {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += BLOCO) out.push(ids.slice(i, i + BLOCO))
  return out
}

export interface OpcoesDeLeitura { maxPaginas?: number }
interface Escopo extends OpcoesDeLeitura { siteId: string; channelId: string }

// ───── o canal ─────

export interface CanalLido { id: string; siteId: string; collectionPausedAt: string | null; missingSince: string | null }

export async function lerCanal(sb: SupabaseClient, o: Escopo): Promise<Parte<CanalLido>> {
  try {
    const r = await sb.from('competitor_channels').select('id, site_id, collection_paused_at, missing_since')
      .eq('id', o.channelId).eq('site_id', o.siteId)
    if (r.error !== null && r.error !== undefined) return naoLido(causaDoErro(r.error))
    const linha: unknown = Array.isArray(r.data) ? r.data[0] : undefined
    if (!ehObj(linha) || typeof linha.id !== 'string') return naoLido('canal_de_outro_site')
    return lido({
      id: linha.id, siteId: typeof linha.site_id === 'string' ? linha.site_id : o.siteId,
      collectionPausedAt: txtOuNulo(linha.collection_paused_at), missingSince: txtOuNulo(linha.missing_since),
    })
  } catch {
    return naoLido('erro_do_banco')
  }
}

/** Roda `leitor` só depois de o canal responder. */
async function comCanal<T>(sb: SupabaseClient, o: Escopo, leitor: () => Promise<Parte<T>>): Promise<Parte<T>> {
  const c = await lerCanal(sb, o)
  if (!c.lido) return naoLido(c.causa)
  return leitor()
}

// ───── os vídeos ─────

export interface VideoLido {
  id: string
  videoId: string | null
  publishedAt: string | null
  liveActualStartAt: string | null
  liveBroadcastContent: string | null
  wasLive: boolean | null
  isShort: boolean | null
  durationSeconds: number | null
  viewCount: number | null
  likeCount: number | null
  commentCount: number | null
  likesHidden: boolean | null
  commentsDisabled: boolean | null
  viewsHidden: boolean | null
  discoveredAt: string | null
  missingSince: string | null
  seriesTier: 'diaria' | 'semanal' | null
  lastCheckedAt: string | null
}

const COLUNAS_VIDEO = 'id, video_id, published_at, live_actual_start_at, live_broadcast_content, was_live, is_short, duration_seconds, view_count, like_count, comment_count, likes_hidden, comments_disabled, views_hidden, discovered_at, missing_since, series_tier, last_checked_at'

export async function lerVideosDoCanal(sb: SupabaseClient, o: Escopo): Promise<Parte<VideoLido[]>> {
  return comCanal(sb, o, async () => {
    const r = await paginar((de, ate) => sb.from('competitor_videos').select(COLUNAS_VIDEO).eq('competitor_channel_id', o.channelId).order('id').range(de, ate), o.maxPaginas ?? MAX_PAGINAS)
    if (!r.ok) return naoLido(r.causa)
    const videos: VideoLido[] = []
    for (const x of r.linhas) {
      if (typeof x.id !== 'string') continue
      videos.push({
        id: x.id, videoId: txtOuNulo(x.video_id), publishedAt: txtOuNulo(x.published_at), liveActualStartAt: txtOuNulo(x.live_actual_start_at),
        liveBroadcastContent: txtOuNulo(x.live_broadcast_content), wasLive: boolOuNulo(x.was_live), isShort: boolOuNulo(x.is_short),
        durationSeconds: numOuNulo(x.duration_seconds), viewCount: numOuNulo(x.view_count), likeCount: numOuNulo(x.like_count),
        commentCount: numOuNulo(x.comment_count), likesHidden: boolOuNulo(x.likes_hidden), commentsDisabled: boolOuNulo(x.comments_disabled),
        viewsHidden: boolOuNulo(x.views_hidden), discoveredAt: txtOuNulo(x.discovered_at), missingSince: txtOuNulo(x.missing_since),
        seriesTier: x.series_tier === 'diaria' || x.series_tier === 'semanal' ? x.series_tier : null, lastCheckedAt: txtOuNulo(x.last_checked_at),
      })
    }
    return lido(videos)
  })
}

/** Os ids dos vídeos do canal: as tabelas de série e de versão não têm como ser filtradas por canal. */
async function idsDoCanal(sb: SupabaseClient, o: Escopo): Promise<Parte<Set<string>>> {
  const r = await paginar((de, ate) => sb.from('competitor_videos').select('id').eq('competitor_channel_id', o.channelId).order('id').range(de, ate), o.maxPaginas ?? MAX_PAGINAS)
  if (!r.ok) return naoLido(r.causa)
  const ids = new Set<string>()
  for (const x of r.linhas) if (typeof x.id === 'string') ids.add(x.id)
  return lido(ids)
}

// ───── as marcas ─────

export interface MarcasDoCanal {
  marcas: Map<string, Partial<Record<IdadeDeMarca, MarcaLida>>>
  faltas: Map<string, Partial<Record<IdadeDeMarca, FaltaLida>>>
}

const idadeDe = (v: unknown): IdadeDeMarca | null => (v === 1 || v === 7 || v === 30 ? v : null)

export async function lerMarcasDoCanal(sb: SupabaseClient, o: Escopo & { videoIds: readonly string[] }): Promise<Parte<MarcasDoCanal>> {
  return comCanal(sb, o, async () => {
    const marcas: MarcasDoCanal['marcas'] = new Map()
    const faltas: MarcasDoCanal['faltas'] = new Map()
    const max = o.maxPaginas ?? MAX_PAGINAS
    for (const bloco of blocos(o.videoIds)) {
      const m = await paginar((de, ate) => sb.from('competitor_video_marks')
        .select('video_id, age_days, views, likes, comments, read_before_at, read_after_at, age_base_at')
        .eq('site_id', o.siteId).in('video_id', bloco).order('video_id').range(de, ate), max)
      if (!m.ok) return naoLido(m.causa)
      for (const x of m.linhas) {
        const idade = idadeDe(x.age_days)
        const antes = msDe(x.read_before_at), depois = msDe(x.read_after_at), base = msDe(x.age_base_at)
        if (typeof x.video_id !== 'string' || idade === null || !ehNum(x.views) || antes === null || depois === null || base === null) continue
        const por = marcas.get(x.video_id) ?? {}
        por[idade] = { views: x.views, likes: numOuNulo(x.likes), comments: numOuNulo(x.comments), readBeforeAt: antes, readAfterAt: depois, ageBaseAt: base }
        marcas.set(x.video_id, por)
      }
      const f = await paginar((de, ate) => sb.from('competitor_video_mark_misses')
        .select('video_id, age_days, reason, since_at, age_base_at')
        .eq('site_id', o.siteId).in('video_id', bloco).order('video_id').range(de, ate), max)
      if (!f.ok) return naoLido(f.causa)
      for (const x of f.linhas) {
        const idade = idadeDe(x.age_days)
        const base = msDe(x.age_base_at)
        const reason: FaltaDeMarca | undefined = FALTAS_DE_MARCA.find((k) => k === x.reason)
        if (typeof x.video_id !== 'string' || idade === null || base === null || reason === undefined) continue
        const por = faltas.get(x.video_id) ?? {}
        por[idade] = { reason, sinceAt: msDe(x.since_at), ageBaseAt: base }
        faltas.set(x.video_id, por)
      }
    }
    return lido({ marcas, faltas })
  })
}

// ───── os retratos do canal ─────

export async function lerRetratosDoCanal(sb: SupabaseClient, o: Escopo & { desde?: string; agoraMs?: number }): Promise<Parte<RetratoDoCanal[]>> {
  return comCanal(sb, o, async () => {
    const desde = o.desde ?? new Date((o.agoraMs ?? Date.now()) - 120 * DAY).toISOString().slice(0, 10)
    const r = await paginar((de, ate) => sb.from('competitor_channel_snapshots').select('snapshot_date, view_count')
      .eq('competitor_channel_id', o.channelId).gte('snapshot_date', desde).order('snapshot_date').range(de, ate), o.maxPaginas ?? MAX_PAGINAS)
    if (!r.ok) return naoLido(r.causa)
    const out: RetratoDoCanal[] = []
    for (const x of r.linhas) {
      if (typeof x.snapshot_date !== 'string') continue
      // view_count nulo continua nulo: o dia fica "sem registro", nunca 0.
      out.push({ dia: x.snapshot_date.slice(0, 10), views: numOuNulo(x.view_count) })
    }
    return lido(out)
  })
}

// ───── as séries ─────

export interface SeriesDoCanal { series: Map<string, Leitura[]>; foraDoCanal: number }

export async function lerSeriesDoCanal(sb: SupabaseClient, o: Escopo & { videoIds: readonly string[]; desde: string }): Promise<Parte<SeriesDoCanal>> {
  return comCanal(sb, o, async () => {
    const ids = await idsDoCanal(sb, o)
    if (!ids.lido) return naoLido(ids.causa)
    const meus = o.videoIds.filter((id) => ids.dados.has(id))
    const series: Map<string, Leitura[]> = new Map()
    const max = o.maxPaginas ?? MAX_PAGINAS
    const juntar = (linhas: Obj[]): void => {
      for (const x of linhas) {
        const t = msDe(x.taken_at)
        if (typeof x.video_id !== 'string' || t === null || !ehNum(x.views)) continue
        const l = series.get(x.video_id) ?? []
        l.push({ t, views: x.views, likes: numOuNulo(x.likes), comments: numOuNulo(x.comments) })
        series.set(x.video_id, l)
      }
    }
    for (const bloco of blocos(meus)) {
      const d = await paginar((de, ate) => sb.from('competitor_video_daily').select('video_id, snap_date, taken_at, views, likes, comments')
        .in('video_id', bloco).gte('snap_date', o.desde).order('video_id').order('snap_date').range(de, ate), max)
      if (!d.ok) return naoLido(d.causa)
      const e = await paginar((de, ate) => sb.from('competitor_video_early').select('video_id, taken_at, views, likes, comments')
        .in('video_id', bloco).gte('taken_at', o.desde).order('video_id').order('taken_at').range(de, ate), max)
      if (!e.ok) return naoLido(e.causa)
      juntar(d.linhas)
      juntar(e.linhas)
    }
    for (const [id, l] of series) {
      l.sort((a, b) => a.t - b.t)
      series.set(id, l.filter((x, i) => i === 0 || x.t !== l[i - 1]?.t))
    }
    return lido({ series, foraDoCanal: o.videoIds.length - meus.length })
  })
}

// ───── o que mudou ─────

export interface MudancaLida { campo: CampoDeMudanca; em: number; /** Só da descrição (para os capítulos). */ valueText: string | null }
export interface MudancasDoCanal { mudancas: Map<string, MudancaLida[]>; foraDoCanal: number }

const CAMPO_DE_VIDEO: Record<string, CampoDeMudanca> = { title: 'titulo', thumb: 'miniatura', desc: 'descricao' }
const CAMPO_DE_CAMPO: Record<string, CampoDeMudanca> = { tags: 'tags', category_id: 'categoria', duration_seconds: 'duracao', default_language: 'idioma' }

export async function lerMudancasDoCanal(sb: SupabaseClient, o: Escopo & { videoIds: readonly string[]; desde: string }): Promise<Parte<MudancasDoCanal>> {
  return comCanal(sb, o, async () => {
    const ids = await idsDoCanal(sb, o)
    if (!ids.lido) return naoLido(ids.causa)
    const meus = o.videoIds.filter((id) => ids.dados.has(id))
    const mudancas: Map<string, MudancaLida[]> = new Map()
    const max = o.maxPaginas ?? MAX_PAGINAS
    const juntar = (linhas: Obj[], mapa: Record<string, CampoDeMudanca>, comTexto: boolean): void => {
      for (const x of linhas) {
        const campo = typeof x.field === 'string' ? mapa[x.field] : undefined
        const em = msDe(x.first_seen_at)
        if (typeof x.video_id !== 'string' || campo === undefined || em === null) continue
        const l = mudancas.get(x.video_id) ?? []
        l.push({ campo, em, valueText: comTexto && campo === 'descricao' ? txtOuNulo(x.value_text) : null })
        mudancas.set(x.video_id, l)
      }
    }
    for (const bloco of blocos(meus)) {
      // A primeira leitura de um campo não é mudança (`precision = 'first'`).
      const v = await paginar((de, ate) => sb.from('competitor_video_versions').select('video_id, field, first_seen_at, precision, value_text')
        .in('video_id', bloco).neq('precision', 'first').gte('first_seen_at', o.desde).order('first_seen_at').range(de, ate), max)
      if (!v.ok) return naoLido(v.causa)
      const f = await paginar((de, ate) => sb.from('competitor_field_versions').select('video_id, field, first_seen_at, precision')
        .eq('site_id', o.siteId).in('video_id', bloco).in('field', Object.keys(CAMPO_DE_CAMPO)).neq('precision', 'first')
        .gte('first_seen_at', o.desde).order('first_seen_at').range(de, ate), max)
      if (!f.ok) return naoLido(f.causa)
      juntar(v.linhas, CAMPO_DE_VIDEO, true)
      juntar(f.linhas, CAMPO_DE_CAMPO, false)
    }
    for (const l of mudancas.values()) l.sort((a, b) => a.em - b.em)
    return lido({ mudancas, foraDoCanal: o.videoIds.length - meus.length })
  })
}
