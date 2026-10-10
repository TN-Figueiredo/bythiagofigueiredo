// Observatório — the loader of the CMS pages. Live tables are read on every render; the heavy rows of each channel
// come from Next's data cache (one packed entry per channel, tag observatorio:<siteId>).
//
// SECURITY: everything here reads with the service client (no RLS) and what it reads is stored. The cached function
// takes no session, cookie or header; `siteId` is part of the key and of the tag. The CALLER decides who may see a
// site (competitors/_chrome/page-data.ts runs the access guard first) and `siteId` must come from getSiteContext(),
// never from a URL parameter. Channel ids come from the site-filtered read of competitor_channels below.
import 'server-only'
import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Dataset } from './types'
import { loadLiveRows, loadChannelLiveRows, mapLimit, rowsToDataset, type ChannelRow, type ObservatoryRows } from './load'
import { loadChannelRows, assembleRows } from './load-channel'
import { packChannel, unpackChannel, PACK_VERSION, PACK_BUDGET, type ChannelRows } from './pack'
import { observatoryTag } from './cache-tag'
import { observatoryNow } from './now'

/**
 * Safety net for a write that did not invalidate (a sync killed before its end, a writer added without the call):
 * after this many seconds the entry is served once more and recomputed in the background.
 */
export const PACK_TTL_SECONDS = 900
/** Channels read at the same time (each one runs up to three reads in parallel). */
const CHANNEL_CONCURRENCY = 6

/**
 * Off only for the fidelity e2e (OBS_E2E=1 outside production, the gate of observatoryNow): that suite reseeds the
 * database between states and freezes the clock, and a cached channel would show the previous state.
 */
export function observatoryCacheEnabled(): boolean {
  return !(process.env.NODE_ENV !== 'production' && process.env.OBS_E2E === '1')
}

const warn = (message: string, extra: Record<string, unknown>) => {
  console.warn(message)
  Sentry.captureMessage(message, { level: 'warning', tags: { component: 'observatorio', step: 'cache' }, extra })
}

/**
 * The cached function: every argument is part of the key. `seriesStart` null = no daily record yet (never the clock).
 *
 * `okSyncedAt` (the channel's last_ok_synced_at, read live by this render) is in the key and nowhere else. rowsToDataset
 * compares the channel's last good sync, which is live, with each pinned video's own check, which comes from the pack:
 * a pack older than that sync has the check of before it, and the pinned video read as "o YouTube não devolveu este
 * vídeo" from the moment the sync marked the channel until the cron batch invalidated the site, minutes later. With the
 * mark in the key, a pack is only ever paired with the mark its builder saw: it was read after that sync wrote the
 * check (competitor-sync.ts writes the video first and the channel last), so it holds that check or the video really
 * did not come back.
 */
async function buildPack(siteId: string, channelId: string, videoLimit: number, seriesStart: number | null, okSyncedAt: string): Promise<string> {
  void okSyncedAt
  // a database error throws here and nothing is stored: a failed read is never cached as an empty channel
  const packed = packChannel(await loadChannelRows(getSupabaseServiceClient(), { channelId, videoLimit, seriesStart, now: observatoryNow() }))
  // Next will not store it (and says so only in a console.warn): every render of this channel reads the database again
  if (packed.length > PACK_BUDGET) warn('observatório: o pacote do canal ' + channelId + ' passou do orçamento do cache (' + packed.length + ' de ' + PACK_BUDGET + ' caracteres)', { siteId, channelId, size: packed.length })
  return packed
}
const cachedPack = (siteId: string) => unstable_cache(buildPack, ['observatorio-pack', String(PACK_VERSION)], { tags: [observatoryTag(siteId)], revalidate: PACK_TTL_SECONDS })

/** One channel's heavy rows: the stored pack when it can be trusted, the database otherwise. */
async function readChannel(sb: SupabaseClient, siteId: string, c: ChannelRow, seriesStartAt: number | null, now: number): Promise<ChannelRows> {
  const direct = () => loadChannelRows(sb, { channelId: c.id, videoLimit: c.video_limit, seriesStart: seriesStartAt, now })
  // A channel that never finished a sync is filling up right now (the first sync runs in after() and writes for up to
  // a minute, invalidating only at its end): a stored pack would freeze "buscando vídeos (N de M)" at the count of the
  // first render. It has few rows, so it is read on every render until its first good sync.
  if (!observatoryCacheEnabled() || c.last_ok_synced_at == null) return direct()
  const rows = unpackChannel(await cachedPack(siteId)(siteId, c.id, c.video_limit, seriesStartAt, c.last_ok_synced_at))
  if (rows) return rows
  // an entry of another PACK_VERSION or a damaged one: this render reads the database, never an empty channel
  warn('observatório: a entrada de cache do canal ' + c.id + ' não pôde ser lida; a tela leu o banco', { siteId, channelId: c.id })
  return direct()
}

export async function loadPageRows(siteId: string, now: number): Promise<ObservatoryRows> {
  const sb = getSupabaseServiceClient()
  const { seriesStartAt, ...live } = await loadLiveRows(sb, siteId, now)
  const parts = await mapLimit(live.channels, CHANNEL_CONCURRENCY, c => readChannel(sb, siteId, c, seriesStartAt, now))
  return assembleRows(live, parts, seriesStartAt, now)
}

/**
 * The dataset of ONE channel of this site, without reading the others (spec telas v9, 5.10). Same pack and same cache
 * key as loadPageRows: a channel the list already warmed costs no heavy read here. null = not a channel of this site.
 * WHAT IT SERVES: what a channel's own screen computes about that channel (its row, its videos with series, versions,
 * multiplier, phase and effect; channelStats, cadence, SYNC, OBS_START and LAST_IDX, which carry the site's values
 * through `siteScope` / `lastSeriesAt`). WHAT IT DOES NOT: anything that aggregates ACROSS channels (channel slots, niche
 * reference and stats, heatmap, theme trend, the insights' base and the forja's), because the set holds this channel
 * alone. The dataset says so (`scope: 'canal'`) and those functions throw on it (assertSiteScope) instead of
 * returning the channel's number as if it were the site's. `readings` and `requests` are the site's whole.
 * SECURITY: service client, no RLS. The caller runs the access guard first and takes `siteId` from getSiteContext();
 * `channelId` may come from the URL, and loadChannelLiveRows refuses one of another site.
 */
export async function loadChannelDataset(siteId: string, channelId: string, now: number): Promise<Dataset | null> {
  const sb = getSupabaseServiceClient()
  const found = await loadChannelLiveRows(sb, siteId, channelId, now)
  if (!found) return null
  const { seriesStartAt, ...live } = found
  const parts = await mapLimit(live.channels, 1, c => readChannel(sb, siteId, c, seriesStartAt, now))
  return rowsToDataset(assembleRows(live, parts, seriesStartAt, now), now)
}

/** Cached rows, fresh clock: the dataset is always built with this render's `now`. */
export async function loadPageDataset(siteId: string, now: number): Promise<Dataset> {
  return rowsToDataset(await loadPageRows(siteId, now), now)
}
