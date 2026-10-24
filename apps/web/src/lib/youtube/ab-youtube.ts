import * as Sentry from '@sentry/nextjs'
import { YouTubeApiError, erroDaResposta, erroDeRede } from '@/lib/youtube/youtube-api-error'

export interface SetThumbnailResult {
  highUrl?: string
}

export async function setThumbnail(
  videoId: string,
  imageBuffer: Buffer,
  contentType: 'image/png' | 'image/jpeg',
  accessToken: string,
  f: typeof fetch = fetch,
): Promise<SetThumbnailResult> {
  const url = `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`
  let res: Response
  try {
    res = await f(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': contentType,
      },
      body: imageBuffer as BodyInit,
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    throw erroDeRede(e, 'thumbnails.set')
  }
  if (!res.ok) {
    const erro = await erroDaResposta(res, 'thumbnails.set')
    // Sem o corpo da resposta no Sentry: só status e reason.
    Sentry.captureException(erro, { extra: { videoId, status: erro.status, reason: erro.reason } })
    throw erro
  }
  const data = await res.json().catch(() => ({}))
  const highUrl: string | undefined = data?.items?.[0]?.high?.url ?? data?.items?.[0]?.default?.url
  return { highUrl }
}

export async function getCurrentThumbnailUrl(
  videoId: string,
  accessToken: string
): Promise<string | null> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.items?.[0]?.snippet?.thumbnails?.high?.url ?? null
}

export async function fetchVariantImageBuffer(
  blobUrl: string,
  f: typeof fetch = fetch,
): Promise<{ buffer: Buffer; contentType: 'image/png' | 'image/jpeg' }> {
  // Defense-in-depth: only allow known image hosts
  const allowed = [
    '.public.blob.vercel-storage.com',
    '.blob.vercel-storage.com',
    '.ytimg.com',
    '.ggpht.com',
    '.googleusercontent.com',
  ]
  try {
    const hostname = new URL(blobUrl).hostname
    if (!allowed.some(suffix => hostname.endsWith(suffix))) {
      throw new Error(`Blocked image fetch from untrusted host: ${hostname}`)
    }
  } catch (e) {
    if ((e as Error).message.startsWith('Blocked')) throw e
    throw new Error(`Invalid URL for image fetch: ${blobUrl}`)
  }

  let res: Response
  try {
    res = await f(blobUrl, { signal: AbortSignal.timeout(15_000) })
  } catch (e) {
    throw erroDeRede(e, 'blob')
  }
  if (!res.ok) throw new YouTubeApiError(res.status, `blob_${res.status}`, 'blob')
  const ct = res.headers.get('content-type') ?? 'image/png'
  const contentType = ct.includes('jpeg') ? ('image/jpeg' as const) : ('image/png' as const)
  let arrayBuffer: ArrayBuffer
  try {
    arrayBuffer = await res.arrayBuffer()
  } catch (e) {
    throw erroDeRede(e, 'blob')
  }
  return { buffer: Buffer.from(arrayBuffer), contentType }
}
