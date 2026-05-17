import { describe, it, expect } from 'vitest'
import { categorizeNote, type NoteCategory } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/categorize-note'

describe('categorizeNote', () => {
  it('detects OVERLAY from "Text overlay" keyword', () => {
    expect(categorizeNote('01:42: Text overlay (large, center): "Am I here"')).toMatchObject({ category: 'OVERLAY' })
  })

  it('detects OVERLAY from "lower third" keyword', () => {
    expect(categorizeNote('00:10: Lower third with channel name')).toMatchObject({ category: 'OVERLAY' })
  })

  it('detects MUSIC from mood/genre/BPM keywords', () => {
    expect(categorizeNote('Search Artist: Mood: Mysterious | Genre: Ambient | BPM: 60-80')).toMatchObject({ category: 'MUSIC' })
  })

  it('detects MUSIC from "Search Artlist:" canonical format', () => {
    expect(categorizeNote('Search Artlist: Mood: Mysterious | Genre: Ambient | BPM: 60-80')).toMatchObject({ category: 'MUSIC' })
  })

  it('detects MUSIC from "track" keyword', () => {
    expect(categorizeNote('Track change here. Fade out ambient')).toMatchObject({ category: 'MUSIC' })
  })

  it('detects STYLE from "style:" keyword', () => {
    expect(categorizeNote('Style: Minimal dark pads, subtle low drone')).toMatchObject({ category: 'STYLE' })
  })

  it('detects STYLE from "feel" keyword', () => {
    expect(categorizeNote('Needs to feel deliberate and cinematic')).toMatchObject({ category: 'STYLE' })
  })

  it('detects TIMING from "entry:" keyword', () => {
    expect(categorizeNote('Entry: 00:00, fade in 1s, -20dB')).toMatchObject({ category: 'ENTRY' })
  })

  it('detects TIMING when note starts with timestamp', () => {
    expect(categorizeNote('01:42 Drop music volume to -25dB')).toMatchObject({ category: 'TIMING' })
  })

  it('detects VISUAL from "montage" keyword', () => {
    expect(categorizeNote('00:00-00:03: Consider 3-photo montage')).toMatchObject({ category: 'VISUAL' })
  })

  it('detects VISUAL from "B-roll" keyword', () => {
    expect(categorizeNote('00:20: Optional — B-roll photos of Canada')).toMatchObject({ category: 'VISUAL' })
  })

  it('detects FLOW from "continues" keyword', () => {
    expect(categorizeNote('Continues into Beat 1 — don\'t change track here')).toMatchObject({ category: 'FLOW' })
  })

  it('detects FLOW from "same track" keyword', () => {
    expect(categorizeNote('Same track, volume stays at -20dB')).toMatchObject({ category: 'FLOW' })
  })

  it('detects SFX from "SFX" keyword', () => {
    expect(categorizeNote('00:06 SFX impact leve — Artlist "Low Impact Hit"')).toMatchObject({ category: 'SFX' })
  })

  it('SFX takes priority over TIMING for timestamped SFX notes', () => {
    expect(categorizeNote('00:17 SFX bass drop — marca fim do hook')).toMatchObject({ category: 'SFX' })
  })

  it('falls back to NOTE for unrecognized content', () => {
    expect(categorizeNote('Remember to check the color grading')).toMatchObject({ category: 'NOTE' })
  })

  it('extracts first timestamp from note', () => {
    const result = categorizeNote('01:42: Text overlay "something"')
    expect(result.timestamp).toBe('01:42')
  })

  it('extracts timestamp range', () => {
    const result = categorizeNote('00:00-00:03: Consider montage')
    expect(result.timestamp).toBe('00:00-00:03')
  })

  it('returns null timestamp when no timestamp found', () => {
    const result = categorizeNote('Style: Minimal dark pads')
    expect(result.timestamp).toBeNull()
  })

  it('detects optional notes', () => {
    const result = categorizeNote('Optional — B-roll photos of Canada')
    expect(result.isOptional).toBe(true)
  })

  it('non-optional notes return false', () => {
    const result = categorizeNote('Text overlay: something important')
    expect(result.isOptional).toBe(false)
  })

  it('OVERLAY takes priority over VISUAL for "Text overlay"', () => {
    expect(categorizeNote('Text overlay with Ken Burns photo montage')).toMatchObject({ category: 'OVERLAY' })
  })
})
