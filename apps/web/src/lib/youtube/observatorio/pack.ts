// Observatório — the heavy rows of ONE channel as one cache entry: JSON → gzip → base64.
// Next's data cache refuses an entry whose JSON is over 2 MB (next/dist/server/lib/incremental-cache/index.js:
// a console.warn in production, nothing stored). A year of daily records of one channel is 3 to 11 MB of JSON and
// 0.5 to 1.9 MB packed; a base64 string has no quotes to escape, so what is stored is its length plus a small envelope.
import { gzipSync, gunzipSync } from 'node:zlib'
import type { VideoRow, VersionRow, DailyRow, SnapshotRow } from './load'

/** Part of the cache key: bump it whenever ChannelRows or the row shapes change (an entry outlives a deploy). */
export const PACK_VERSION = 1
/** Characters of a packed channel that are safe to store (limit 2 097 152, minus the entry envelope and a margin). */
export const PACK_BUDGET = 2_000_000

export interface ChannelRows { videos: VideoRow[]; versions: VersionRow[]; daily: DailyRow[]; snapshots: SnapshotRow[] }

export function packChannel(rows: ChannelRows): string {
  return gzipSync(JSON.stringify({ v: PACK_VERSION, videos: rows.videos, versions: rows.versions, daily: rows.daily, snapshots: rows.snapshots })).toString('base64')
}

/** null = not a pack of this version (another build wrote it, or it is damaged): the caller reads the database. */
export function unpackChannel(packed: unknown): ChannelRows | null {
  if (typeof packed !== 'string' || !packed) return null
  try {
    const o: unknown = JSON.parse(gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'))
    if (typeof o !== 'object' || o === null || Array.isArray(o)) return null
    const p = o as { v?: unknown; videos?: unknown; versions?: unknown; daily?: unknown; snapshots?: unknown }
    if (p.v !== PACK_VERSION || !Array.isArray(p.videos) || !Array.isArray(p.versions) || !Array.isArray(p.daily) || !Array.isArray(p.snapshots)) return null
    return { videos: p.videos as VideoRow[], versions: p.versions as VersionRow[], daily: p.daily as DailyRow[], snapshots: p.snapshots as SnapshotRow[] }
  } catch {
    return null
  }
}
