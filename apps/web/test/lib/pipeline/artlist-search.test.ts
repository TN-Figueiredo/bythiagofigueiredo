import { describe, it, expect } from 'vitest'
import {
  parseArtlistSearch,
  parseArtlistSfxRef,
} from '@/lib/pipeline/artlist-search'

describe('parseArtlistSearch', () => {
  it('parses standard input with mood, genre, BPM, and duration', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Mood: Mysterious, Dark | Genre: Ambient, Electronic | BPM: 60-80 | Duration: 2+ min'
    )
    expect(result).not.toBeNull()
    expect(result!.ids).toEqual([57, 64, 320, 92])
    expect(result!.url).toContain('includedIds=57,64&')
    expect(result!.url).toContain('&includedIds=320&includedIds=92')
    expect(result!.url).toContain('bpmMin=60')
    expect(result!.url).toContain('bpmMax=80')
    expect(result!.url).toContain('durationMin=120')
    expect(result!.fallbackUrl).toContain('includedIds=57,64&')
    expect(result!.fallbackUrl).toContain('&includedIds=320')
    expect(result!.fallbackUrl).not.toContain('includedIds=92')
    expect(result!.fallbackUrl).toContain('bpmMin=60')
    expect(result!.fallbackUrl).toContain('bpmMax=80')
    expect(result!.fallbackUrl).toContain('durationMin=120')
    expect(result!.fallbackIds).toEqual([57, 64, 320])
  })

  it('handles missing optional fields', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Mood: Peaceful | Genre: Acoustic'
    )
    expect(result).not.toBeNull()
    expect(result!.ids).toEqual([65, 10])
    expect(result!.url).toContain('includedIds=65&includedIds=10')
    expect(result!.url).not.toContain('bpmMin')
    expect(result!.url).not.toContain('bpmMax')
    expect(result!.url).not.toContain('durationMin')
    expect(result!.fallbackUrl).toBeNull()
  })

  it('maps synonyms to known IDs', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Mood: Determined, Melancholic | Genre: Cinematic'
    )
    expect(result).not.toBeNull()
    expect(result!.ids).toEqual([62, 5, 16])
    expect(result!.fallbackUrl).not.toBeNull()
    expect(result!.fallbackIds).toEqual([62, 5])
  })

  it('handles cross-category synonym mapping', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Mood: Cinematic, Dark'
    )
    expect(result).not.toBeNull()
    expect(result!.ids).toEqual([62, 92])
    expect(result!.fallbackUrl).toBeNull()
  })

  it('caps IDs at 4 with tier priority', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Mood: Mysterious, Dark, Peaceful, Energetic | Genre: Ambient, Electronic, Cinematic'
    )
    expect(result).not.toBeNull()
    expect(result!.ids).toEqual([57, 64, 320, 92])
  })

  it('cascades tiers when no genres are present', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Mood: Mysterious, Dark, Peaceful, Energetic'
    )
    expect(result).not.toBeNull()
    expect(result!.ids).toEqual([320, 92, 10, 105])
  })

  it('generates fallback with 3 IDs when input has 4', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Mood: Mysterious, Dark | Genre: Ambient, Electronic | BPM: 60-80 | Duration: 2+ min'
    )
    expect(result).not.toBeNull()
    expect(result!.fallbackIds).toHaveLength(3)
    expect(result!.fallbackUrl).not.toEqual(result!.url)
  })

  it('returns no fallback when 2 or fewer IDs', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Genre: Ambient | Mood: Dark'
    )
    expect(result).not.toBeNull()
    expect(result!.ids).toEqual([57, 92])
    expect(result!.fallbackUrl).toBeNull()
  })

  it('expands single BPM value to a +/-10 range', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Genre: Ambient | BPM: 80'
    )
    expect(result).not.toBeNull()
    expect(result!.url).toContain('bpmMin=70')
    expect(result!.url).toContain('bpmMax=90')
  })

  it('uses exact min and max for BPM range', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Genre: Ambient | BPM: 90-100'
    )
    expect(result).not.toBeNull()
    expect(result!.url).toContain('bpmMin=90')
    expect(result!.url).toContain('bpmMax=100')
  })

  it('parses "2+ min" duration as 120 seconds', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Genre: Ambient | Duration: 2+ min'
    )
    expect(result).not.toBeNull()
    expect(result!.url).toContain('durationMin=120')
  })

  it('parses "3:30+ min" duration as 210 seconds', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Genre: Ambient | Duration: 3:30+ min'
    )
    expect(result).not.toBeNull()
    expect(result!.url).toContain('durationMin=210')
  })

  it('parses "90+ sec" duration as 90 seconds', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Genre: Ambient | Duration: 90+ sec'
    )
    expect(result).not.toBeNull()
    expect(result!.url).toContain('durationMin=90')
  })

  it('accepts "Search Artist:" as an alternate trigger', () => {
    const result = parseArtlistSearch(
      'Search Artist: Mood: Dark | Genre: Ambient'
    )
    expect(result).not.toBeNull()
    expect(result!.ids).toContain(57)
    expect(result!.ids).toContain(92)
  })

  it('returns null when all terms are unknown', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Mood: Flamboyant, Zesty | Genre: Polka'
    )
    expect(result).toBeNull()
  })

  it('deduplicates IDs across categories', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Mood: Dark | Genre: Dark'
    )
    expect(result).not.toBeNull()
    const darkCount = result!.ids.filter((id) => id === 92).length
    expect(darkCount).toBe(1)
  })

  it('handles empty field values gracefully', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Mood: | Genre: Ambient'
    )
    expect(result).not.toBeNull()
    expect(result!.ids).toEqual([57])
  })

  it('returns null when trigger is absent', () => {
    const result = parseArtlistSearch('Style: Minimal dark pads')
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = parseArtlistSearch('')
    expect(result).toBeNull()
  })

  it('handles instrument field with tier backfill', () => {
    const result = parseArtlistSearch(
      'Search Artlist: Genre: Cinematic | Instrument: Piano, Strings'
    )
    expect(result).not.toBeNull()
    expect(result!.ids).toEqual([62, 40, 42])
    expect(result!.fallbackIds).toEqual([62, 40])
  })
})

describe('parseArtlistSfxRef', () => {
  it('extracts name from double-quoted Artlist reference', () => {
    const result = parseArtlistSfxRef('Artlist "Low Impact Hit"')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Low Impact Hit')
    expect(result!.url).toMatch(/^https:\/\/artlist\.io\/royalty-free-sound-effects\?search=/)
    expect(result!.url).toMatch(/Low(\+|%20)Impact(\+|%20)Hit/)
  })

  it('extracts name from single-quoted Artlist reference', () => {
    const result = parseArtlistSfxRef("Artlist 'Cinematic Riser Short'")
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Cinematic Riser Short')
  })

  it('extracts name from curly-quoted Artlist reference', () => {
    const result = parseArtlistSfxRef('Artlist “Track Name”')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Track Name')
  })

  it('extracts name when Artlist reference is embedded in a sentence', () => {
    const result = parseArtlistSfxRef(
      'SFX riser sutil 2s — Artlist "Cinematic Riser Short"'
    )
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Cinematic Riser Short')
  })

  it('returns null when no Artlist keyword is present', () => {
    const result = parseArtlistSfxRef('SFX riser 2s from my library')
    expect(result).toBeNull()
  })

  it('returns null when quoted name has no Artlist keyword', () => {
    const result = parseArtlistSfxRef('"Some Track Name"')
    expect(result).toBeNull()
  })
})
