import type { SupabaseClient } from '@supabase/supabase-js'
import { put } from '@vercel/blob'
import { fetchInstagramMedia, type InstagramMediaItem } from './api-client'
import type { InstagramAccountRow, SyncResult } from './types'

const IMAGE_CACHE_CONCURRENCY = 5
const IMAGE_FETCH_TIMEOUT_MS = 8_000
const IMAGE_FETCH_MIN_TIMEOUT_MS = 1_000

/** §5/§0(vi): erro cru da Meta nunca chega ao dono. */
const NOT_CONNECTED = "This account isn't connected — use Connect with Instagram"

/**
 * §0 linha A, item (ii): o `fetch` do Node não tem timeout padrão, então uma
 * conexão pendurada em `scontent.cdninstagram.com` prende o run
 * indefinidamente e a checagem ENTRE lotes nunca é alcançada.
 */
function imageTimeoutMs(deadlineAt: number | undefined): number {
  if (deadlineAt === undefined) return IMAGE_FETCH_TIMEOUT_MS
  return Math.max(
    IMAGE_FETCH_MIN_TIMEOUT_MS,
    Math.min(IMAGE_FETCH_TIMEOUT_MS, deadlineAt - Date.now()),
  )
}

async function cacheImage(
  accountId: string,
  item: InstagramMediaItem,
  deadlineAt?: number,
): Promise<string | null> {
  const urlToCache = item.media_type === 'VIDEO'
    ? (item.thumbnail_url ?? item.media_url)
    : item.media_url

  if (!urlToCache) return null

  try {
    const imgRes = await fetch(urlToCache, {
      signal: AbortSignal.timeout(imageTimeoutMs(deadlineAt)),
    })
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
  deadlineAt?: number,
): Promise<{ cached: Map<string, string>; partial: boolean }> {
  const cached = new Map<string, string>()

  for (let i = 0; i < items.length; i += IMAGE_CACHE_CONCURRENCY) {
    if (deadlineAt !== undefined && Date.now() >= deadlineAt) {
      return { cached, partial: true }
    }

    const batch = items.slice(i, i + IMAGE_CACHE_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((item) => cacheImage(accountId, item, deadlineAt)),
    )

    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value) {
        cached.set(batch[idx]!.id, r.value)
      }
    })

    // §0(ii): cada item do lote já é limitado pelo próprio `AbortSignal.timeout`
    // (via imageTimeoutMs), então o `await` acima nunca ultrapassa o prazo por
    // mais que alguns ms. Se um download pendurado consumiu o prazo inteiro
    // para terminar (só via abort), o run é parcial mesmo que este tenha sido
    // o último lote — não dependemos de um segundo timer correndo em paralelo
    // com o AbortSignal.timeout, o que seria uma corrida entre dois relógios
    // reais e indeterminística.
    if (deadlineAt !== undefined && Date.now() >= deadlineAt) {
      return { cached, partial: true }
    }
  }

  return { cached, partial: false }
}

export async function syncInstagramAccount(
  supabase: SupabaseClient,
  account: InstagramAccountRow,
  accessToken?: string,
  opts?: { deadlineAt?: number },
): Promise<SyncResult> {
  const token = accessToken ?? account.access_token
  if (!token) throw new Error(NOT_CONNECTED)
  if (!account.ig_user_id) throw new Error(NOT_CONNECTED)

  const result: SyncResult = {
    postsFound: 0, postsInserted: 0, postsUpdated: 0, mediaCached: 0,
    partial: false, mediaFailed: 0,
  }

  const media = await fetchInstagramMedia(account.ig_user_id, token)
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
  const { cached: cachedUrls, partial } = await cacheImagesInBatches(
    account.id, newItems, opts?.deadlineAt,
  )
  result.mediaCached = cachedUrls.size
  result.partial = partial
  result.mediaFailed = newItems.length - cachedUrls.size

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

  // (iv): o erro do upsert era engolido (`if (!error)`), o que fazia um run
  // que não gravou nada carimbar `last_synced_at` e reportar sucesso.
  if (error) {
    const upsertError = new Error(error.message) as Error & { code?: string }
    if (typeof error.code === 'string') upsertError.code = error.code
    throw upsertError
  }

  result.postsInserted = newItems.length
  result.postsUpdated = (count ?? rows.length) - newItems.length

  await supabase
    .from('instagram_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', account.id)

  return result
}
