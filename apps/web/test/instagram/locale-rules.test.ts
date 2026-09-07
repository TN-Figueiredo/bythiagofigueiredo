// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { allowedLocales } from '@/lib/instagram/locale-rules'

describe('allowedLocales', () => {
  it('offers every locale when nothing is taken', () => {
    expect(allowedLocales([])).toEqual(['all', 'pt', 'en'])
  })

  it('drops "all" once pt or en exists', () => {
    expect(allowedLocales(['pt'])).toEqual(['en'])
    expect(allowedLocales(['en'])).toEqual(['pt'])
  })

  it('offers nothing else once "all" exists', () => {
    expect(allowedLocales(['all'])).toEqual([])
  })

  it('always keeps the row own locale selectable', () => {
    expect(allowedLocales(['pt', 'en'], 'pt')).toEqual(['pt'])
    expect(allowedLocales(['all', 'pt'], 'pt')).toEqual(['pt'])
    expect(allowedLocales(['pt'], 'pt')).toEqual(['all', 'pt', 'en'])
  })
})
