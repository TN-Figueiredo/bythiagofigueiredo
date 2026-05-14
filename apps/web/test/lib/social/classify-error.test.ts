import { describe, it, expect } from 'vitest'
import { classifyError } from '@/lib/social/workflows'

describe('classifyError', () => {
  it('returns transient for non-Error input', () => {
    expect(classifyError('some string')).toBe('transient')
    expect(classifyError(42)).toBe('transient')
    expect(classifyError(null)).toBe('transient')
    expect(classifyError(undefined)).toBe('transient')
    expect(classifyError({ message: 'fake' })).toBe('transient')
  })

  it('returns auth for status code 401', () => {
    expect(classifyError(new Error('Request failed (401)'))).toBe('auth')
  })

  it('returns auth for message containing "unauthorized"', () => {
    expect(classifyError(new Error('Unauthorized access denied'))).toBe('auth')
  })

  it('returns auth for message containing "token expired"', () => {
    expect(classifyError(new Error('OAuth token expired'))).toBe('auth')
  })

  it('returns permanent for status code 400', () => {
    expect(classifyError(new Error('Request failed (400)'))).toBe('permanent')
  })

  it('returns permanent for status code 403', () => {
    expect(classifyError(new Error('Request failed (403)'))).toBe('permanent')
  })

  it('returns permanent for message containing "policy"', () => {
    expect(classifyError(new Error('Content violated platform policy'))).toBe('permanent')
  })

  it('returns transient for status code 429', () => {
    expect(classifyError(new Error('Request failed (429)'))).toBe('transient')
  })

  it('returns transient for status code 503', () => {
    expect(classifyError(new Error('Service unavailable (503)'))).toBe('transient')
  })

  it('returns transient for message containing "rate limit"', () => {
    expect(classifyError(new Error('Rate limit exceeded'))).toBe('transient')
  })

  it('returns transient for message containing "econnreset"', () => {
    expect(classifyError(new Error('ECONNRESET connection lost'))).toBe('transient')
  })

  it('defaults to transient for unknown error message', () => {
    expect(classifyError(new Error('Something completely unexpected happened'))).toBe('transient')
  })
})
