import { describe, it, expect } from 'vitest'
import { slugifyPlaylist } from '@/lib/playlists/slug'

describe('resolveUniqueSlug collision logic', () => {
  it('slugifyPlaylist produces base slug', () => {
    expect(slugifyPlaylist('Getting Started with TypeScript')).toBe('getting-started-with-typescript')
  })

  it('slugifyPlaylist handles diacritics', () => {
    expect(slugifyPlaylist('Começando com TypeScript')).toBe('comecando-com-typescript')
  })

  it('slugifyPlaylist truncates at 80 chars', () => {
    const long = 'a'.repeat(100)
    expect(slugifyPlaylist(long).length).toBe(80)
  })

  it('suffix format is -2, -3, etc.', () => {
    const base = slugifyPlaylist('Test')
    expect(`${base}-2`).toBe('test-2')
    expect(`${base}-99`).toBe('test-99')
  })
})
