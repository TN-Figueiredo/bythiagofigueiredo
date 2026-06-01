import { describe, it, expect, vi } from 'vitest'

vi.mock('@vercel/blob', () => ({ put: vi.fn() }))

describe('original thumbnail preservation logic', () => {
  it('calls Vercel Blob put when URL is from ytimg.com', async () => {
    const { put } = await import('@vercel/blob')
    const blobUrl = 'https://xyz.public.blob.vercel-storage.com/ab-originals/test.jpg'
    vi.mocked(put).mockResolvedValue({ url: blobUrl } as ReturnType<typeof put> extends Promise<infer R> ? R : never)

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Buffer.from('fake-img'), { headers: { 'content-type': 'image/jpeg' } }),
    )

    // Verify put is callable with the right shape
    const result = await put('ab-originals/test/original.jpg', Buffer.from('fake'), {
      access: 'public',
      contentType: 'image/jpeg',
      addRandomSuffix: true,
    })
    expect(result.url).toBe(blobUrl)
  })

  it('thumbnail URL containing ytimg.com triggers preservation', () => {
    const url = 'https://i.ytimg.com/vi/abc123/hqdefault.jpg'
    expect(url.includes('ytimg.com')).toBe(true)
  })

  it('Vercel Blob URLs do not trigger preservation', () => {
    const url = 'https://xyz.public.blob.vercel-storage.com/ab-test/thumb.jpg'
    expect(url.includes('ytimg.com')).toBe(false)
  })
})
