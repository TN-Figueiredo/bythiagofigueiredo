// A5, X3: as idas ao banco da coleta de playlists e seções. Toda ida leva `abortSignal(BANCO_MS)`; erro vira `ErroX3` com SÓ o código e o SQLSTATE
// (o texto do Postgres nunca sai daqui). Leitura que falha LANÇA: nunca "nenhuma vista" nem 0 (o dado ausente não pode virar `ok`).
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { CODIGOS_SCHEMA_AUSENTE } from '@/lib/youtube/coleta/schema'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'
import { pacificDate, recordQuota } from '@/lib/youtube/competitor-quota'
import type { ItemLido, PlaylistLida } from './ler-api'
import type { LinhaDeLeitura, PlaylistDoCanal } from './planejar'

export type CodigoX3 = 'canal_pausado' | 'gravacao_falhou'
export class ErroX3 extends Error {
  constructor(public readonly codigo: CodigoX3, public readonly sqlstate: string | null) { super(codigo) }
}

/** Playlist presente no banco, com a contagem que a API deu na última lista (para a coerência dos itens). */
export interface PlaylistConhecida extends PlaylistDoCanal { item_count: number | null }
export interface EstadoDoCanal {
  playlists: PlaylistConhecida[]
  empty_streak: number
  sections_empty_streak: number
  /** Fecho da volta anterior (`competitor_playlist_reads.last_cycle_at`); nulo = nenhuma volta fechada ainda. */
  last_cycle_at: string | null
  /** A última versão de seções tinha lista vazia? `null` = nenhuma versão gravada ainda. */
  ultima_secao_vazia: boolean | null
}
export type LeituraDoCanal = LinhaDeLeitura & { empty_streak: number; sections_empty_streak: number }

export interface RetornoPlaylists { ids: Map<string, string>; atrasada: boolean; sumidas: number; versoes: number; aConfirmar: number }
export interface RetornoItens { gravados: number; saidos: number; massa: boolean; atrasada: boolean }

export interface OpsX3 {
  /** A migration foi aplicada? Falso só para "tabela ausente"; outro erro lança. */
  schemaPresente(): Promise<boolean>
  /** Uma linha por canal (as que existem). Lança em erro. */
  lerLeituras(channelIds: readonly string[]): Promise<Map<string, LeituraDoCanal>>
  /** As unidades de `competitors_playlists` já gastas no dia do Pacífico, por site (linha ausente = 0). Lança em erro. */
  cotaDoDia(siteIds: readonly string[], nowMs: number): Promise<Map<string, number>>
  /** Uma vez por disparo, SÓ dos canais devidos; paginado, nunca truncado. Lança em erro (e `ErroX3` ao bater o teto de páginas). */
  lerCanais(siteId: string, channelIds: readonly string[]): Promise<Map<string, EstadoDoCanal>>
  /** Quantos dos canais têm ao menos uma versão de seções gravada (só para o `detalhe`). Lança em erro. */
  canaisComSecoes(channelIds: readonly string[]): Promise<number>
  /** Quantos itens presentes (não removidos) a playlist tem. */
  itensPresentes(playlistRef: string): Promise<number>
  playlistsRecord(a: { siteId: string; channelId: string; nowMs: number; rows: readonly PlaylistLida[]; complete: boolean; ocultas: boolean }): Promise<RetornoPlaylists>
  itemsRecord(a: { siteId: string; channelId: string; playlistRef: string; nowMs: number; rows: readonly ItemLido[]; complete: boolean; status: 'ok' | 'parcial' | 'erro'; reason: string | null }): Promise<RetornoItens>
  sectionsRecord(a: { siteId: string; channelId: string; nowMs: number; sha: string; raw: unknown }): Promise<number>
  visitClose(a: { siteId: string; channelId: string; nowMs: number; status: 'ok' | 'parcial' | 'erro'; reason: string | null; units: number; left: number | null; listaVazia: boolean | null; secoesVazias: boolean | null; ciclo: boolean; listTotal: number | null; listRead: number | null }): Promise<void>
  /** `recordQuota` com `mode: 'competitors_playlists'`. Lança em erro. */
  registrarCota(a: { siteId: string; nowMs: number; units: number; extra?: Record<string, number> }): Promise<void>
}

export const PAGINA = 1000
/** Teto de páginas de 1.000 linhas por leitura (200 mil linhas); passou disso é defeito, não dado. */
export const TETO_DE_PAGINAS = 200
const BLOCO_DE_CANAIS = 50

type Obj = Record<string, unknown>
const ehObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x)
const texto = (x: unknown): string | null => (typeof x === 'string' ? x : null)
const inteiro = (x: unknown, padrao = 0): number => (typeof x === 'number' && Number.isInteger(x) ? x : padrao)

function relatar(codigo: CodigoX3, sqlstate: string | null): void {
  try { Sentry.captureMessage(`x3: ${codigo}${sqlstate ? ' ' + sqlstate : ''}`, 'error') } catch { /* o relato nunca derruba a coleta */ }
}

/** O erro do banco, só código e SQLSTATE. `X3:canal_indisponivel` (canal pausado ou removido no meio) é o único que NÃO é falha de gravação. */
function converter(erro: { code?: unknown; message?: unknown } | null | undefined): ErroX3 {
  const msg = typeof erro?.message === 'string' ? erro.message : ''
  const code = typeof erro?.code === 'string' && /^[0-9A-Z]{5}$/.test(erro.code) ? erro.code : null
  if (msg.includes('X3:canal_indisponivel')) return new ErroX3('canal_pausado', code)
  relatar('gravacao_falhou', code)
  return new ErroX3('gravacao_falhou', code)
}

async function rpc(sb: SupabaseClient, fn: string, args: Obj): Promise<unknown> {
  let res: { data: unknown; error: { code?: unknown; message?: unknown } | null }
  try {
    res = await sb.rpc(fn, args).abortSignal(AbortSignal.timeout(BANCO_MS))
  } catch {
    throw converter(null)
  }
  if (res.error) throw converter(res.error)
  return res.data
}

export function criarOpsX3(sb: SupabaseClient): OpsX3 {
  /** Lê todas as páginas de uma consulta paginada; lança ao bater o teto de páginas (nunca trunca). */
  async function paginar(montar: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { code?: unknown; message?: unknown } | null }>): Promise<Obj[]> {
    const todas: Obj[] = []
    for (let p = 0; p < TETO_DE_PAGINAS; p++) {
      let res: { data: unknown; error: { code?: unknown; message?: unknown } | null }
      try { res = await montar(p * PAGINA, p * PAGINA + PAGINA - 1) } catch { throw converter(null) }
      if (res.error) throw converter(res.error)
      if (!Array.isArray(res.data)) throw converter(null)
      for (const l of res.data) if (ehObj(l)) todas.push(l)
      if (res.data.length < PAGINA) return todas
    }
    throw converter(null)
  }
  const blocos = (ids: readonly string[]): string[][] => {
    const out: string[][] = []
    for (let i = 0; i < ids.length; i += BLOCO_DE_CANAIS) out.push(ids.slice(i, i + BLOCO_DE_CANAIS))
    return out
  }

  return {
    async schemaPresente() {
      let res: { error: { code?: unknown; message?: unknown } | null }
      try { res = await sb.from('competitor_playlist_reads').select('competitor_channel_id').limit(1).abortSignal(AbortSignal.timeout(BANCO_MS)) } catch { throw converter(null) }
      if (!res.error) return true
      if (typeof res.error.code === 'string' && CODIGOS_SCHEMA_AUSENTE.includes(res.error.code)) return false
      throw converter(res.error)
    },

    async lerLeituras(channelIds) {
      const out = new Map<string, LeituraDoCanal>()
      for (const bloco of blocos(channelIds)) {
        const linhas = await paginar((de, ate) => sb.from('competitor_playlist_reads')
          .select('competitor_channel_id, first_visit_at, last_visit_at, last_visit_day, last_status, last_reason, last_cycle_at, playlists_left, empty_streak, sections_empty_streak')
          .in('competitor_channel_id', bloco).order('competitor_channel_id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)))
        for (const l of linhas) {
          const id = texto(l.competitor_channel_id), vis = texto(l.last_visit_at), dia = texto(l.last_visit_day), prim = texto(l.first_visit_at)
          const st = l.last_status
          if (id === null || vis === null || dia === null || prim === null || (st !== 'ok' && st !== 'parcial' && st !== 'erro')) throw converter(null)
          out.set(id, {
            last_visit_at: vis, last_visit_day: dia, first_visit_at: prim, last_status: st, last_reason: texto(l.last_reason),
            last_cycle_at: texto(l.last_cycle_at), playlists_left: typeof l.playlists_left === 'number' ? l.playlists_left : null,
            empty_streak: inteiro(l.empty_streak), sections_empty_streak: inteiro(l.sections_empty_streak),
          })
        }
      }
      return out
    },

    async cotaDoDia(siteIds, nowMs) {
      const out = new Map<string, number>()
      if (siteIds.length === 0) return out
      let res: { data: unknown; error: { code?: unknown; message?: unknown } | null }
      try {
        res = await sb.from('youtube_quota_usage').select('site_id, operations').eq('date', pacificDate(nowMs)).in('site_id', [...siteIds]).abortSignal(AbortSignal.timeout(BANCO_MS))
      } catch { throw converter(null) }
      if (res.error) throw converter(res.error)
      if (!Array.isArray(res.data)) throw converter(null)
      for (const l of res.data) {
        if (!ehObj(l)) continue
        const site = texto(l.site_id)
        const ops = ehObj(l.operations) ? l.operations : {}
        const n = ops.competitors_playlists
        if (site !== null) out.set(site, typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0)
      }
      return out
    },

    async lerCanais(siteId, channelIds) {
      const out = new Map<string, EstadoDoCanal>()
      for (const id of channelIds) out.set(id, { playlists: [], empty_streak: 0, sections_empty_streak: 0, last_cycle_at: null, ultima_secao_vazia: null })
      for (const bloco of blocos(channelIds)) {
        const playlists = await paginar((de, ate) => sb.from('competitor_playlists')
          .select('id, competitor_channel_id, playlist_id, items_read_at, items_status, items_reason, item_count, missing_since')
          .eq('site_id', siteId).in('competitor_channel_id', bloco).order('competitor_channel_id').order('id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)))
        for (const p of playlists) {
          const canal = texto(p.competitor_channel_id), id = texto(p.id), pid = texto(p.playlist_id)
          const est = canal === null ? undefined : out.get(canal)
          if (est === undefined || id === null || pid === null) throw converter(null)
          const st = p.items_status
          est.playlists.push({
            id, playlist_id: pid, items_read_at: texto(p.items_read_at), items_status: st === 'ok' || st === 'parcial' || st === 'erro' ? st : null,
            items_reason: texto(p.items_reason), missing_since: texto(p.missing_since), item_count: typeof p.item_count === 'number' ? p.item_count : null,
          })
        }
        const leituras = await this.lerLeituras(bloco)
        for (const [canal, l] of leituras) {
          const est = out.get(canal)
          if (est) { est.empty_streak = l.empty_streak; est.sections_empty_streak = l.sections_empty_streak; est.last_cycle_at = l.last_cycle_at }
        }
      }
      // a última versão de seções de cada canal: uma consulta de 1 linha por canal (poucos canais por disparo)
      await Promise.all(channelIds.map(async canal => {
        let res: { data: unknown; error: { code?: unknown; message?: unknown } | null }
        try {
          res = await sb.from('competitor_channel_sections').select('raw').eq('competitor_channel_id', canal)
            .order('observed_at', { ascending: false }).order('id', { ascending: false }).limit(1).abortSignal(AbortSignal.timeout(BANCO_MS))
        } catch { throw converter(null) }
        if (res.error) throw converter(res.error)
        if (!Array.isArray(res.data)) throw converter(null)
        const est = out.get(canal)
        if (!est || res.data.length === 0) return
        const raw = ehObj(res.data[0]) ? res.data[0].raw : null
        const itens = ehObj(raw) ? raw.items : null
        if (!Array.isArray(itens)) throw converter(null)
        est.ultima_secao_vazia = itens.length === 0
      }))
      return out
    },

    async canaisComSecoes(channelIds) {
      const com = new Set<string>()
      for (const bloco of blocos(channelIds)) {
        const linhas = await paginar((de, ate) => sb.from('competitor_channel_sections').select('competitor_channel_id')
          .in('competitor_channel_id', bloco).order('competitor_channel_id').order('id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)))
        for (const l of linhas) { const id = texto(l.competitor_channel_id); if (id !== null) com.add(id) }
      }
      return com.size
    },

    async itensPresentes(playlistRef) {
      let res: { count: number | null; error: { code?: unknown; message?: unknown } | null }
      try {
        res = await sb.from('competitor_playlist_items').select('item_id', { count: 'exact', head: true }).eq('playlist_ref', playlistRef).is('removed_since', null).abortSignal(AbortSignal.timeout(BANCO_MS))
      } catch { throw converter(null) }
      if (res.error || typeof res.count !== 'number') throw converter(res.error)
      return res.count
    },

    async playlistsRecord(a) {
      const d = await rpc(sb, 'competitor_x3_playlists_record', { p_site: a.siteId, p_channel: a.channelId, p_now: new Date(a.nowMs).toISOString(), p_rows: a.rows, p_complete: a.complete, p_ocultas: a.ocultas })
      if (!ehObj(d) || !ehObj(d.ids)) throw converter(null)
      const ids = new Map<string, string>()
      for (const [k, v] of Object.entries(d.ids)) if (typeof v === 'string') ids.set(k, v)
      return { ids, atrasada: d.atrasada === true, sumidas: inteiro(d.sumidas), versoes: inteiro(d.versoes), aConfirmar: inteiro(d.a_confirmar) }
    },

    async itemsRecord(a) {
      const d = await rpc(sb, 'competitor_x3_items_record', {
        p_site: a.siteId, p_channel: a.channelId, p_playlist: a.playlistRef, p_now: new Date(a.nowMs).toISOString(),
        p_rows: a.rows, p_complete: a.complete, p_status: a.status, p_reason: a.reason,
      })
      if (!ehObj(d)) throw converter(null)
      return { gravados: inteiro(d.gravados), saidos: inteiro(d.saidos), massa: d.saida_em_massa_a_confirmar === true, atrasada: d.atrasada === true }
    },

    async sectionsRecord(a) {
      const d = await rpc(sb, 'competitor_x3_sections_record', { p_site: a.siteId, p_channel: a.channelId, p_now: new Date(a.nowMs).toISOString(), p_sha: a.sha, p_raw: a.raw })
      if (typeof d !== 'number') throw converter(null)
      return d
    },

    async visitClose(a) {
      await rpc(sb, 'competitor_x3_visit_close', {
        p_site: a.siteId, p_channel: a.channelId, p_now: new Date(a.nowMs).toISOString(), p_status: a.status, p_reason: a.reason,
        p_units: a.units, p_left: a.left, p_lista_vazia: a.listaVazia, p_secoes_vazias: a.secoesVazias, p_ciclo: a.ciclo,
        p_list_total: a.listTotal ?? undefined, p_list_read: a.listRead ?? undefined,
      })
    },

    async registrarCota(a) {
      await recordQuota(sb, { siteId: a.siteId, nowMs: a.nowMs, units: a.units, mode: 'competitors_playlists', ...(a.extra ? { extra: a.extra } : {}) })
    },
  }
}
