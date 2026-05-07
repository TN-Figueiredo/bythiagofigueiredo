import type { SupabaseClient } from '@supabase/supabase-js'
import { put } from '@vercel/blob'
import { fetchInstagramMedia } from './api-client'
import type { InstagramAccountRow, SyncResult } from './types'

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

  for (const item of media) {
    const isNew = !existingMap.has(item.id)
    let cachedImageUrl = existingMap.get(item.id) ?? null

    if (isNew) {
      const urlToCache = item.media_type === 'VIDEO'
        ? (item.thumbnail_url ?? item.media_url)
        : item.media_url

      if (urlToCache) {
        try {
          const imgRes = await fetch(urlToCache)
          if (imgRes.ok) {
            const buffer = Buffer.from(await imgRes.arrayBuffer())
            const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
            const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
            const blobResult = await put(
              `instagram/${account.id}/${item.id}.${ext}`,
              buffer,
              { access: 'public', addRandomSuffix: false, contentType },
            )
            cachedImageUrl = blobResult.url
            result.mediaCached++
          }
        } catch {
          // media cache failure is non-fatal
        }
      }
    }

    const row = {
      account_id: account.id,
      ig_media_id: item.id,
      media_type: item.media_type,
      media_url: item.media_url,
      thumbnail_url: item.thumbnail_url ?? null,
      cached_image_url: cachedImageUrl,
      caption: item.caption,
      permalink: item.permalink,
      like_count: item.like_count,
      comments_count: item.comments_count,
      ig_timestamp: item.timestamp,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('instagram_posts').upsert(row, {
      onConflict: 'ig_media_id',
    })

    if (!error) {
      if (isNew) result.postsInserted++
      else result.postsUpdated++
    }
  }

  await supabase
    .from('instagram_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', account.id)

  return result
}
