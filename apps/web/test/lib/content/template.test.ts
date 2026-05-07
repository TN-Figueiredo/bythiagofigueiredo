import { describe, it, expect } from 'vitest'
import { t } from '../../../src/lib/content/template'

describe('t() template interpolation', () => {
  it('replaces {n} with number', () => {
    expect(t('{n}d ago', { n: 5 })).toBe('5d ago')
  })

  it('replaces multiple placeholders', () => {
    expect(t('{a} and {b}', { a: 1, b: 2 })).toBe('1 and 2')
  })

  it('leaves unknown placeholders as key name', () => {
    expect(t('{n}d {x}', { n: 3 })).toBe('3d x')
  })

  it('handles string with no placeholders', () => {
    expect(t('hello world', { n: 1 })).toBe('hello world')
  })

  it('handles empty string', () => {
    expect(t('', { n: 1 })).toBe('')
  })
})
