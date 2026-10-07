// Observatório — the cache tag of a site's heavy rows and its invalidation. Whoever writes competitor_videos,
// competitor_video_versions, competitor_video_daily or competitor_channel_snapshots (or deletes the channel they hang
// from) calls invalidateObservatory at the end (test/youtube/observatorio/cache-writers.test.ts fails a writer that
// does not).
import { revalidateTag } from 'next/cache'

export const observatoryTag = (siteId: string): string => 'observatorio:' + siteId

/**
 * Drops every cached channel of the site: the next render reads the database and waits for it ({ expire: 0 }; the
 * one-argument form is deprecated in Next 16). Only works inside a request (Route Handler, Server Action or an
 * after() callback of one): outside it Next throws, which is the right outcome for a caller that cannot invalidate.
 */
export function invalidateObservatory(siteId: string): void {
  // the tag in a variable: test/lib/cache/revalidate-tag-parity.test.ts reads a nested call as a one-argument revalidateTag
  const tag = observatoryTag(siteId)
  revalidateTag(tag, { expire: 0 })
}
