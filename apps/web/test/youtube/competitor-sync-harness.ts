import { vi } from 'vitest'
import { getSupabaseServiceClient } from '@/lib/supabase/service'

// Falso do banco e auxiliares do sync de concorrentes (movidos de competitor-sync.test.ts, sem mudança de comportamento).
// O `vi.mock('@/lib/supabase/service', ...)` continua em cada arquivo de teste, que é onde o Vitest o iça.

export type Payload = { p_video_id: string; p_close: string[]; p_open: Array<Record<string, unknown>>; p_changes: Array<Record<string, unknown>> }

// ── fake supabase: recorded, thenable chains, scripted results ──
export interface Call { table: string; ops: Array<[string, unknown[]]> }
export type Script = (c: Call) => Record<string, unknown> | undefined
export function fakeDb(script: Script) {
  const calls: Call[] = []
  const from = (table: string) => {
    const call: Call = { table, ops: [] }
    calls.push(call)
    const b: Record<string, unknown> = {}
    const proxy: unknown = new Proxy(b, {
      get(_t, prop: string) {
        if (prop === 'then') {
          const res = script(call) ?? { data: null, error: null }
          return (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok)
        }
        return (...args: unknown[]) => { call.ops.push([prop, args]); return proxy }
      },
    })
    return proxy
  }
  const rpc = (name: string, args: unknown) => {
    const call: Call = { table: 'rpc:' + name, ops: [['rpc', [args]]] }
    calls.push(call)
    return Promise.resolve(script(call) ?? { data: null, error: null })
  }
  return { client: { from, rpc }, calls }
}
export const rpcs = (db: { calls: Call[] }) => db.calls.filter(c => c.table === 'rpc:apply_competitor_version_plan').map(c => c.ops[0]![1][0] as Payload)
export const first = (c: Call) => c.ops[0]![0]
export const arg = (c: Call, op: string) => c.ops.find(o => o[0] === op)?.[1][0] as Record<string, unknown> | undefined
export const NOW = new Date('2026-10-24T15:00:00.000Z') // 12:00 SP
export const NOW_ISO = NOW.toISOString()
export const ch = { id: 'cc-1', channel_id: 'UC_test', site_id: 'site-1' }
export const lockRow = { id: 'cc-1', sync_mode: 'incremental', full_sync_completed_at: null, video_limit: 50, last_ok_synced_at: '2026-10-24T09:00:00.000Z', sync_error_since: null }

export interface FetchLog { dailyCalls: string[] }
export function apiFetch(video: Record<string, unknown> | null, status = 200, extra: { daily?: (call: number, url: string) => Response | Record<string, unknown>[]; noUploads?: boolean; log?: FetchLog } = {}): typeof fetch {
  let dailyN = 0
  return (async (input: RequestInfo | URL) => {
    const u = String(input)
    if (status !== 200) return { ok: false, status }
    if (u.includes('/channels?')) {
      return Response.json({ items: [{ contentDetails: { relatedPlaylists: extra.noUploads ? {} : { uploads: 'UU' } }, snippet: { title: 'Canal' }, statistics: { subscriberCount: '10' } }] })
    }
    if (u.includes('/playlistItems?')) return Response.json({ items: video ? [{ snippet: { resourceId: { videoId: video.id } } }] : [] })
    if (u.includes('part=snippet,statistics&')) {
      dailyN++
      extra.log?.dailyCalls.push(u)
      if (extra.daily) {
        const r = extra.daily(dailyN, u)
        return r instanceof Response ? r : Response.json({ items: r })
      }
      return Response.json({ items: video ? [{ ...video, statistics: { viewCount: '7' } }] : [] })
    }
    return Response.json({ items: video ? [video] : [] })
  }) as typeof fetch
}
export const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString()

export type SetupOpts = {
  existing?: Record<string, unknown>[]; versions?: Record<string, unknown>[]; lastDaily?: string | null
  tracked?: Array<Record<string, unknown>>; dailyHave?: string[]; rpcError?: boolean; longs?: Array<{ video_id: string }>
  /** Pinned rows of the channel; null = the query answered without data. Omitted = no pins. */
  pinned?: Array<Record<string, unknown>> | null; pinnedError?: string; trackedError?: string
}

export function setup(opts: SetupOpts = {}) {
  const db = fakeDb((c) => {
    if (c.table === 'competitor_channels' && c.ops.some(o => o[0] === 'or')) return { data: [lockRow] }
    if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'gt' && o[1][1] === 180)) return { data: opts.longs ?? [] }
    if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'not')) return opts.pinnedError ? { data: null, error: { message: opts.pinnedError } } : { data: opts.pinned === undefined ? [] : opts.pinned, error: null }
    if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'in')) return { data: opts.existing ?? [] }
    if (c.table === 'competitor_videos' && first(c) === 'select' && c.ops.some(o => o[0] === 'limit')) return opts.trackedError ? { data: null, error: { message: opts.trackedError } } : { data: opts.tracked ?? [{ id: 'v-1', video_id: 'vid-1', title: null, thumbnail_url: null }] }
    if (c.table === 'competitor_videos' && first(c) === 'select') return { count: 100 }
    if (c.table === 'competitor_videos' && first(c) === 'insert') return { data: { id: 'v-new' } }
    if (c.table === 'competitor_video_daily' && first(c) === 'select') {
      const have = opts.dailyHave ?? (opts.lastDaily === '2026-10-24' ? ['v-1', 'v-new'] : [])
      return { data: have.map(video_id => ({ video_id })) }
    }
    if (c.table === 'competitor_video_daily' && first(c) === 'upsert') return { data: c.ops[0]![1][0] }
    if (c.table === 'competitor_video_versions' && first(c) === 'select') return { data: opts.versions ?? [] }
    if (c.table === 'rpc:apply_competitor_version_plan') {
      if (opts.rpcError) return { data: null, error: { message: 'boom' } }
      return { data: { opened: {}, changes: (c.ops[0]![1][0] as { p_changes: unknown[] }).p_changes.length } }
    }
    return { data: null, error: null }
  })
  vi.mocked(getSupabaseServiceClient).mockReturnValue(db.client as never)
  return db
}

export const EARLY = new Date(NOW.getTime() - 6 * 3_600_000) // 06:00 SP: not the daily pass
export const quiet = { probeBudget: { remaining: 0 }, deferBackfill: true } // no Shorts probe: only the API calls under test
/** Wraps a fetch and lists the YouTube Data API calls it saw, in order, without host and key. */
export function traced(inner: typeof fetch) {
  const urls: string[] = []
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => { urls.push(String(input)); return inner(input, init) }) as typeof fetch
  const api = () => urls.filter(u => u.includes('googleapis.com/youtube/v3/')).map(u => u.split('/youtube/v3/')[1]!.replace(/&key=.*$/, ''))
  return { f, api }
}

/** Os `update` gravados em competitor_videos para UMA linha (os corpos, na ordem). */
export const updatesOf = (db: { calls: Call[] }, uuid: string) => db.calls
  .filter(c => c.table === 'competitor_videos' && first(c) === 'update' && c.ops.some(o => o[0] === 'eq' && o[1][0] === 'id' && o[1][1] === uuid))
  .map(c => arg(c, 'update')!)
/** Os argumentos de cada chamada a uma função SQL, na ordem. */
export const rpcCalls = (db: { calls: Call[] }, name: string) => db.calls.filter(c => c.table === 'rpc:' + name).map(c => c.ops[0]![1][0] as Record<string, unknown>)
