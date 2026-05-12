import { describe, it, expect } from 'vitest'
import { getSpacingClass, SPACING_VALUES } from '@/lib/cms/spacing'

describe('getSpacingClass', () => {
  it('returns sm for paragraph → paragraph', () => {
    expect(getSpacingClass('paragraph', 'paragraph')).toBe('sp-sm')
  })

  it('returns xl for paragraph → heading', () => {
    expect(getSpacingClass('paragraph', 'heading')).toBe('sp-xl')
  })

  it('returns md for paragraph → codeBlock', () => {
    expect(getSpacingClass('paragraph', 'codeBlock')).toBe('sp-md')
  })

  it('returns lg for callout → callout', () => {
    expect(getSpacingClass('callout', 'callout')).toBe('sp-lg')
  })

  it('returns lg for any → divider', () => {
    expect(getSpacingClass('paragraph', 'horizontalRule')).toBe('sp-lg')
  })

  it('returns lg for divider → any', () => {
    expect(getSpacingClass('horizontalRule', 'paragraph')).toBe('sp-lg')
  })

  it('falls back to sm for unknown pairs', () => {
    expect(getSpacingClass('unknownA', 'unknownB')).toBe('sp-sm')
  })

  it('returns empty string for the first block (no previous)', () => {
    expect(getSpacingClass(null, 'paragraph')).toBe('')
  })
})

describe('SPACING_VALUES', () => {
  it('has 5 levels', () => {
    expect(Object.keys(SPACING_VALUES)).toEqual(['xs', 'sm', 'md', 'lg', 'xl'])
  })

  it('values are em units', () => {
    expect(SPACING_VALUES.xs).toBe('0.6em')
    expect(SPACING_VALUES.xl).toBe('3.0em')
  })
})
