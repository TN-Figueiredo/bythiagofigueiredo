import { describe, it, expect } from 'vitest'
import { generateQrSvg } from './generator.js'

describe('generateQrSvg', () => {
  it('generates SVG string containing svg markup', async () => {
    const result = await generateQrSvg({ url: 'https://example.com' })
    expect(result.svg).toContain('<svg')
    expect(result.svg).toContain('</svg>')
  })

  it('returns the requested size', async () => {
    const result = await generateQrSvg({ url: 'https://example.com', size: 256 })
    expect(result.size).toBe(256)
  })

  it('throws on empty URL', async () => {
    await expect(generateQrSvg({ url: '' })).rejects.toThrow(/empty/i)
  })

  it('produces different SVGs for different URLs', async () => {
    const a = await generateQrSvg({ url: 'https://example.com/a' })
    const b = await generateQrSvg({ url: 'https://example.com/b' })
    expect(a.svg).not.toBe(b.svg)
  })

  it('accepts custom colors', async () => {
    const result = await generateQrSvg({
      url: 'https://example.com',
      darkColor: '#ff0000',
      lightColor: '#00ff00',
    })
    expect(result.svg).toContain('#ff0000')
  })

  it('accepts error correction levels', async () => {
    const resultL = await generateQrSvg({ url: 'https://example.com', errorCorrection: 'L' })
    const resultH = await generateQrSvg({ url: 'https://example.com', errorCorrection: 'H' })
    // Higher error correction produces more modules
    expect(resultL.svg).not.toBe(resultH.svg)
  })
})
