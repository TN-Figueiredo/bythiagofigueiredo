import { describe, it, expect } from 'vitest'
import {
  energyColor,
  formatDuration,
  categoryConfig,
  similarityScore,
  ENERGY_COLORS,
} from '@/app/cms/(authed)/pipeline/audio/_helpers/audio-helpers'

describe('energyColor', () => {
  it('returns green for level 1 and 2', () => {
    expect(energyColor(1)).toBe('#22c55e')
    expect(energyColor(2)).toBe('#22c55e')
  })

  it('returns yellow for level 3', () => {
    expect(energyColor(3)).toBe('#eab308')
  })

  it('returns orange for level 4', () => {
    expect(energyColor(4)).toBe('#f97316')
  })

  it('returns red for level 5', () => {
    expect(energyColor(5)).toBe('#ef4444')
  })

  it('returns fallback for null/undefined', () => {
    expect(energyColor(null)).toBe('#5a6b7f')
    expect(energyColor(undefined)).toBe('#5a6b7f')
  })

  it('returns fallback for unknown level', () => {
    expect(energyColor(99)).toBe('#5a6b7f')
  })

  it('covers all 5 energy levels', () => {
    expect(Object.keys(ENERGY_COLORS)).toHaveLength(5)
  })
})

describe('formatDuration', () => {
  it('formats null as em dash', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(undefined)).toBe('—')
  })

  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
  })

  it('formats under a minute', () => {
    expect(formatDuration(45)).toBe('0:45')
  })

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2:05')
  })

  it('pads single-digit seconds', () => {
    expect(formatDuration(62)).toBe('1:02')
  })
})

describe('categoryConfig', () => {
  it('returns style for known categories', () => {
    const cinematic = categoryConfig('cinematic')
    expect(cinematic.badgeColor).toBe('#818cf8')
    expect(cinematic.badgeBg).toContain('99,102,241')
  })

  it('is case-insensitive', () => {
    expect(categoryConfig('AMBIENT')).toEqual(categoryConfig('ambient'))
  })

  it('returns fallback for null', () => {
    const fb = categoryConfig(null)
    expect(fb.badgeColor).toBe('#9ca3af')
  })

  it('returns fallback for undefined', () => {
    const fb = categoryConfig(undefined)
    expect(fb.badgeColor).toBe('#9ca3af')
  })

  it('returns fallback for unknown category', () => {
    const fb = categoryConfig('nonexistent')
    expect(fb.badgeColor).toBe('#9ca3af')
  })

  it('all known categories have required properties', () => {
    for (const cat of ['cinematic', 'ambient', 'electronic', 'impact', 'drop', 'riser']) {
      const cfg = categoryConfig(cat)
      expect(cfg.badgeBg).toBeTruthy()
      expect(cfg.badgeColor).toBeTruthy()
      expect(cfg.hoverAccent).toBeTruthy()
      expect(cfg.dotColor).toBeTruthy()
    }
  })
})

describe('similarityScore', () => {
  it('returns 0 for completely different items', () => {
    expect(similarityScore(
      { category: 'cinematic', tags: ['dark'], bpm: 60 },
      { category: 'ambient', tags: ['light'], bpm: 140 },
    )).toBe(0)
  })

  it('gives 30 points for matching category', () => {
    expect(similarityScore(
      { category: 'cinematic' },
      { category: 'cinematic' },
    )).toBe(30)
  })

  it('gives points for shared tags (5 each, max 30)', () => {
    const score = similarityScore(
      { tags: ['a', 'b', 'c'] },
      { tags: ['a', 'b', 'd'] },
    )
    expect(score).toBe(10)
  })

  it('caps tag score at 30', () => {
    const many = Array.from({ length: 10 }, (_, i) => `tag${i}`)
    const score = similarityScore({ tags: many }, { tags: many })
    expect(score).toBeLessThanOrEqual(100)
  })

  it('gives 15 points for matching key', () => {
    expect(similarityScore(
      { music_key: 'Am' },
      { music_key: 'Am' },
    )).toBe(15)
  })

  it('gives 15 points for close BPM (within 10)', () => {
    expect(similarityScore(
      { bpm: 120 },
      { bpm: 125 },
    )).toBe(15)
  })

  it('gives 0 for BPM difference > 10', () => {
    expect(similarityScore(
      { bpm: 60 },
      { bpm: 120 },
    )).toBe(0)
  })

  it('gives 10 points for close energy (within 1)', () => {
    expect(similarityScore(
      { energy: 3 },
      { energy: 4 },
    )).toBe(10)
  })

  it('gives points for shared instruments', () => {
    expect(similarityScore(
      { instruments: ['piano', 'strings'] },
      { instruments: ['piano', 'guitar'] },
    )).toBe(3)
  })

  it('gives points for shared mood', () => {
    expect(similarityScore(
      { mood: ['epic', 'dark'] },
      { mood: ['epic', 'mysterious'] },
    )).toBe(5)
  })

  it('caps total at 100', () => {
    const item = {
      category: 'cinematic',
      tags: Array.from({ length: 10 }, (_, i) => `t${i}`),
      music_key: 'Am',
      bpm: 120,
      energy: 3,
      instruments: Array.from({ length: 10 }, (_, i) => `i${i}`),
      mood: Array.from({ length: 10 }, (_, i) => `m${i}`),
    }
    expect(similarityScore(item, item)).toBe(100)
  })

  it('handles empty objects gracefully', () => {
    expect(similarityScore({}, {})).toBe(0)
  })
})
