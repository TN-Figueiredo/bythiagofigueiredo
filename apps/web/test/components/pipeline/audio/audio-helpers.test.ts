import { describe, it, expect } from 'vitest'
import { energyColor, formatDuration, categoryConfig, similarityScore, ENERGY_COLORS } from
  '@/app/cms/(authed)/pipeline/audio/_helpers/audio-helpers'

describe('energyColor', () => {
  it('returns green for level 1', () => {
    expect(energyColor(1)).toBe('#22c55e')
  })
  it('returns green for level 2', () => {
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
  it('returns dim gray for null', () => {
    expect(energyColor(null)).toBe('#5a6b7f')
  })
  it('returns dim gray for undefined', () => {
    expect(energyColor(undefined)).toBe('#5a6b7f')
  })
})

describe('formatDuration', () => {
  it('formats seconds to m:ss', () => {
    expect(formatDuration(65)).toBe('1:05')
  })
  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00')
  })
  it('handles large values', () => {
    expect(formatDuration(3661)).toBe('61:01')
  })
  it('returns dash for null', () => {
    expect(formatDuration(null)).toBe('—')
  })
  it('returns dash for undefined', () => {
    expect(formatDuration(undefined)).toBe('—')
  })
})

describe('categoryConfig', () => {
  it('returns config for cinematic', () => {
    const cfg = categoryConfig('cinematic')
    expect(cfg.badgeBg).toBe('rgba(99,102,241,0.12)')
    expect(cfg.badgeColor).toBe('#818cf8')
    expect(cfg.hoverAccent).toBe('#7c3aed')
  })
  it('is case-insensitive', () => {
    const cfg = categoryConfig('AMBIENT')
    expect(cfg.badgeColor).toBe('#38bdf8')
  })
  it('returns fallback for unknown category', () => {
    const cfg = categoryConfig('unknown-thing')
    expect(cfg.badgeBg).toBe('rgba(107,114,128,0.12)')
  })
  it('returns fallback for null', () => {
    const cfg = categoryConfig(null)
    expect(cfg.badgeColor).toBe('#9ca3af')
  })
})

describe('similarityScore', () => {
  it('returns 0 for completely different assets', () => {
    const a = { category: 'cinematic', tags: ['epic'], bpm: 120, energy: 5, music_key: 'D' }
    const b = { category: 'ambient', tags: ['calm'], bpm: 60, energy: 1, music_key: 'A' }
    expect(similarityScore(a, b)).toBe(0)
  })
  it('scores 30 for same category', () => {
    const a = { category: 'cinematic' }
    const b = { category: 'cinematic' }
    expect(similarityScore(a, b)).toBe(30)
  })
  it('scores shared tags at 5 each, max 30', () => {
    const a = { tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }
    const b = { tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }
    expect(similarityScore(a, b)).toBe(30) // capped
  })
  it('scores BPM within 10', () => {
    const a = { bpm: 120 }
    const b = { bpm: 125 }
    expect(similarityScore(a, b)).toBe(15)
  })
  it('caps at 100', () => {
    const a = { category: 'cinematic', tags: ['a','b','c','d','e','f','g'], bpm: 120, energy: 4, music_key: 'D', instruments: ['piano','strings','drums','brass','synth'], mood: ['epic','dramatic','powerful','tense'] }
    const b = { ...a }
    expect(similarityScore(a, b)).toBeLessThanOrEqual(100)
  })
})
