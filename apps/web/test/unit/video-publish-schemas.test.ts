import { describe, it, expect } from 'vitest'
import { PosBriefSchema, ABDraftSchema } from '@/lib/pipeline/video-schemas'

const validDraft = {
  leader: 'A' as const,
  variants: [
    { id: 'A' as const, tag: 'original', title: 'Original', brief: 'thumb A' },
    { id: 'B' as const, title: 'Chall B', brief: 'thumb B' },
    { id: 'C' as const, title: 'Chall C', brief: 'thumb C' },
    { id: 'D' as const, title: 'Chall D', brief: 'thumb D' },
  ],
}

describe('ABDraftSchema', () => {
  it('accepts exactly 4 variants with exactly one original tag', () => {
    const r = ABDraftSchema.safeParse(validDraft)
    expect(r.success).toBe(true)
  })
  it('rejects zero original tags', () => {
    const d = { ...validDraft, variants: validDraft.variants.map(v => ({ ...v, tag: undefined })) }
    expect(ABDraftSchema.safeParse(d).success).toBe(false)
  })
  it('rejects two original tags', () => {
    const d = { ...validDraft, variants: validDraft.variants.map((v, i) => i < 2 ? { ...v, tag: 'original' } : v) }
    expect(ABDraftSchema.safeParse(d).success).toBe(false)
  })
  it('rejects fewer than 4 variants', () => {
    const d = { ...validDraft, variants: validDraft.variants.slice(0, 3) }
    expect(ABDraftSchema.safeParse(d).success).toBe(false)
  })
})

describe('PosBriefSchema', () => {
  it('accepts a minimal brief discriminated by kind', () => {
    const r = PosBriefSchema.safeParse({ kind: 'brief', ctas: {} })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.style).toEqual([])
      expect(r.data.ctas.rows).toEqual([])
    }
  })
  it('rejects unknown kind / extra keys', () => {
    expect(PosBriefSchema.safeParse({ kind: 'timeline', ctas: {} }).success).toBe(false)
    expect(PosBriefSchema.safeParse({ kind: 'brief', ctas: {}, bogus: 1 }).success).toBe(false)
  })
})
