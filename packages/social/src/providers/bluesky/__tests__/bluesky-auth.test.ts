import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockResumeSession = vi.fn()
const mockRefreshSession = vi.fn()

vi.mock('@atproto/api', () => ({
  BskyAgent: vi.fn().mockImplementation(() => ({
    resumeSession: mockResumeSession,
    session: {
      did: 'did:plc:test123',
      handle: 'test.bsky.social',
      accessJwt: 'new-access-jwt',
      refreshJwt: 'new-refresh-jwt',
    },
    api: {
      com: {
        atproto: {
          server: {
            refreshSession: mockRefreshSession,
          },
        },
      },
    },
  })),
  RichText: vi.fn().mockImplementation(() => ({
    text: '',
    facets: [],
    detectFacets: vi.fn(),
  })),
}))

import { refreshSession } from '../client.js'

describe('refreshSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResumeSession.mockResolvedValue(undefined)
    mockRefreshSession.mockResolvedValue({
      success: true,
      data: {
        did: 'did:plc:test123',
        handle: 'test.bsky.social',
        accessJwt: 'refreshed-access-jwt',
        refreshJwt: 'refreshed-refresh-jwt',
      },
    })
  })

  it('returns new tokens after refresh', async () => {
    const result = await refreshSession({
      did: 'did:plc:test123',
      handle: 'test.bsky.social',
      accessJwt: 'old-access',
      refreshJwt: 'old-refresh',
    })

    expect(result).toEqual({
      did: 'did:plc:test123',
      handle: 'test.bsky.social',
      accessJwt: 'refreshed-access-jwt',
      refreshJwt: 'refreshed-refresh-jwt',
    })
  })

  it('throws when refresh fails', async () => {
    mockRefreshSession.mockRejectedValue(new Error('Invalid refresh token'))

    await expect(
      refreshSession({
        did: 'did:plc:test123',
        handle: 'test.bsky.social',
        accessJwt: 'old-access',
        refreshJwt: 'old-refresh',
      }),
    ).rejects.toThrow('Invalid refresh token')
  })
})

describe('BlueskyProvider.refreshToken', () => {
  it('is defined as a method', async () => {
    const { BlueskyProvider } = await import('../index.js')
    const provider = new BlueskyProvider((s: string) => s)
    expect(typeof provider.refreshToken).toBe('function')
  })
})

describe('isJwtExpiringSoon', () => {
  it('returns true when JWT expires within 5 minutes', async () => {
    const { isJwtExpiringSoon } = await import('../client.js')
    const fiveMinFromNow = new Date(Date.now() + 4 * 60 * 1000).toISOString()
    expect(isJwtExpiringSoon(fiveMinFromNow)).toBe(true)
  })

  it('returns false when JWT expires in more than 5 minutes', async () => {
    const { isJwtExpiringSoon } = await import('../client.js')
    const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    expect(isJwtExpiringSoon(tenMinFromNow)).toBe(false)
  })

  it('returns true when JWT is already expired', async () => {
    const { isJwtExpiringSoon } = await import('../client.js')
    const past = new Date(Date.now() - 60 * 1000).toISOString()
    expect(isJwtExpiringSoon(past)).toBe(true)
  })

  it('returns true when expiresAt is null/undefined', async () => {
    const { isJwtExpiringSoon } = await import('../client.js')
    expect(isJwtExpiringSoon(null)).toBe(true)
    expect(isJwtExpiringSoon(undefined)).toBe(true)
  })
})
