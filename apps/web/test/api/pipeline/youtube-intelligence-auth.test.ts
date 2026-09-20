import { describe, it, expect } from 'vitest'
import { requirePermission, type PipelineAuth } from '@/lib/pipeline/auth'

function auth(permissions: string[]): PipelineAuth {
  return { siteId: 'site-1', permissions, source: 'api_key', keyHash: 'h', keyId: 'k' }
}

describe('requirePermission — intelligence', () => {
  it('rejects intelligence for a read-only key', () => {
    expect(requirePermission(auth(['read']), 'intelligence')).toBe(false)
  })

  it('accepts intelligence for {read,intelligence}', () => {
    expect(requirePermission(auth(['read', 'intelligence']), 'intelligence')).toBe(true)
  })

  it('rejects write for {read,intelligence}', () => {
    expect(requirePermission(auth(['read', 'intelligence']), 'write')).toBe(false)
  })

  it('accepts intelligence for write and for admin', () => {
    expect(requirePermission(auth(['read', 'write']), 'intelligence')).toBe(true)
    expect(requirePermission(auth(['admin']), 'intelligence')).toBe(true)
  })

  it('keeps read working for {read,intelligence}', () => {
    expect(requirePermission(auth(['read', 'intelligence']), 'read')).toBe(true)
  })
})
