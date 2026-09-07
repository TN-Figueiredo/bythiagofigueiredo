import type { SupabaseClient } from '@supabase/supabase-js'
import { put } from '@vercel/blob'
import * as Sentry from '@sentry/nextjs'
import { fetchInstagramMedia, type InstagramMediaItem } from './api-client'
import { claimAlert } from '@/lib/ops/alert-state'
import type { InstagramAccountRow, SyncResult } from './types'

const IMAGE_CACHE_CONCURRENCY = 5
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
// Timeout de download: ENTREGUE POR A (§0 linha A, item ii). C2 NÃO redefine,
// não renomeia e não reimplementa — copia o helper e as duas constantes de A
// verbatim para dentro do arquivo substituído.
const IMAGE_FETCH_TIMEOUT_MS = 8_000
const IMAGE_FETCH_MIN_TIMEOUT_MS = 1_000

function imageTimeoutMs(deadlineAt: number | undefined): number {
  if (deadlineAt === undefined) return IMAGE_FETCH_TIMEOUT_MS
  return Math.max(
    IMAGE_FETCH_MIN_TIMEOUT_MS,
    Math.min(IMAGE_FETCH_TIMEOUT_MS, deadlineAt - Date.now()),
  )
}

// Todo identificador vindo da Meta chega por cast puro (api-client.ts) — o
// mesmo portão de forma que §3.1 passo 7 dá aos ids da conexão.
const MEDIA_ID_RE = /^[0-9]{1,32}$/
// Sufixo ancorado: 'cdninstagram.com.evil.com' NÃO casa.
const CDN_HOST_RE = /(^|\.)cdninstagram\.com$|(^|\.)fbcdn\.net$/

const EXT_CONTENT_TYPE = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const
type AllowedExt = keyof typeof EXT_CONTENT_TYPE

/** Variável de RUN (nunca de módulo — módulo reseta em cold start). */
interface IRunFlags {
  urlRejected: boolean
}

function extFor(contentType: string | null): AllowedExt | null {
  const ct = (contentType ?? '').toLowerCase()
  if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return 'jpg'
  if (ct.includes('image/png')) return 'png'
  if (ct.includes('image/webp')) return 'webp'
  return null
}

/** Lê o corpo em stream com corte rígido. `null` = passou do teto. */
async function readCapped(res: Response, max: number): Promise<Buffer | null> {
  const body = res.body
  if (!body) {
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.byteLength > max ? null : buf
  }
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

async function cacheImage(
  accountId: string,
  item: InstagramMediaItem,
  deadlineAt: number | undefined,
  flags: IRunFlags,
): Promise<string | null> {
  // (i) forma do id — antes de tocar a rede ou o Blob. Hoje o valor da Meta
  // determinaria sozinho a chave do objeto (addRandomSuffix:false).
  if (!MEDIA_ID_RE.test(item.id)) return null

  const urlToCache =
    item.media_type === 'VIDEO' ? (item.thumbnail_url ?? item.media_url) : item.media_url
  if (!urlToCache) return null

  // (iv) destino de rede validado ANTES do fetch. Este é o único valor vindo da
  // Meta usado como DESTINO, e o corpo vai para um Blob `public` — um
  // media_url hostil seria exfiltração, não SSRF cega.
  const parsed = (() => {
    try {
      return new URL(urlToCache)
    } catch {
      return null
    }
  })()
  if (!parsed || parsed.protocol !== 'https:' || !CDN_HOST_RE.test(parsed.hostname)) {
    flags.urlRejected = true
    return null
  }

  try {
    // O `signal` é o de A (imageTimeoutMs) — inalterado. O que C2 acrescenta
    // aqui é só `redirect:'error'`: re-checar imgRes.url depois seria tarde
    // demais para um 302 de scontent.cdninstagram.com para endereço interno.
    const imgRes = await fetch(urlToCache, {
      redirect: 'error',
      signal: AbortSignal.timeout(imageTimeoutMs(deadlineAt)),
    })
    if (!imgRes.ok) return null

    // (iii) ext da allow-list; contentType DERIVADO dele, nunca ecoado.
    const ext = extFor(imgRes.headers.get('content-type'))
    if (ext === null) return null

    // (ii) teto de tamanho.
    const declared = imgRes.headers.get('content-length')
    let buffer: Buffer | null
    if (declared !== null) {
      const n = Number(declared)
      if (!Number.isFinite(n) || n > MAX_IMAGE_BYTES) return null
      buffer = Buffer.from(await imgRes.arrayBuffer())
      if (buffer.byteLength > MAX_IMAGE_BYTES) return null
    } else {
      buffer = await readCapped(imgRes, MAX_IMAGE_BYTES)
    }
    if (buffer === null) return null

    const blobResult = await put(`instagram/${accountId}/${item.id}.${ext}`, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: EXT_CONTENT_TYPE[ext],
    })
    return blobResult.url
  } catch {
    return null
  }
}

async function cacheImagesInBatches(
  accountId: string,
  items: InstagramMediaItem[],
  deadlineAt: number | undefined,
  flags: IRunFlags,
): Promise<{ cached: Map<string, string>; partial: boolean }> {
  const cached = new Map<string, string>()

  // Bloco de A (Task 4), copiado VERBATIM (deadline checado antes/depois de
  // cada lote; nenhum timer separado corre contra o Promise.allSettled — cada
  // download já é limitado pelo próprio AbortSignal.timeout via
  // imageTimeoutMs). A única diferença é o 4º argumento `flags`, conteúdo de
  // C2.
  //
  // Deviation do snippet do plano (documentada no relatório do bloco): o
  // plano introduzia aqui um `Promise.race` contra um `setTimeout` adicional
  // — apesar do próprio comentário do plano dizer "copiado verbatim". Isso
  // reimplementava o deadline handling que a Restrição 1 do bloco proíbe
  // redefinir, e quebrava
  // 'aborts a hung download and closes the batch on the remaining deadline':
  // o timer da corrida podia vencer o AbortSignal.timeout por uma margem de
  // arredondamento, fazendo o lote nunca terminar de fato (mediaFailed ficava
  // certo, mas `partial` saía `false`). A versão abaixo é a de A, sem o timer
  // extra.
  for (let i = 0; i < items.length; i += IMAGE_CACHE_CONCURRENCY) {
    if (deadlineAt !== undefined && Date.now() >= deadlineAt) {
      return { cached, partial: true }
    }

    const batch = items.slice(i, i + IMAGE_CACHE_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((item) => cacheImage(accountId, item, deadlineAt, flags)),
    )

    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value) {
        cached.set(batch[idx]!.id, r.value)
      }
    })

    if (deadlineAt !== undefined && Date.now() >= deadlineAt) {
      return { cached, partial: true }
    }
  }

  return { cached, partial: false }
}

export async function syncInstagramAccount(
  supabase: SupabaseClient,
  account: InstagramAccountRow,
  accessToken: string,
  opts?: { deadlineAt?: number },
): Promise<SyncResult> {
  if (!accessToken) throw new Error("This account isn't connected — use Connect with Instagram")
  if (!account.ig_user_id) {
    throw new Error("This account isn't connected — use Connect with Instagram")
  }

  const result: SyncResult = {
    postsFound: 0,
    postsInserted: 0,
    postsUpdated: 0,
    mediaCached: 0,
    partial: false,
    mediaFailed: 0,
  }

  const media = await fetchInstagramMedia(account.ig_user_id, accessToken)
  result.postsFound = media.length
  if (media.length === 0) return result

  const mediaIds = media.map((m) => m.id)
  const { data: existing } = await supabase
    .from('instagram_posts')
    .select('ig_media_id, cached_image_url')
    .eq('account_id', account.id)
    .in('ig_media_id', mediaIds)

  const existingMap = new Map(
    (existing ?? []).map(
      (r: { ig_media_id: string; cached_image_url: string | null }) =>
        [r.ig_media_id, r.cached_image_url] as const,
    ),
  )

  const brandNew = media.filter((m) => !existingMap.has(m.id))
  // Re-tentativa (MUST): a linha existe mas nunca conseguiu cache => tenta de novo.
  const newItems = media.filter((m) => !existingMap.has(m.id) || existingMap.get(m.id) == null)

  const flags: IRunFlags = { urlRejected: false }
  const { cached, partial } = await cacheImagesInBatches(
    account.id,
    newItems,
    opts?.deadlineAt,
    flags,
  )
  result.mediaCached = cached.size
  result.partial = partial
  result.mediaFailed = newItems.length - cached.size

  // 1× por RUN — silêncio total esconderia uma mudança de CDN da Meta.
  if (flags.urlRejected) Sentry.captureMessage('instagram media url rejected', 'warning')

  const rows = media.map((item) => ({
    account_id: account.id,
    ig_media_id: item.id,
    media_type: item.media_type,
    media_url: item.media_url,
    thumbnail_url: item.thumbnail_url ?? null,
    cached_image_url: cached.get(item.id) ?? existingMap.get(item.id) ?? null,
    caption: item.caption,
    permalink: item.permalink,
    like_count: item.like_count,
    comments_count: item.comments_count,
    ig_timestamp: item.timestamp,
  }))

  const { error, count } = await supabase
    .from('instagram_posts')
    .upsert(rows, { onConflict: 'account_id,ig_media_id', count: 'exact' })

  // Erro do upsert é LANÇADO (A) — engolir escondia a falha e ainda carimbava
  // last_synced_at. A FORMA do throw também é de A e não muda: um `Error` de
  // verdade com o `code` do Postgres preservado. `throw error` cru devolveria um
  // PostgrestError simples, e todo chamador testa `err instanceof Error`
  // (triggerInstagramSync => "Sync failed" genérico; cron => "[object Object]"
  // no error_message e o ramo de duplicata da janela C2→C4 sem casar).
  if (error) {
    const upsertError = new Error(error.message) as Error & { code?: string }
    if (typeof error.code === 'string') upsertError.code = error.code
    throw upsertError
  }

  result.postsInserted = brandNew.length
  result.postsUpdated = (count ?? rows.length) - brandNew.length

  await supabase
    .from('instagram_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', account.id)

  return result
}

/**
 * Fonte da verdade das "3 execuções consecutivas com mediaFailed > 0", sem
 * coluna nova: as 3 linhas `completed` mais recentes de `daily`/`manual`
 * (índice idx_instagram_sync_log_account_mode). `ops_alert_claim` é rate
 * limiter, nunca contador de sequência — daí a derivação em tempo de execução.
 * Chamado pelo cron do sync depois do closeSyncRow.
 */
export async function checkImageCacheHealth(
  supabase: SupabaseClient,
  accountId: string,
): Promise<void> {
  const { data } = await supabase
    .from('instagram_sync_log')
    .select('error_message')
    .eq('account_id', accountId)
    .in('mode', ['daily', 'manual'])
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(3)

  const rows = (data ?? []) as Array<{ error_message: string | null }>
  if (rows.length < 3) return

  const failing = rows.every((r) => {
    const match = / mediaFailed:(\d+)/.exec(r.error_message ?? '')
    return match !== null && Number(match[1]) > 0
  })
  if (!failing) return

  if (await claimAlert(supabase, `imgcache:${accountId}`, '23 hours')) {
    Sentry.captureMessage('instagram image cache persistently failing', 'warning')
  }
}
