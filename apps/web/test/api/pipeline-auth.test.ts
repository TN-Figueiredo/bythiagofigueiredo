import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          is: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { id: 'key-1', site_id: 'site-1', permissions: ['read', 'write'] },
            }),
          })),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
    })),
  })),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', timezone: 'America/Sao_Paulo' }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true }),
}))

import { authenticatePipeline, requirePermission, getRateLimitHeaders, buildRateLimitHeaders, UUID_REGEX } from '@/lib/pipeline/auth'

describe('authenticatePipeline', () => {
  it('authenticates via API key', async () => {
    const req = { headers: new Headers({ 'X-Pipeline-Key': 'test-key-123' }) } as any
    const result = await authenticatePipeline(req)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.auth.source).toBe('api_key')
      expect(result.auth.siteId).toBe('site-1')
      expect(result.auth.permissions).toEqual(['read', 'write'])
    }
  })

  it('falls back to session auth when no API key', async () => {
    const req = { headers: new Headers({}) } as any
    const result = await authenticatePipeline(req)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.auth.source).toBe('session')
      expect(result.auth.permissions).toEqual(['read', 'write'])
    }
  })
})

describe('requirePermission', () => {
  it('read permission allows read', () => {
    expect(requirePermission({ siteId: 's', permissions: ['read'], source: 'api_key' }, 'read')).toBe(true)
  })

  it('read permission blocks write', () => {
    expect(requirePermission({ siteId: 's', permissions: ['read'], source: 'api_key' }, 'write')).toBe(false)
  })

  it('write permission allows read and write', () => {
    expect(requirePermission({ siteId: 's', permissions: ['write'], source: 'api_key' }, 'read')).toBe(true)
    expect(requirePermission({ siteId: 's', permissions: ['write'], source: 'api_key' }, 'write')).toBe(true)
  })

  it('write permission blocks admin', () => {
    expect(requirePermission({ siteId: 's', permissions: ['write'], source: 'api_key' }, 'admin')).toBe(false)
  })

  it('admin allows everything', () => {
    expect(requirePermission({ siteId: 's', permissions: ['admin'], source: 'api_key' }, 'read')).toBe(true)
    expect(requirePermission({ siteId: 's', permissions: ['admin'], source: 'api_key' }, 'write')).toBe(true)
    expect(requirePermission({ siteId: 's', permissions: ['admin'], source: 'api_key' }, 'admin')).toBe(true)
  })
})

describe('getRateLimitHeaders', () => {
  it('returns full limit for unknown key', () => {
    const headers = getRateLimitHeaders('unknown-key-hash')
    expect(headers['X-RateLimit-Remaining']).toBe('100')
  })
})

describe('buildRateLimitHeaders', () => {
  it('returns headers for api_key auth', () => {
    const headers = buildRateLimitHeaders({ siteId: 's', permissions: ['read'], source: 'api_key', keyHash: 'abc123' })
    expect(headers).toBeDefined()
    expect((headers as Record<string, string>)['X-RateLimit-Remaining']).toBe('100')
  })

  it('returns undefined for session auth', () => {
    expect(buildRateLimitHeaders({ siteId: 's', permissions: ['admin'], source: 'session' })).toBeUndefined()
  })
})

describe('UUID_REGEX', () => {
  it('matches valid UUIDs', () => {
    expect(UUID_REGEX.test('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    expect(UUID_REGEX.test('F47AC10B-58CC-4372-A567-0E02B2C3D479')).toBe(true)
  })

  it('rejects invalid strings', () => {
    expect(UUID_REGEX.test('not-a-uuid')).toBe(false)
    expect(UUID_REGEX.test('')).toBe(false)
    expect(UUID_REGEX.test('550e8400-e29b-41d4-a716')).toBe(false)
    expect(UUID_REGEX.test('550e8400-e29b-41d4-a716-44665544000g')).toBe(false)
  })
})
