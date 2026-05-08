import type { SupabaseClient } from '@supabase/supabase-js'
import { put } from '@vercel/blob'
import { fetchInstagramMedia, type InstagramMediaItem } from './api-client'
import type { InstagramAccountRow, SyncResult } from './types'

const IMAGE_CACHE_CONCURRENCY = 5

async function cacheImage(
  accountId: string,
  item: InstagramMediaItem,
): Promise<string | null> {
  const urlToCache = item.media_type === 'VIDEO'
    ? (item.thumbnail_url ?? item.media_url)
    : item.media_url

  if (!urlToCache) return null

  try {
    const imgRes = await fetch(urlToCache)
    if (!imgRes.ok) return null
    const buffer = Buffer.from(await imgRes.arrayBuffer())
    const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
    const blobResult = await put(
      `instagram/${accountId}/${item.id}.${ext}`,
      buffer,
      { access: 'public', addRandomSuffix: false, contentType },
    )
    return blobResult.url
  } catch {
    return null
  }
}

async function cacheImagesInBatches(
  accountId: string,
  items: InstagramMediaItem[],
): Promise<Map<string, string>> {
  const cached = new Map<string, string>()
  for (let i = 0; i < items.length; i += IMAGE_CACHE_CONCURRENCY) {
    const batch = items.slice(i, i + IMAGE_CACHE_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((item) => cacheImage(accountId, item)),
    )
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value) {
        cached.set(batch[idx]!.id, r.value)
      }
    })
  }
  return cached
}

export async function syncInstagramAccount(
  supabase: SupabaseClient,
  account: InstagramAccountRow,
): Promise<SyncResult> {
  if (!account.access_token) throw new Error('No access token')
  if (!account.ig_user_id) throw new Error('No Instagram user ID')

  const result: SyncResult = { postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0 }

  const media = await fetchInstagramMedia(account.ig_user_id, account.access_token)
  result.postsFound = media.length

  if (media.length === 0) return result

  const mediaIds = media.map((m) => m.id)
  const { data: existing } = await supabase
    .from('instagram_posts')
    .select('ig_media_id, cached_image_url')
    .eq('account_id', account.id)
    .in('ig_media_id', mediaIds)

  const existingMap = new Map(
    (existing ?? []).map((r: { ig_media_id: string; cached_image_url: string | null }) => [r.ig_media_id, r.cached_image_url]),
  )

  const newItems = media.filter((m) => !existingMap.has(m.id))
  const cachedUrls = await cacheImagesInBatches(account.id, newItems)
  result.mediaCached = cachedUrls.size

  const rows = media.map((item) => ({
    account_id: account.id,
    ig_media_id: item.id,
    media_type: item.media_type,
    media_url: item.media_url,
    thumbnail_url: item.thumbnail_url ?? null,
    cached_image_url: cachedUrls.get(item.id) ?? existingMap.get(item.id) ?? null,
    caption: item.caption,
    permalink: item.permalink,
    like_count: item.like_count,
    comments_count: item.comments_count,
    ig_timestamp: item.timestamp,
  }))

  const { error, count } = await supabase
    .from('instagram_posts')
    .upsert(rows, { onConflict: 'ig_media_id', count: 'exact' })

  if (!error) {
    result.postsInserted = newItems.length
    result.postsUpdated = (count ?? rows.length) - newItems.length
  }

  await supabase
    .from('instagram_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', account.id)

  return result
}
