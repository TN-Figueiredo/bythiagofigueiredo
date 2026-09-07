// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockMaybeSingle = vi.fn()
const mockChain = {
  select: vi.fn(() => mockChain),
  eq: vi.fn(() => mockChain),
  maybeSingle: mockMaybeSingle,
}
const mockFrom = vi.fn(() => mockChain)

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

import {
  getSiteDomains,
  resolveOAuthOrigin,
  assertSameOriginFetch,
  __resetSiteDomainsCache,
} from '@/lib/oauth/origin'

const SITE = '11111111-2222-4333-8444-555555555555'

function req(headers: Record<string, string>): Request {
  return new Request('https://placeholder.invalid/api/instagram/oauth', { headers })
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetSiteDomainsCache()
  mockMaybeSingle.mockResolvedValue({
    data: { domains: ['BYTHIAGOFIGUEIREDO.com', 'www.bythiagofigueiredo.com', 'localhost', '127.0.0.1'] },
    error: null,
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getSiteDomains', () => {
  it('lower-cases and drops loopback entries the dev seed injects', async () => {
    await expect(getSiteDomains(SITE)).resolves.toEqual([
      'bythiagofigueiredo.com',
      'www.bythiagofigueiredo.com',
    ])
  })

  it('memoises: two calls, one query', async () => {
    await getSiteDomains(SITE)
    await getSiteDomains(SITE)
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('scopes the query to the site id', async () => {
    await getSiteDomains(SITE)
    expect(mockFrom).toHaveBeenCalledWith('sites')
    expect(mockChain.eq).toHaveBeenCalledWith('id', SITE)
  })

  it('fails closed on error and does not cache the failure', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    await expect(getSiteDomains(SITE)).resolves.toEqual([])
    await getSiteDomains(SITE)
    expect(mockFrom).toHaveBeenCalledTimes(2)
  })

  it('returns [] when domains is not an array', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { domains: null }, error: null })
    await expect(getSiteDomains(SITE)).resolves.toEqual([])
  })
})

describe('resolveOAuthOrigin', () => {
  const ALLOWED = ['bythiagofigueiredo.com', 'www.bythiagofigueiredo.com']

  it('returns https origin for an allow-listed host', () => {
    expect(resolveOAuthOrigin(req({ host: 'bythiagofigueiredo.com' }), ALLOWED)).toBe(
      'https://bythiagofigueiredo.com',
    )
  })

  it('drops the port for an allow-listed host', () => {
    expect(resolveOAuthOrigin(req({ host: 'bythiagofigueiredo.com:8443' }), ALLOWED)).toBe(
      'https://bythiagofigueiredo.com',
    )
  })

  it('is case-insensitive on the host header', () => {
    expect(resolveOAuthOrigin(req({ host: 'WWW.BYTHIAGOFIGUEIREDO.com' }), ALLOWED)).toBe(
      'https://www.bythiagofigueiredo.com',
    )
  })

  it('keeps the port for loopback outside production', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(resolveOAuthOrigin(req({ host: 'localhost:3997' }), ALLOWED)).toBe('http://localhost:3997')
  })

  it('honours x-forwarded-proto on loopback', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(
      resolveOAuthOrigin(req({ host: 'localhost:3997', 'x-forwarded-proto': 'https' }), ALLOWED),
    ).toBe('https://localhost:3997')
  })

  it('refuses loopback in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(resolveOAuthOrigin(req({ host: 'localhost:3997' }), ALLOWED)).toBeNull()
    expect(resolveOAuthOrigin(req({ host: '127.0.0.1:3000' }), ALLOWED)).toBeNull()
  })

  it('returns null for a host outside the allow-list', () => {
    expect(resolveOAuthOrigin(req({ host: 'evil.com' }), ALLOWED)).toBeNull()
    expect(resolveOAuthOrigin(req({ host: 'bythiagofigueiredo.com.evil.com' }), ALLOWED)).toBeNull()
  })

  it('returns null with an empty allow-list', () => {
    expect(resolveOAuthOrigin(req({ host: 'bythiagofigueiredo.com' }), [])).toBeNull()
  })
})

describe('assertSameOriginFetch', () => {
  it.each(['cross-site', 'same-site'])('denies %s with a descriptor, not a Response', (value) => {
    const deny = assertSameOriginFetch(req({ 'sec-fetch-site': value }))
    expect(deny).toEqual({ status: 403, code: 'cross_origin' })
    expect(deny).not.toBeInstanceOf(Response)
  })

  it.each(['same-origin', 'none'])('allows %s', (value) => {
    expect(assertSameOriginFetch(req({ 'sec-fetch-site': value }))).toBeNull()
  })

  it('allows a request with no Sec-Fetch-Site header at all', () => {
    // Decision (spec §3.0): in-app browsers and WebViews send no Fetch Metadata.
    // Refusing them would open a dead-end window on the phone the owner is holding.
    expect(assertSameOriginFetch(req({}))).toBeNull()
  })

  it('never throws', () => {
    expect(() => assertSameOriginFetch(req({ 'sec-fetch-site': 'garbage' }))).not.toThrow()
    expect(assertSameOriginFetch(req({ 'sec-fetch-site': 'garbage' }))).toBeNull()
  })
})
