import { describe, it, expect } from 'vitest'
import { normalizeLang } from '@/lib/playlists/queries'

describe('normalizeLang', () => {
  it('normalizes pt-BR to pt-br', () => {
    expect(normalizeLang('pt-BR')).toBe('pt-br')
  })

  it('normalizes pt to pt-br', () => {
    expect(normalizeLang('pt')).toBe('pt-br')
  })

  it('normalizes en-US to en', () => {
    expect(normalizeLang('en-US')).toBe('en')
  })

  it('normalizes EN to en', () => {
    expect(normalizeLang('EN')).toBe('en')
  })

  it('returns null for null input', () => {
    expect(normalizeLang(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(normalizeLang(undefined)).toBeNull()
  })

  it('returns null for unknown locale', () => {
    expect(normalizeLang('fr')).toBeNull()
  })
})
