import { describe, it, expect } from 'vitest'
import { PosBriefSchema, ABDraftSchema } from '@/lib/pipeline/video-schemas'

const validDraft = {
  firstOnAir: 'A' as const,
  variants: [
    { id: 'A' as const, role: 'challenger' as const, title: 'Ângulo A', brief: 'thumb A' },
    { id: 'B' as const, role: 'challenger' as const, title: 'Ângulo B', brief: 'thumb B' },
    { id: 'C' as const, role: 'challenger' as const, title: 'Ângulo C', brief: 'thumb C' },
    { id: 'D' as const, role: 'challenger' as const, title: 'Ângulo D', brief: 'thumb D' },
  ],
}

describe('ABDraftSchema', () => {
  it('accepts 4 fresh challengers at debut (no incumbent)', () => {
    const r = ABDraftSchema.safeParse(validDraft)
    expect(r.success).toBe(true)
  })
  it('defaults role to "challenger" when omitted', () => {
    const d = { ...validDraft, variants: validDraft.variants.map(({ role: _role, ...rest }) => rest) }
    const r = ABDraftSchema.safeParse(d)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.variants.every(v => v.role === 'challenger')).toBe(true)
  })
  it('accepts at most one winner (after the test resolves)', () => {
    const d = { ...validDraft, variants: validDraft.variants.map((v, i) => i === 0 ? { ...v, role: 'winner' as const } : v) }
    expect(ABDraftSchema.safeParse(d).success).toBe(true)
  })
  it('rejects two winners', () => {
    const d = { ...validDraft, variants: validDraft.variants.map((v, i) => i < 2 ? { ...v, role: 'winner' as const } : v) }
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
