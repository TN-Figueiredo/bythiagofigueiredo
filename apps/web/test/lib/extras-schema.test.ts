import { describe, it, expect } from 'vitest'
import { ExtrasSchema, parseExtras } from '../../lib/campaigns/extras-schema'

describe('ExtrasSchema', () => {
  it('accepts youtube block', () => {
    const r = ExtrasSchema.safeParse([{ kind: 'youtube', videoId: 'abc123', title: 'T' }])
    expect(r.success).toBe(true)
  })

  it('accepts testimonial + whoAmI + whatsappCtas', () => {
    const r = ExtrasSchema.safeParse([
      { kind: 'testimonial', author: 'J', quote: 'Great' },
      { kind: 'whoAmI', headline: 'Me', bio_md: '...' },
      { kind: 'whatsappCtas', ctas: [{ kind: 'joinChannel', label: 'Join', url: 'https://wa.me/1' }] },
    ])
    expect(r.success).toBe(true)
  })

  it('rejects unknown kind', () => {
    const r = ExtrasSchema.safeParse([{ kind: 'bogus' }])
    expect(r.success).toBe(false)
  })

  it('parseExtras returns empty array on malformed', () => {
    expect(parseExtras('not-json')).toEqual([])
    expect(parseExtras({ garbage: true })).toEqual([])
  })

  it('parseExtras passes valid data through', () => {
    const ok = [{ kind: 'youtube', videoId: 'x', title: 't' }] as const
    expect(parseExtras(ok)).toEqual(ok)
  })
})
