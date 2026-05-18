import { describe, it, expect } from 'vitest'
import { UUID_REGEX, requirePermission, getRateLimitHeaders, type PipelineAuth } from '@/lib/pipeline/auth'

describe('UUID_REGEX', () => {
  it('matches valid UUIDs', () => {
    expect(UUID_REGEX.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    expect(UUID_REGEX.test('6BA7B810-9DAD-11D1-80B4-00C04FD430C8')).toBe(true)
  })

  it('rejects non-UUIDs', () => {
    expect(UUID_REGEX.test('')).toBe(false)
    expect(UUID_REGEX.test('not-a-uuid')).toBe(false)
    expect(UUID_REGEX.test('550e8400e29b41d4a716446655440000')).toBe(false)
    expect(UUID_REGEX.test('550e8400-e29b-41d4-a716-44665544000')).toBe(false)
    expect(UUID_REGEX.test('550e8400-e29b-41d4-a716-4466554400001')).toBe(false)
  })
})

describe('requirePermission', () => {
  const makeAuth = (permissions: string[]): PipelineAuth => ({
    siteId: 'site-1',
    permissions,
    source: 'api_key',
  })

  it('read permission grants read', () => {
    expect(requirePermission(makeAuth(['read']), 'read')).toBe(true)
  })

  it('read permission does not grant write', () => {
    expect(requirePermission(makeAuth(['read']), 'write')).toBe(false)
  })

  it('read permission does not grant admin', () => {
    expect(requirePermission(makeAuth(['read']), 'admin')).toBe(false)
  })

  it('write permission grants read and write', () => {
    const auth = makeAuth(['write'])
    expect(requirePermission(auth, 'read')).toBe(true)
    expect(requirePermission(auth, 'write')).toBe(true)
  })

  it('write permission does not grant admin', () => {
    expect(requirePermission(makeAuth(['write']), 'admin')).toBe(false)
  })

  it('admin permission grants all levels', () => {
    const auth = makeAuth(['admin'])
    expect(requirePermission(auth, 'read')).toBe(true)
    expect(requirePermission(auth, 'write')).toBe(true)
    expect(requirePermission(auth, 'admin')).toBe(true)
  })

  it('empty permissions deny everything', () => {
    const auth = makeAuth([])
    expect(requirePermission(auth, 'read')).toBe(false)
    expect(requirePermission(auth, 'write')).toBe(false)
    expect(requirePermission(auth, 'admin')).toBe(false)
  })
})

describe('getRateLimitHeaders', () => {
  it('returns full limit for unknown key hash', () => {
    const headers = getRateLimitHeaders('unknown-key-hash-test')
    expect(headers['X-RateLimit-Remaining']).toBe('100')
    expect(headers['X-RateLimit-Reset']).toBe('0')
  })
})
