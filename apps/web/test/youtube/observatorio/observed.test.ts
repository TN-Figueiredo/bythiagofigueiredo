// @vitest-environment node
// apps/web/test/youtube/observatorio/observed.test.ts
import { describe, it, expect } from 'vitest'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { isObserved } from '@/lib/youtube/observatorio/observed'

describe('fixar vídeo: regra', () => {
  it('RULES.pinLimit é 10 (R118), lido da constante sem sobrescrever', () => {
    expect(RULES.pinLimit).toBe(10)
  })
  it('observado = acompanhado ou fixado; pinned ausente é "não fixado"', () => {
    expect(isObserved({ tracked: true })).toBe(true)
    expect(isObserved({ tracked: true, pinned: false })).toBe(true)
    expect(isObserved({ tracked: false, pinned: true })).toBe(true)
    expect(isObserved({ tracked: false, pinned: false })).toBe(false)
    expect(isObserved({ tracked: false })).toBe(false)
  })
})
