import { describe, it, expect } from 'vitest'
import { generateSlug } from '../../src/app/cms/(authed)/blog/_shared/slug-field'

describe('generateSlug', () => {
  it('converts title to kebab-case', () => {
    expect(generateSlug('Inglês II — Phrasal Verbs')).toBe('ingles-ii-phrasal-verbs')
  })

  it('strips diacritics', () => {
    expect(generateSlug('Colofão do café')).toBe('colofao-do-cafe')
  })

  it('trims to 80 chars', () => {
    const long = 'a'.repeat(100)
    expect(generateSlug(long).length).toBeLessThanOrEqual(80)
  })

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('')
  })

  it('removes leading/trailing hyphens', () => {
    expect(generateSlug('—hello world—')).toBe('hello-world')
  })
})
