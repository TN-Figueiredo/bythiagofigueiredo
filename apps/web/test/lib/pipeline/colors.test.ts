import { describe, it, expect } from 'vitest'
import {
  getFormatColor,
  getPlaylistColor,
  FORMAT_COLORS,
  PLAYLIST_COLORS,
} from '@/lib/pipeline/colors'

describe('getFormatColor', () => {
  it('returns color for known formats', () => {
    for (const fmt of ['video', 'blog_post', 'newsletter', 'course', 'campaign']) {
      const color = getFormatColor(fmt)
      expect(color.accent).toBeTruthy()
      expect(color.bg).toBeTruthy()
      expect(color.text).toBeTruthy()
      expect(color.border).toBeTruthy()
    }
  })

  it('returns default for unknown format', () => {
    const color = getFormatColor('unknown')
    expect(color.accent).toBe('#6366f1')
  })
})

describe('getPlaylistColor', () => {
  it('returns color for known playlist codes', () => {
    for (const code of Object.keys(PLAYLIST_COLORS)) {
      const color = getPlaylistColor(code)
      expect(color.accent).toBeTruthy()
    }
  })

  it('returns default for unknown playlist code', () => {
    const color = getPlaylistColor('unknown')
    expect(color.accent).toBe('#6366f1')
  })
})

describe('FORMAT_COLORS', () => {
  it('has 5 format entries', () => {
    expect(Object.keys(FORMAT_COLORS)).toHaveLength(5)
  })

  it('each entry has valid hex colors', () => {
    for (const color of Object.values(FORMAT_COLORS)) {
      expect(color.accent).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(color.bg).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(color.text).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(color.border).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('PLAYLIST_COLORS', () => {
  it('has entries with valid hex colors', () => {
    for (const color of Object.values(PLAYLIST_COLORS)) {
      expect(color.accent).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})
