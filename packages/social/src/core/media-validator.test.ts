import { describe, it, expect } from 'vitest'
import { getMediaSpec, validateMedia, type MediaFile } from './media-validator'

const MB = 1024 * 1024

describe('getMediaSpec', () => {
  it('returns a spec for a known provider:placement', () => {
    expect(getMediaSpec('instagram', 'reel')).toBeDefined()
  })

  it('returns undefined for an unknown placement', () => {
    expect(getMediaSpec('instagram', 'nope')).toBeUndefined()
  })
})

describe('validateMedia', () => {
  const validReel: MediaFile = {
    size: 50 * MB,
    format: 'mp4',
    duration: 30,
    width: 1080,
    height: 1920,
  }

  it('accepts a valid file', () => {
    const r = validateMedia(validReel, 'instagram', 'reel')
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
  })

  it('rejects an unknown placement', () => {
    const r = validateMedia(validReel, 'instagram', 'nope')
    expect(r.valid).toBe(false)
    expect(r.errors[0]).toContain('Unknown placement')
  })

  it('rejects a disallowed format', () => {
    const r = validateMedia({ ...validReel, format: 'gif' }, 'instagram', 'reel')
    expect(r.valid).toBe(false)
    expect(r.errors.some((e) => e.includes('not allowed'))).toBe(true)
  })

  it('normalizes format case and leading dot', () => {
    const r = validateMedia({ ...validReel, format: '.MP4' }, 'instagram', 'reel')
    expect(r.valid).toBe(true)
  })

  it('rejects oversize files', () => {
    const r = validateMedia({ ...validReel, size: 2 * 1024 * MB }, 'instagram', 'reel')
    expect(r.errors.some((e) => e.includes('exceeds limit'))).toBe(true)
  })

  it('rejects duration over the max', () => {
    const r = validateMedia({ ...validReel, duration: 120 }, 'instagram', 'reel')
    expect(r.errors.some((e) => e.includes('exceeds max'))).toBe(true)
  })

  it('rejects duration under the min', () => {
    const r = validateMedia({ ...validReel, duration: 2 }, 'instagram', 'reel')
    expect(r.errors.some((e) => e.includes('below min'))).toBe(true)
  })

  it('rejects an aspect ratio outside tolerance', () => {
    const r = validateMedia({ ...validReel, width: 1920, height: 1080 }, 'instagram', 'reel')
    expect(r.errors.some((e) => e.includes('Aspect ratio'))).toBe(true)
  })

  it('accepts an aspect ratio within tolerance', () => {
    const r = validateMedia({ ...validReel, width: 1080, height: 1920 }, 'instagram', 'reel')
    expect(r.valid).toBe(true)
  })

  it('accumulates multiple errors', () => {
    const r = validateMedia(
      { size: 2 * 1024 * MB, format: 'gif', duration: 200 },
      'instagram',
      'reel',
    )
    expect(r.errors.length).toBeGreaterThanOrEqual(2)
  })
})
