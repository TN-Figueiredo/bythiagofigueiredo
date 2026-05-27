import { describe, it, expect } from 'vitest'
import {
  getFormatColor,
  getPlaylistColor,
  FORMAT_COLORS,
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
    expect(color.accent).toBe('var(--gem-accent)')
  })
})

describe('getPlaylistColor', () => {
  it('returns deterministic color from palette for any playlist id', () => {
    const color = getPlaylistColor('unknown')
    expect(color.accent).toBeTruthy()
    const color2 = getPlaylistColor('unknown')
    expect(color2.accent).toBe(color.accent)
  })

  it('returns different colors for different playlist ids', () => {
    const ids = ['playlist-a', 'playlist-b', 'playlist-c', 'playlist-d']
    const colors = ids.map(id => getPlaylistColor(id).accent)
    expect(new Set(colors).size).toBeGreaterThan(1)
  })
})

describe('FORMAT_COLORS', () => {
  it('has 5 format entries', () => {
    expect(Object.keys(FORMAT_COLORS)).toHaveLength(5)
  })

  it('each entry has valid CSS color values', () => {
    for (const color of Object.values(FORMAT_COLORS)) {
      expect(color.accent).toBeTruthy()
      expect(color.bg).toMatch(/^rgba\(/)
      expect(color.text).toBeTruthy()
      expect(color.border).toMatch(/^rgba\(/)
    }
  })

  it('campaign has distinct color from video', () => {
    expect(FORMAT_COLORS['campaign']!.accent).not.toBe(FORMAT_COLORS['video']!.accent)
  })
})
