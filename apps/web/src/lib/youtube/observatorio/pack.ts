// Observatório — the heavy rows of ONE channel as one cache entry: JSON → gzip → base64.
// Next's data cache refuses an entry whose JSON is over 2 MB (next/dist/server/lib/incremental-cache/index.js:
// a console.warn in production, nothing stored). A year of daily records of one channel is 3 to 11 MB of JSON and
// 0.5 to 1.9 MB packed; a base64 string has no quotes to escape, so what is stored is its length plus a small envelope.
import { gzipSync, gunzipSync } from 'node:zlib'
import type { VideoRow, VersionRow, DailyRow, SnapshotRow, SpanRow } from './load'

/**
 * Part of the cache key: bump it whenever ChannelRows, the row shapes or the columns load-channel.ts selects change (an
 * entry outlives a deploy). test/youtube/observatorio/pack-shape.test.ts holds the portrait of the shape of this
 * version and fails when one changes without the other.
 * 1 = the first shape. 2 = A5 (E2): `series_tier` nos vídeos, a lista `spans`, e a série de todo vídeo datado.
 */
export const PACK_VERSION = 2
/** Characters of a packed channel that are safe to store (limit 2 097 152, minus the entry envelope and a margin). */
export const PACK_BUDGET = 2_000_000

export interface ChannelRows { videos: VideoRow[]; versions: VersionRow[]; daily: DailyRow[]; snapshots: SnapshotRow[]; spans: SpanRow[]; /** a série dos não observados e as faixas ficaram de fora (não coube) */ weeklyOmitted?: boolean }

export function packChannel(rows: ChannelRows): string {
  return gzipSync(JSON.stringify({ v: PACK_VERSION, videos: rows.videos, versions: rows.versions, daily: rows.daily, snapshots: rows.snapshots, spans: rows.spans, ...(rows.weeklyOmitted ? { weeklyOmitted: true } : {}) })).toString('base64')
}

/**
 * A5 (E2, spec 4.3 efeito 3). Um ano de série diária E semanal do maior canal de hoje ocupa cerca de um terço do orçamento;
 * um canal no teto (200 diários e centenas de semanais) passa. Aí o pacote é refeito só com a série dos OBSERVADOS (o que as
 * telas leem hoje) e leva a marca: quem lê sabe que a série semanal daquele canal não veio, em vez de receber um pacote que
 * o cache recusaria em silêncio.
 */
export function packWithinBudget(rows: ChannelRows, observedIds: ReadonlySet<string>): { packed: string; weeklyOmitted: boolean } {
  const full = packChannel(rows)
  if (full.length <= PACK_BUDGET) return { packed: full, weeklyOmitted: false }
  return { packed: packChannel({ ...rows, daily: rows.daily.filter(d => observedIds.has(d.video_id)), spans: [], weeklyOmitted: true }), weeklyOmitted: true }
}

/** null = not a pack of this version (another build wrote it, or it is damaged): the caller reads the database. */
export function unpackChannel(packed: unknown): ChannelRows | null {
  if (typeof packed !== 'string' || !packed) return null
  try {
    const o: unknown = JSON.parse(gunzipSync(Buffer.from(packed, 'base64')).toString('utf8'))
    if (typeof o !== 'object' || o === null || Array.isArray(o)) return null
    const p = o as { v?: unknown; videos?: unknown; versions?: unknown; daily?: unknown; snapshots?: unknown; spans?: unknown; weeklyOmitted?: unknown }
    if (p.v !== PACK_VERSION || !Array.isArray(p.videos) || !Array.isArray(p.versions) || !Array.isArray(p.daily) || !Array.isArray(p.snapshots) || !Array.isArray(p.spans)) return null
    return { videos: p.videos as VideoRow[], versions: p.versions as VersionRow[], daily: p.daily as DailyRow[], snapshots: p.snapshots as SnapshotRow[], spans: p.spans as SpanRow[], ...(p.weeklyOmitted === true ? { weeklyOmitted: true } : {}) }
  } catch {
    return null
  }
}
