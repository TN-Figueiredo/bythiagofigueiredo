import { describe, it, expect } from 'vitest'
import { slugifyPlaylist } from '@/lib/playlists/slug'

describe('slugifyPlaylist', () => {
  it('converts spaces to hyphens and lowercases', () => {
    expect(slugifyPlaylist('React Fundamentals')).toBe('react-fundamentals')
  })

  it('strips diacritics', () => {
    expect(slugifyPlaylist('Séries de Programação')).toBe('series-de-programacao')
  })

  it('removes special characters', () => {
    expect(slugifyPlaylist('C++ & Rust: A Comparison!')).toBe('c-rust-a-comparison')
  })

  it('collapses multiple hyphens', () => {
    expect(slugifyPlaylist('a---b')).toBe('a-b')
  })

  it('trims leading/trailing hyphens', () => {
    expect(slugifyPlaylist('--hello--')).toBe('hello')
  })

  it('truncates to 80 chars', () => {
    const long = 'a'.repeat(100)
    expect(slugifyPlaylist(long).length).toBeLessThanOrEqual(80)
  })
})
