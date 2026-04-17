import { describe, it, expect } from 'vitest'
import { SeoExtrasSchema } from '@/lib/seo/jsonld/extras-schema'

describe('SeoExtrasSchema', () => {
  it('accepts valid FAQ', () => {
    const r = SeoExtrasSchema.safeParse({
      faq: [{ q: 'Q1', a: 'A1' }, { q: 'Q2', a: 'A2' }],
    })
    expect(r.success).toBe(true)
  })

  it('rejects empty FAQ array', () => {
    const r = SeoExtrasSchema.safeParse({ faq: [] })
    expect(r.success).toBe(false)
  })

  it('rejects HowTo with single step', () => {
    const r = SeoExtrasSchema.safeParse({
      howTo: { name: 'Test', steps: [{ name: 'only one', text: 'x' }] },
    })
    expect(r.success).toBe(false)
  })

  it('validates VideoObject ISO duration', () => {
    const ok = SeoExtrasSchema.safeParse({
      video: {
        name: 'Demo', description: 'desc', thumbnailUrl: 'https://x.com/t.jpg',
        uploadDate: '2026-04-15', duration: 'PT5M',
      },
    })
    expect(ok.success).toBe(true)
    const bad = SeoExtrasSchema.safeParse({
      video: { name: 'Demo', description: 'd', thumbnailUrl: 'https://x.com/t.jpg', uploadDate: '2026-04-15', duration: 'five minutes' },
    })
    expect(bad.success).toBe(false)
  })

  it('requires og_image_url to be https', () => {
    const bad = SeoExtrasSchema.safeParse({ og_image_url: 'http://x.com/i.png' })
    expect(bad.success).toBe(false)
    const ok = SeoExtrasSchema.safeParse({ og_image_url: 'https://x.com/i.png' })
    expect(ok.success).toBe(true)
  })

  it('rejects unknown top-level keys (strict)', () => {
    const r = SeoExtrasSchema.safeParse({ extra: 'value' })
    expect(r.success).toBe(false)
  })
})
