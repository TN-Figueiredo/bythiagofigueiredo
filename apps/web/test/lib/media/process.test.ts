import { describe, it, expect, vi } from 'vitest'
import { processImage, type ProcessResult } from '../../../lib/media/process'

vi.mock('../../../lib/media/sanitize-svg', () => ({
  sanitizeSvg: vi.fn((input: string) => input.replace(/<script[^>]*>.*?<\/script>/gi, '')),
}))

describe('processImage', () => {
  it('processes JPEG: strips EXIF and returns dimensions', async () => {
    const sharp = (await import('sharp')).default
    const jpegBuf = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .withMetadata({
        exif: {
          IFD0: { ImageDescription: 'test-exif-data' },
        },
      })
      .jpeg()
      .toBuffer()

    const result = await processImage(jpegBuf, 'image/jpeg')

    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    expect(result.mimeType).toBe('image/jpeg')
    expect(result.buffer).toBeInstanceOf(Buffer)
    expect(result.buffer.length).toBeGreaterThan(0)

    const meta = await sharp(result.buffer).metadata()
    expect(meta.exif).toBeUndefined()
  })

  it('processes PNG: returns dimensions', async () => {
    const sharp = (await import('sharp')).default
    const pngBuf = await sharp({
      create: { width: 50, height: 30, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer()

    const result = await processImage(pngBuf, 'image/png')

    expect(result.width).toBe(50)
    expect(result.height).toBe(30)
    expect(result.mimeType).toBe('image/png')
  })

  it('processes WebP: returns dimensions', async () => {
    const sharp = (await import('sharp')).default
    const webpBuf = await sharp({
      create: { width: 100, height: 80, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .webp()
      .toBuffer()

    const result = await processImage(webpBuf, 'image/webp')

    expect(result.width).toBe(100)
    expect(result.height).toBe(80)
    expect(result.mimeType).toBe('image/webp')
  })

  it('passes GIF through unchanged but extracts dimensions', async () => {
    const sharp = (await import('sharp')).default
    const gifBuf = await sharp({
      create: { width: 20, height: 15, channels: 4, background: { r: 255, g: 255, b: 0, alpha: 1 } },
    })
      .gif()
      .toBuffer()

    const result = await processImage(gifBuf, 'image/gif')

    expect(result.width).toBe(20)
    expect(result.height).toBe(15)
    expect(result.mimeType).toBe('image/gif')
    expect(result.buffer.length).toBeGreaterThan(0)
  })

  it('processes SVG: sanitizes and returns null dimensions', async () => {
    const svgBuf = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/><script>alert(1)</script></svg>',
    )

    const result = await processImage(svgBuf, 'image/svg+xml')

    expect(result.width).toBeNull()
    expect(result.height).toBeNull()
    expect(result.mimeType).toBe('image/svg+xml')
    const output = result.buffer.toString('utf-8')
    expect(output).not.toContain('<script')
  })
})
