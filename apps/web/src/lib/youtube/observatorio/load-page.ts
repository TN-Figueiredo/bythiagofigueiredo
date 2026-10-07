// Observatório — the loader of the CMS pages. Live tables are read on every render; the heavy rows of each channel
// come from Next's data cache (one packed entry per channel, tag observatorio:<siteId>).
//
// SECURITY: everything here reads with the service client (no RLS) and what it reads is stored. The cached function
// takes no session, cookie or header; `siteId` is part of the key and of the tag. The CALLER decides who may see a
// site (competitors/_chrome/page-data.ts runs the access guard first) and `siteId` must come from getSiteContext(),
// never from a URL parameter. Channel ids come from the site-filtered read of competitor_channels below.
import 'server-only'
import { unstable_cache } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import type { Dataset } from './types'
import { loadLiveRows, mapLimit, rowsToDataset, type ObservatoryRows } from './load'
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

/** The cached function: every argument is part of the key. `seriesStart` null = no daily record yet (never the clock). */
async function buildPack(siteId: string, channelId: string, videoLimit: number, seriesStart: number | null): Promise<string> {
  // a database error throws here and nothing is stored: a failed read is never cached as an empty channel
  const packed = packChannel(await loadChannelRows(getSupabaseServiceClient(), { channelId, videoLimit, seriesStart, now: observatoryNow() }))
  // Next will not store it (and says so only in a console.warn): every render of this channel reads the database again
  if (packed.length > PACK_BUDGET) warn('observatório: o pacote do canal ' + channelId + ' passou do orçamento do cache (' + packed.length + ' de ' + PACK_BUDGET + ' caracteres)', { siteId, channelId, size: packed.length })
  return packed
}
const cachedPack = (siteId: string) => unstable_cache(buildPack, ['observatorio-pack', String(PACK_VERSION)], { tags: [observatoryTag(siteId)], revalidate: PACK_TTL_SECONDS })

export async function loadPageRows(siteId: string, now: number): Promise<ObservatoryRows> {
  const sb = getSupabaseServiceClient()
  const { seriesStartAt, ...live } = await loadLiveRows(sb, siteId, now)
  const read = observatoryCacheEnabled() ? cachedPack(siteId) : null
  const parts = await mapLimit(live.channels, CHANNEL_CONCURRENCY, async (c): Promise<ChannelRows> => {
    const direct = () => loadChannelRows(sb, { channelId: c.id, videoLimit: c.video_limit, seriesStart: seriesStartAt, now })
    if (!read) return direct()
    const rows = unpackChannel(await read(siteId, c.id, c.video_limit, seriesStartAt))
    if (rows) return rows
    // an entry of another PACK_VERSION or a damaged one: this render reads the database, never an empty channel
    warn('observatório: a entrada de cache do canal ' + c.id + ' não pôde ser lida; a tela leu o banco', { siteId, channelId: c.id })
    return direct()
  })
  return assembleRows(live, parts, seriesStartAt, now)
}

/** Cached rows, fresh clock: the dataset is always built with this render's `now`. */
export async function loadPageDataset(siteId: string, now: number): Promise<Dataset> {
  return rowsToDataset(await loadPageRows(siteId, now), now)
}
