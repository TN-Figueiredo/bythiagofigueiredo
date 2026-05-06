import { describe, it, expect } from 'vitest'
import { composeQr } from './composer.js'

describe('composeQr', () => {
  it('produces SVG with correct canvas dimensions (square)', async () => {
    const result = await composeQr({ url: 'https://example.com' })
    expect(result.width).toBe(512)
    expect(result.height).toBe(512)
    expect(result.svg).toContain('width="512"')
    expect(result.svg).toContain('height="512"')
  })

  it('produces landscape canvas', async () => {
    const result = await composeQr({ url: 'https://example.com', aspectRatio: 'landscape' })
    expect(result.width).toBe(640)
    expect(result.height).toBe(480)
  })

  it('produces story canvas', async () => {
    const result = await composeQr({ url: 'https://example.com', aspectRatio: 'story' })
    expect(result.width).toBe(450)
    expect(result.height).toBe(800)
  })

  it('centers QR in the canvas', async () => {
    const result = await composeQr({ url: 'https://example.com', aspectRatio: 'landscape' })
    // Canvas 640x480, padding 32 → qrSize=416, qrX=(640-416)/2=112, qrY=(480-416)/2=32
    expect(result.svg).toContain('translate(112, 32)')
    expect(result.qrSize).toBe(416)
  })

  it('includes background rect', async () => {
    const result = await composeQr({
      url: 'https://example.com',
      backgroundColor: '#f0f0f0',
    })
    expect(result.svg).toContain('fill="#f0f0f0"')
  })

  it('includes logo element when logoBase64 provided', async () => {
    const result = await composeQr({
      url: 'https://example.com',
      logoBase64: 'data:image/png;base64,abc',
      logoSize: 0.25,
    })
    expect(result.svg).toContain('<image')
    expect(result.svg).toContain('data:image/png;base64,abc')
  })

  it('does not include logo element when not provided', async () => {
    const result = await composeQr({ url: 'https://example.com' })
    expect(result.svg).not.toContain('<image')
  })

  it('contains valid SVG structure', async () => {
    const result = await composeQr({ url: 'https://example.com' })
    expect(result.svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(result.svg).toMatch(/<svg[^>]*>[\s\S]*<\/svg>/)
  })
})
