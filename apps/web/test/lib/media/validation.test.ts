import { describe, it, expect } from 'vitest'
import {
  validateMimeType,
  validateFileSize,
  validateDimensions,
  sanitizeFilename,
} from '../../../lib/media/validation'

describe('validateMimeType', () => {
  it('passes for image/jpeg', () => {
    expect(validateMimeType('image/jpeg')).toEqual({ ok: true })
  })
  it('passes for image/png', () => {
    expect(validateMimeType('image/png')).toEqual({ ok: true })
  })
  it('passes for image/webp', () => {
    expect(validateMimeType('image/webp')).toEqual({ ok: true })
  })
  it('passes for image/gif', () => {
    expect(validateMimeType('image/gif')).toEqual({ ok: true })
  })
  it('passes for image/svg+xml', () => {
    expect(validateMimeType('image/svg+xml')).toEqual({ ok: true })
  })
  it('rejects application/pdf', () => {
    const result = validateMimeType('application/pdf')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('unsupported_format')
  })
  it('rejects text/html', () => {
    expect(validateMimeType('text/html').ok).toBe(false)
  })
  it('rejects empty string', () => {
    expect(validateMimeType('').ok).toBe(false)
  })
})

describe('validateFileSize', () => {
  it('passes when under folder limit (authors: 2MB)', () => {
    expect(validateFileSize(1_000_000, 'authors')).toEqual({ ok: true })
  })
  it('rejects when over folder limit (authors: 2MB)', () => {
    const result = validateFileSize(3_000_000, 'authors')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('file_too_large')
      expect(result.error).toContain('2')
    }
  })
  it('passes at exact folder limit (blog: 5MB)', () => {
    expect(validateFileSize(5_242_880, 'blog')).toEqual({ ok: true })
  })
  it('rejects zero bytes', () => {
    expect(validateFileSize(0, 'general').ok).toBe(false)
  })
  it('rejects negative size', () => {
    expect(validateFileSize(-1, 'general').ok).toBe(false)
  })
  it('uses branding limit of 1MB', () => {
    expect(validateFileSize(1_048_576, 'branding')).toEqual({ ok: true })
    expect(validateFileSize(1_048_577, 'branding').ok).toBe(false)
  })
})

describe('validateDimensions', () => {
  it('passes for 100×100', () => {
    expect(validateDimensions(100, 100, 'general')).toEqual({ ok: true })
  })
  it('rejects 8193×100 (over global 8192 max)', () => {
    const result = validateDimensions(8193, 100, 'general')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('dimension_exceeded')
  })
  it('rejects 100×8193 (height over global max)', () => {
    expect(validateDimensions(100, 8193, 'general').ok).toBe(false)
  })
  it('rejects 5×5 (under global 10×10 min)', () => {
    expect(validateDimensions(5, 5, 'general').ok).toBe(false)
  })
  it('rejects 9×10 (width below min)', () => {
    expect(validateDimensions(9, 10, 'general').ok).toBe(false)
  })
  it('passes at exact folder max (general: 4096×4096)', () => {
    expect(validateDimensions(4096, 4096, 'general')).toEqual({ ok: true })
  })
  it('passes at exact 10×10', () => {
    expect(validateDimensions(10, 10, 'general')).toEqual({ ok: true })
  })
  it('rejects when over folder max dimension (links: 1024px)', () => {
    expect(validateDimensions(1025, 500, 'links').ok).toBe(false)
  })
  it('passes at folder max dimension (links: 1024px)', () => {
    expect(validateDimensions(1024, 1024, 'links')).toEqual({ ok: true })
  })
})

describe('sanitizeFilename', () => {
  it('strips path traversal ../', () => {
    expect(sanitizeFilename('../../../etc/passwd.jpg')).toBe('etc-passwd.jpg')
  })
  it('converts spaces to hyphens', () => {
    expect(sanitizeFilename('my photo file.png')).toBe('my-photo-file.png')
  })
  it('converts to kebab-case (lowercase)', () => {
    expect(sanitizeFilename('My_Photo_FILE.PNG')).toBe('my-photo-file.png')
  })
  it('strips non-alphanumeric chars except hyphens and dots', () => {
    expect(sanitizeFilename('hello@world#2024!.jpg')).toBe('helloworld2024.jpg')
  })
  it('truncates at 200 chars preserving extension', () => {
    const longName = 'a'.repeat(250) + '.webp'
    const result = sanitizeFilename(longName)
    expect(result.length).toBeLessThanOrEqual(200)
    expect(result).toMatch(/\.webp$/)
  })
  it('preserves extension', () => {
    expect(sanitizeFilename('test.file.NAME.svg')).toBe('test.file.name.svg')
  })
  it('handles no extension', () => {
    expect(sanitizeFilename('noext')).toBe('noext')
  })
  it('collapses multiple hyphens', () => {
    expect(sanitizeFilename('a---b___c   d.jpg')).toBe('a-b-c-d.jpg')
  })
  it('strips leading/trailing hyphens from stem', () => {
    expect(sanitizeFilename('-leading-trailing-.png')).toBe('leading-trailing.png')
  })
})
