// @vitest-environment node
// apps/web/test/youtube/thumb-fingerprint.test.ts
import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { isNewThumb, hamming, dhashOf, probeThumb, DHASH_MAX_SAME } from '@/lib/youtube/thumb-fingerprint'

async function png(color: [number, number, number], stripe = false): Promise<Buffer> {
  const img = sharp({ create: { width: 64, height: 36, channels: 3, background: { r: color[0], g: color[1], b: color[2] } } })
  return stripe
    ? img.composite([{ input: { create: { width: 32, height: 36, channels: 3, background: { r: 255, g: 255, b: 255 } } }, left: 0, top: 0 }]).png().toBuffer()
    : img.png().toBuffer()
}

describe('thumb fingerprint', () => {
  it('hamming counts differing hex bits', () => {
    expect(hamming('0000000000000000', '0000000000000003')).toBe(2)
  })
  it('first observation is always a new version', () => {
    expect(isNewThumb(null, { etag: 'a', lastModified: null, dhash: 'ff', bytes: null, url: 'u' })).toBe(true)
  })
  it('ETag changed but perceptual hash equal → NOT a new version (CDN re-encode)', () => {
    expect(isNewThumb({ etag: 'a', dhash: '00ff00ff00ff00ff' }, { etag: 'b', lastModified: null, dhash: '00ff00ff00ff00ff', bytes: null, url: 'u' })).toBe(false)
  })
  it('ETag changed and image changed → new version', () => {
    expect(isNewThumb({ etag: 'a', dhash: '0000000000000000' }, { etag: 'b', lastModified: null, dhash: 'ffffffffffffffff', bytes: null, url: 'u' })).toBe(true)
  })
  it('ETag unchanged → no download needed and no new version', async () => {
    const f = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => new Response(null, { status: 200, headers: { etag: '"a"' } }))
    const p = await probeThumb('abc', { etag: '"a"', dhash: '00' }, f as unknown as typeof fetch)
    expect(f).toHaveBeenCalledTimes(1) // HEAD only
    expect(isNewThumb({ etag: '"a"', dhash: '00' }, p)).toBe(false)
  })
  it('dhash distinguishes different images and matches identical ones', async () => {
    const a = await dhashOf(await png([20, 20, 20], true)), b = await dhashOf(await png([20, 20, 20], true)), c = await dhashOf(await png([20, 20, 20]))
    expect(hamming(a, b)).toBe(0)
    expect(hamming(a, c)).toBeGreaterThan(DHASH_MAX_SAME)
  })
})
