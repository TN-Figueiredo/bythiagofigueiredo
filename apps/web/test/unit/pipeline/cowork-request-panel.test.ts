import { describe, it, expect } from 'vitest'

describe('citation tag parsing (usedCitations logic)', () => {
  function extractCitationIds(text: string, refs: Map<number, string>): number[] {
    const ids: number[] = []
    const re = /\[citacao (\d+)\]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const id = Number(m[1])
      if (refs.has(id) && !ids.includes(id)) ids.push(id)
    }
    return ids
  }

  it('extracts referenced citation IDs from text', () => {
    const refs = new Map([[1, 'text1'], [2, 'text2']])
    expect(extractCitationIds('[citacao 1] fix this', refs)).toEqual([1])
  })

  it('ignores IDs not present in references map', () => {
    const refs = new Map([[1, 'text1']])
    expect(extractCitationIds('[citacao 99] fix this', refs)).toEqual([])
  })

  it('deduplicates repeated citation IDs', () => {
    const refs = new Map([[1, 'text1']])
    expect(extractCitationIds('[citacao 1] here and [citacao 1] there', refs)).toEqual([1])
  })

  it('returns empty array when no citations present', () => {
    const refs = new Map([[1, 'text1']])
    expect(extractCitationIds('just plain text', refs)).toEqual([])
  })

  it('handles gaps in citation IDs', () => {
    const refs = new Map([[1, 'a'], [3, 'b'], [5, 'c']])
    expect(extractCitationIds('[citacao 3] and [citacao 5]', refs)).toEqual([3, 5])
  })

  it('preserves order of appearance', () => {
    const refs = new Map([[1, 'a'], [3, 'b'], [2, 'c']])
    expect(extractCitationIds('[citacao 3] then [citacao 1] then [citacao 2]', refs)).toEqual([3, 1, 2])
  })
})
