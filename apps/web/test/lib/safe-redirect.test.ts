import { describe, it, expect } from 'vitest'
import { safeRedirect } from '../../lib/auth/safe-redirect'

describe('safeRedirect', () => {
  it('returns relative path unchanged', () => {
    expect(safeRedirect('/cms')).toBe('/cms')
    expect(safeRedirect('/admin/users')).toBe('/admin/users')
  })

  it('returns custom fallback when input is null', () => {
    expect(safeRedirect(null)).toBe('/cms')
    expect(safeRedirect(null, '/signin')).toBe('/signin')
  })

  it('returns custom fallback when input is undefined', () => {
    expect(safeRedirect(undefined)).toBe('/cms')
    expect(safeRedirect(undefined, '/signin')).toBe('/signin')
  })

  it('returns fallback when input is empty string', () => {
    expect(safeRedirect('')).toBe('/cms')
  })

  it('blocks protocol-relative URL (//evil.com)', () => {
    expect(safeRedirect('//evil.com')).toBe('/cms')
    expect(safeRedirect('//evil.com/path')).toBe('/cms')
  })

  it('blocks absolute https URL', () => {
    expect(safeRedirect('https://evil.com')).toBe('/cms')
    expect(safeRedirect('https://x.com/steal')).toBe('/cms')
  })

  it('blocks absolute http URL', () => {
    expect(safeRedirect('http://evil.com')).toBe('/cms')
  })

  it('blocks /\\ edge case (protocol-relative edge)', () => {
    expect(safeRedirect('/\\')).toBe('/cms')
    expect(safeRedirect('/\\evil.com')).toBe('/cms')
  })

  it('uses provided fallback when blocking', () => {
    expect(safeRedirect('https://evil.com', '/signin')).toBe('/signin')
    expect(safeRedirect('//evil.com', '/signin')).toBe('/signin')
  })

  it('allows nested relative paths', () => {
    expect(safeRedirect('/signup/invite/abc')).toBe('/signup/invite/abc')
    expect(safeRedirect('/admin/users?tab=invites')).toBe('/admin/users?tab=invites')
  })
})
