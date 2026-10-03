// apps/web/src/lib/youtube/thumb-fingerprint.ts
import sharp from 'sharp'
import { put } from '@vercel/blob'

// Spike S1 (docs/superpowers/plans/2026-10-02-observatorio-spikes.md): 0 false flips in 13 min
// with DHASH_MAX_SAME = 6; the smallest real rotation distance observed was 10. Still provisional
// until the T+24h re-probe.
const VARIANT = 'hqdefault'
export const DHASH_MAX_SAME = 6

export interface ThumbProbe { etag: string | null; lastModified: string | null; dhash: string | null; bytes: Buffer | null; url: string }
export interface ThumbPrev { etag: string | null; dhash: string | null }

export function thumbUrl(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(youtubeId)}/${VARIANT}.jpg`
}

export function hamming(a: string, b: string): number {
  const len = Math.max(a.length, b.length)
  const pa = a.padStart(len, '0'), pb = b.padStart(len, '0')
  let n = 0
  for (let i = 0; i < len; i++) {
    let x = parseInt(pa[i]!, 16) ^ parseInt(pb[i]!, 16)
    while (x) { n += x & 1; x >>= 1 }
  }
  return n
}

export async function dhashOf(bytes: Buffer): Promise<string> {
  const px = await sharp(bytes).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer()
  let bits = ''
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += px[y * 9 + x]! > px[y * 9 + x + 1]! ? '1' : '0'
  let hex = ''
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16)
  return hex
}

const stripQuotes = (v: string) => v.replace(/^W\//, '').replace(/^"|"$/g, '')

/** ETag "0" (48% of competitor videos, spike S1) carries no information → treated as no ETag. */
function usableEtag(raw: string | null): string | null {
  if (raw === null) return null
  return stripQuotes(raw) === '0' ? null : raw
}

/**
 * Spike S1: i.ytimg.com sends no Last-Modified, but a numeric ETag matched the upload instant
 * (epoch seconds) of an A/B rotation within 3 s. PROVISIONAL until the T+24h re-probe.
 * Falls back to the Last-Modified header, else null.
 */
function uploadInstant(etag: string | null, header: string | null): string | null {
  if (etag !== null) {
    const v = stripQuotes(etag)
    if (/^\d{9,11}$/.test(v) && Number(v) > 0) return new Date(Number(v) * 1000).toUTCString()
  }
  return header
}

/** HEAD first; downloads the image only when the ETag moved (or there is no previous one). */
export async function probeThumb(youtubeId: string, prev: ThumbPrev | null, f: typeof fetch = fetch): Promise<ThumbProbe> {
  const url = thumbUrl(youtubeId)
  const head = await f(url, { method: 'HEAD', signal: AbortSignal.timeout(10_000) })
  const etag = usableEtag(head.headers.get('etag'))
  const lastModified = uploadInstant(etag, head.headers.get('last-modified'))
  if (!head.ok) return { etag: null, lastModified: null, dhash: null, bytes: null, url }
  if (prev && etag !== null && etag === usableEtag(prev.etag)) return { etag, lastModified, dhash: prev.dhash, bytes: null, url }
  const get = await f(url, { signal: AbortSignal.timeout(15_000) })
  if (!get.ok) return { etag, lastModified, dhash: null, bytes: null, url }
  const bytes = Buffer.from(await get.arrayBuffer())
  return { etag, lastModified, dhash: await dhashOf(bytes), bytes, url }
}

/** A new version needs the image to look different, not just a new ETag (spec §7 risk). */
export function isNewThumb(prev: ThumbPrev | null, probe: ThumbProbe): boolean {
  if (!prev) return probe.etag !== null || probe.dhash !== null
  const pe = usableEtag(probe.etag)
  if (pe !== null && pe === usableEtag(prev.etag)) return false
  if (!probe.dhash || !prev.dhash) return false // cannot confirm → never invent a change
  return hamming(prev.dhash, probe.dhash) > DHASH_MAX_SAME
}

export async function archiveThumb(videoUuid: string, probe: ThumbProbe): Promise<string | null> {
  if (!probe.bytes || !probe.dhash) return null
  const blob = await put(`observatorio/thumbs/${videoUuid}/${probe.dhash}.jpg`, probe.bytes, {
    access: 'public', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true,
  })
  return blob.url
}
