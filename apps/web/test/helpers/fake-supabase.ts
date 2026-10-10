// In-memory PostgREST stand-in for the observatory loaders: filters, column list, order and range behave like the
// real thing for the calls the loaders make, and every request is counted (one entry in `trips` per round trip).
import type { SupabaseClient } from '@supabase/supabase-js'

export type Row = Record<string, unknown>
export interface FakeDb {
  client: SupabaseClient
  /** One table name per request, in order. */
  trips: string[]
  /** The column list of every select, to prove a column was not asked for. */
  selects: Array<{ table: string; cols: string }>
  /** JSON length of everything returned. */
  bytes: number
  tables: Record<string, Row[]>
}
type Result = { data: unknown; error: { message: string; code: string } | null }
/** Foreign keys the loaders embed through (`child.fk → parent.id`): enough for `competitor_videos!inner(competitor_channels!inner(site_id))`. */
const FK: Record<string, Record<string, string>> = {
  competitor_video_daily: { competitor_videos: 'video_id' },
  competitor_videos: { competitor_channels: 'competitor_channel_id' },
}
const cmp = (a: unknown, b: unknown) => (a === b ? 0 : (a as string | number) < (b as string | number) ? -1 : 1)

export function fakeSupabase(tables: Record<string, Row[]>, opts: { failOn?: string } = {}): FakeDb {
  const db = { trips: [] as string[], selects: [] as Array<{ table: string; cols: string }>, bytes: 0 }
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])]
    let cols: string[] | null = null
    const orders: Array<{ col: string; asc: boolean }> = []
    // value of a dotted column ("competitor_videos.competitor_channels.site_id") reached through the FK map above
    const reach = (r: Row, path: string[], tbl: string): unknown => {
      if (path.length === 1) return r[path[0]!]
      const parent = path[0]!, fk = FK[tbl]?.[parent]
      const p = fk ? (tables[parent] ?? []).find(x => x.id === r[fk]) : undefined
      return p ? reach(p, path.slice(1), parent) : undefined
    }
    const run = (slice?: [number, number], single?: boolean): Result => {
      db.trips.push(table)
      if (opts.failOn === table) return { data: null, error: { message: 'boom', code: 'XX000' } }
      const sorted = [...rows].sort((a, b) => { for (const o of orders) { const c = cmp(a[o.col], b[o.col]); if (c) return o.asc ? c : -c } return 0 })
      const page = slice ? sorted.slice(slice[0], slice[1] + 1) : sorted
      const out = page.map(r => (cols ? Object.fromEntries(cols.map(c => [c, r[c] ?? null])) : r))
      const data = single ? out[0] ?? null : out
      db.bytes += JSON.stringify(data).length
      return { data, error: null }
    }
    const q = {
      select(s: string) { db.selects.push({ table, cols: s }); cols = s === '*' ? null : s.replace(/,?\s*[a-z_]+!inner\(.*$/, '').split(',').map(x => x.trim()).filter(Boolean); return q },
      eq(c: string, v: unknown) { rows = c.includes('.') ? rows.filter(r => reach(r, c.split('.'), table) === v) : rows.filter(r => r[c] === v); return q },
      neq(c: string, v: unknown) { rows = rows.filter(r => r[c] !== v); return q },
      in(c: string, vs: readonly unknown[]) { const set = new Set(vs); rows = rows.filter(r => set.has(r[c])); return q },
      is(c: string, v: unknown) { rows = rows.filter(r => (r[c] ?? null) === v); return q },
      gte(c: string, v: string) { rows = rows.filter(r => String(r[c]) >= v); return q },
      lte(c: string, v: string) { rows = rows.filter(r => String(r[c]) <= v); return q },
      order(c: string, o?: { ascending?: boolean }) { orders.push({ col: c, asc: o?.ascending !== false }); return q },
      range: async (a: number, b: number) => run([a, b]),
      maybeSingle: async () => run(undefined, true),
      then: (ok: (r: Result) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, ko),
    }
    return q
  }
  // trips and selects are the live arrays; bytes is a number, so it is read through a getter
  return { client: { from } as unknown as SupabaseClient, tables, trips: db.trips, selects: db.selects, get bytes() { return db.bytes } }
}
