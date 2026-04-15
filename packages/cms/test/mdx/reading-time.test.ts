import { describe, it, expect } from 'vitest'
import { calculateReadingTime } from '../../src/mdx/reading-time'

describe('calculateReadingTime', () => {
  it('returns 1 for empty/short source', () => {
    expect(calculateReadingTime('')).toBe(1)
    expect(calculateReadingTime('hello world')).toBe(1)
  })

  it('returns minutes as ceil(words / 200)', () => {
    const source = Array.from({ length: 400 }, () => 'word').join(' ')
    expect(calculateReadingTime(source)).toBe(2)
  })

  it('strips MDX component syntax from word count', () => {
    const source = '<Callout type="tip">hi there</Callout>'
    expect(calculateReadingTime(source)).toBe(1)
  })
})
