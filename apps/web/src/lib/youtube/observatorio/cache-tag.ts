// Observatório — the cache tags of a site's heavy rows, the stable cache key and the invalidation. Whoever writes
// competitor_videos, competitor_video_versions, competitor_video_daily or competitor_channel_snapshots (or deletes the
// channel they hang from) calls invalidateObservatory at the end (test/youtube/observatorio/cache-writers.test.ts fails
// a writer that does not).
import { revalidateTag } from 'next/cache'

export const observatoryTag = (siteId: string): string => 'observatorio:' + siteId
/** The tag of one channel (competitor_channels.id, the row, never the YouTube channel id). */
export const observatoryChannelTag = (siteId: string, channelId: string): string => 'observatorio:' + siteId + ':' + channelId
/** The only tags an entry of a channel carries: the site's (the "no list" fallback drops it) and the channel's own. */
export const tagsDoCanal = (siteId: string, channelId: string): string[] => [observatoryTag(siteId), observatoryChannelTag(siteId, channelId)]

/**
 * The name of every unstable_cache entry of the Observatório. Next puts `cb.toString()` in the key, and the minified
 * text of a callback differs per bundle (route, page): the same channel was stored once per bundle. With a fixed name
 * (comChaveFixa) every bundle reads and writes the same entry. The version of the format lives in the keyParts.
 */
export const ENTRADAS = {
  pacote: 'observatorio-pack',
  medidas: 'medidas-telas',
  serie: 'medidas-telas-serie',
  mudancas: 'medidas-telas-mudancas',
  horas: 'medidas-telas-horas',
  video: 'medidas-telas-video',
  avisoArquivo: 'arquivo-aviso-leve',
  sinalBanco: 'arquivo-sinal-banco',
} as const
export type Entrada = (typeof ENTRADAS)[keyof typeof ENTRADAS]

/**
 * Wraps a cache callback so that its text, which Next puts in the key, is the fixed name of the entry (plus the
 * deploy environment: a preview reads the production database and must not write production's entries). Everything
 * that changes the stored value goes in the keyParts or in the arguments, never in the closure.
 */
export function comChaveFixa<A extends unknown[], R>(nome: Entrada, cb: (...a: A) => R): (...a: A) => R {
  const f = (...a: A): R => cb(...a)
  f.toString = () => nome + ':' + (process.env.VERCEL_ENV ?? 'local')
  return f
}

/**
 * Drops the cached entries of the given channels (competitor_channels.id) of the site; with no list, an empty one or
 * one out of shape, it drops the whole site, never nothing. The next render reads the database and waits for it
 * ({ expire: 0 }; the one-argument form is deprecated in Next 16). Only works inside a request (Route Handler, Server
 * Action or an after() callback of one): outside it Next throws, which is the right outcome for a caller that cannot
 * invalidate.
 */
export function invalidateObservatory(siteId: string, channelIds?: readonly string[] | null): void {
  // a list with any item out of shape is a list out of shape: the whole site, never a partial list
  const ids = Array.isArray(channelIds) && channelIds.every(x => typeof x === 'string' && x !== '') ? [...new Set(channelIds)] : []
  // the tag in a variable: test/lib/cache/revalidate-tag-parity.test.ts reads a nested call as a one-argument revalidateTag
  if (ids.length === 0) {
    const tag = observatoryTag(siteId)
    revalidateTag(tag, { expire: 0 })
    return
  }
  for (const id of ids) {
    const tag = observatoryChannelTag(siteId, id)
    revalidateTag(tag, { expire: 0 })
  }
}
