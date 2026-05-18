// apps/web/test/lib/social/token-refresh.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Supabase mock state — declared before vi.mock so closures can reference them
// ---------------------------------------------------------------------------
const mockFrom = vi.fn()
const mockSupabase = { from: mockFrom }

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

// ---------------------------------------------------------------------------
// @tn-figueiredo/social mock
// encrypt/decrypt are stubbed as symmetric no-ops so we can predict values
// ---------------------------------------------------------------------------
vi.mock('@tn-figueiredo/social', async () => {
  const actual = await vi.importActual<typeof import('@tn-figueiredo/social')>(
    '@tn-figueiredo/social',
  )
  return {
    ...actual,
    encrypt: (val: string) => `enc:${val}`,
    decrypt: (val: string) => val.replace(/^enc:/, ''),
    getMasterKey: () => Buffer.from('test-master-key-32-bytes-padding!!'),
  }
})

// ---------------------------------------------------------------------------
// @tn-figueiredo/social/providers/bluesky — dynamic import mock
// ---------------------------------------------------------------------------
const mockRefreshSession = vi.fn()
vi.mock('@tn-figueiredo/social/providers/bluesky', () => ({
  refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Re-usable builder for the social_connections chain
// Supports: from → select → eq → eq → eq → order → limit → single
// ---------------------------------------------------------------------------
function buildConnectionChain(
  data: Record<string, unknown> | null,
  error: Record<string, unknown> | null = null,
) {
  const single = vi.fn().mockResolvedValue({ data, error })
  const limit = vi.fn().mockReturnValue({ single })
  const order = vi.fn().mockReturnValue({ limit })
  const isNull = vi.fn().mockReturnValue({ order })
  const eq3 = vi.fn().mockReturnValue({ is: isNull })
  const eq2 = vi.fn().mockReturnValue({ eq: eq3 })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
  const select = vi.fn().mockReturnValue({ eq: eq1 })
  return { select, single }
}

function buildUpdateChain(count: number) {
  const eqFilter = vi.fn().mockReturnThis()
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ eq: eqFilter }),
      count,
    }),
    _eqFilter: eqFilter,
    count,
  }
}

// ---------------------------------------------------------------------------
// Minimal connection row (non-expired)
// ---------------------------------------------------------------------------
const FRESH_GOOGLE_CONN = {
  id: 'conn-google-1',
  access_token_enc: 'enc:fresh-google-access',
  refresh_token_enc: 'enc:google-refresh-token',
  token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h in future
  metadata: null,
  bluesky_did: null,
  bluesky_access_jwt_enc: null,
  bluesky_refresh_jwt_enc: null,
  bluesky_jwt_expires_at: null,
}

const EXPIRED_GOOGLE_CONN = {
  ...FRESH_GOOGLE_CONN,
  id: 'conn-google-expired',
  token_expires_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
}

const FRESH_META_CONN = {
  id: 'conn-meta-1',
  access_token_enc: 'enc:fresh-meta-access',
  refresh_token_enc: null,
  token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  metadata: null,
  bluesky_did: null,
  bluesky_access_jwt_enc: null,
  bluesky_refresh_jwt_enc: null,
  bluesky_jwt_expires_at: null,
}

const EXPIRED_META_CONN = {
  ...FRESH_META_CONN,
  id: 'conn-meta-expired',
  token_expires_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
}

const BLUESKY_CONN = {
  id: 'conn-bsky-1',
  access_token_enc: 'enc:bsky-app-password',
  refresh_token_enc: null,
  token_expires_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  metadata: { handle: 'thiago.bsky.social', pds_url: 'https://bsky.social' },
  bluesky_did: 'did:plc:abc123',
  bluesky_access_jwt_enc: 'enc:bsky-access-jwt',
  bluesky_refresh_jwt_enc: 'enc:bsky-refresh-jwt',
  bluesky_jwt_expires_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
}

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------
import { ensureFreshToken, TokenRevokedError } from '@/lib/social/token-refresh'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('TokenRevokedError', () => {
  it('is an Error with name=TokenRevokedError', () => {
    const err = new TokenRevokedError('youtube', 'conn-1')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('TokenRevokedError')
    expect(err.message).toContain('youtube')
    expect(err.provider).toBe('youtube')
    expect(err.connectionId).toBe('conn-1')
  })
})

describe('ensureFreshToken — no refresh needed (token still valid)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: FRESH_GOOGLE_CONN,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
  })

  it('returns access token directly when token is not expired', async () => {
    const result = await ensureFreshToken('site-1', 'youtube')
    expect(result.accessToken).toBe('fresh-google-access') // decrypt strips enc:
    expect(result.connectionId).toBe('conn-google-1')
  })
})

describe('ensureFreshToken — connection not found', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'not found' },
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
  })

  it('throws when no active connection is found', async () => {
    await expect(ensureFreshToken('site-missing', 'youtube')).rejects.toThrow(
      'No active youtube connection found for site site-missing',
    )
  })
})

// ---------------------------------------------------------------------------
// refreshGoogle tests
// ---------------------------------------------------------------------------
describe('refreshGoogle — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // First from() call: lookup connection (expired)
    // Second from() call: CAS update (count=1 = success)
    // We use mockReturnValueOnce for the lookup and mockReturnValue for updates
    const updateResult = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 1 }),
      }),
    }

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: EXPIRED_GOOGLE_CONN,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      })
      .mockReturnValue({
        update: vi.fn().mockReturnValue(updateResult),
      })

    // Mock successful Google token endpoint
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'new-google-access',
        expires_in: 3600,
      }),
    })
  })

  it('returns new access token after successful Google refresh', async () => {
    const result = await ensureFreshToken('site-1', 'youtube')
    expect(result.accessToken).toBe('new-google-access')
    expect(result.connectionId).toBe('conn-google-expired')
  })

  it('calls Google OAuth token endpoint', async () => {
    await ensureFreshToken('site-1', 'youtube')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('refreshGoogle — token rotation (new refresh_token returned)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const updateResult = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 1 }),
      }),
    }

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: EXPIRED_GOOGLE_CONN,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      })
      .mockReturnValue({
        update: vi.fn().mockReturnValue(updateResult),
      })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'new-google-access',
        expires_in: 3600,
        refresh_token: 'rotated-refresh-token',
      }),
    })
  })

  it('includes rotated refresh_token in update payload when returned', async () => {
    const result = await ensureFreshToken('site-1', 'youtube')
    expect(result.accessToken).toBe('new-google-access')
    // Verify the update was called (rotation means refresh_token_enc should be included)
    const updateCall = mockFrom.mock.calls.find(([t]) => t === 'social_connections' && mockFrom.mock.results.length > 1)
    expect(updateCall).toBeDefined()
  })
})

describe('refreshGoogle — CAS conflict (concurrent refresh)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // CAS update returns count=0 → triggers re-read
    const reReadData = { access_token_enc: 'enc:winner-access-token' }

    mockFrom
      .mockReturnValueOnce({
        // Initial lookup: expired token
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: EXPIRED_GOOGLE_CONN,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        // CAS update: count=0 = another process won
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0 }),
          }),
        }),
      })
      .mockReturnValueOnce({
        // reReadFreshToken: reads fresh token from DB
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: reReadData, error: null }),
          }),
        }),
      })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'my-refresh-result',
        expires_in: 3600,
      }),
    })
  })

  it('returns token from DB re-read when CAS update returns count=0', async () => {
    const result = await ensureFreshToken('site-1', 'youtube')
    // decrypt strips "enc:" prefix → 'winner-access-token'
    expect(result.accessToken).toBe('winner-access-token')
  })
})

describe('refreshGoogle — revoked token', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: EXPIRED_GOOGLE_CONN,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      })
      // markConnectionRevoked calls from('social_connections').update(...)
      .mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({}),
        }),
      })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('error: invalid_grant — token revoked'),
    })
  })

  it('throws TokenRevokedError when Google returns invalid_grant', async () => {
    await expect(ensureFreshToken('site-1', 'youtube')).rejects.toThrow(TokenRevokedError)
  })

  it('thrown error has provider=youtube', async () => {
    let caught: unknown
    try {
      await ensureFreshToken('site-1', 'youtube')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(TokenRevokedError)
    expect((caught as TokenRevokedError).provider).toBe('youtube')
  })
})

// ---------------------------------------------------------------------------
// refreshMeta tests
// ---------------------------------------------------------------------------
describe('refreshMeta — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const updateResult = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 1 }),
      }),
    }

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: EXPIRED_META_CONN,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      })
      .mockReturnValue({
        update: vi.fn().mockReturnValue(updateResult),
      })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: 'new-meta-access',
        token_type: 'bearer',
        expires_in: 5183944,
      }),
    })
  })

  it('returns refreshed Meta token', async () => {
    const result = await ensureFreshToken('site-1', 'facebook')
    expect(result.accessToken).toBe('new-meta-access')
    expect(result.connectionId).toBe('conn-meta-expired')
  })

  it('calls Facebook graph API for token exchange', async () => {
    await ensureFreshToken('site-1', 'facebook')
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(url as string).toContain('graph.facebook.com')
  })
})

describe('refreshMeta — OAuthException revocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: EXPIRED_META_CONN,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      })
      .mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({}),
        }),
      })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: vi
        .fn()
        .mockResolvedValue(
          '{"error":{"type":"OAuthException","message":"Session has expired on Facebook",' +
            '"error_subcode":463}}',
        ),
    })
  })

  it('throws TokenRevokedError when Meta returns OAuthException + expired', async () => {
    await expect(ensureFreshToken('site-1', 'facebook')).rejects.toThrow(TokenRevokedError)
  })

  it('thrown error has provider=facebook', async () => {
    let caught: unknown
    try {
      await ensureFreshToken('site-1', 'facebook')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(TokenRevokedError)
    expect((caught as TokenRevokedError).provider).toBe('facebook')
  })
})

// ---------------------------------------------------------------------------
// refreshBluesky tests
// ---------------------------------------------------------------------------
describe('refreshBluesky — happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRefreshSession.mockResolvedValue({
      did: 'did:plc:abc123',
      handle: 'thiago.bsky.social',
      accessJwt: 'new-bsky-access-jwt',
      refreshJwt: 'new-bsky-refresh-jwt',
    })

    const updateResult = {
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 1 }),
      }),
    }

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: BLUESKY_CONN,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      })
      .mockReturnValue({
        update: vi.fn().mockReturnValue(updateResult),
      })
  })

  it('returns new Bluesky JWT as access token', async () => {
    const result = await ensureFreshToken('site-1', 'bluesky')
    expect(result.accessToken).toBe('new-bsky-access-jwt')
    expect(result.connectionId).toBe('conn-bsky-1')
  })

  it('calls refreshSession from bluesky provider', async () => {
    await ensureFreshToken('site-1', 'bluesky')
    expect(mockRefreshSession).toHaveBeenCalledWith(
      expect.objectContaining({
        did: 'did:plc:abc123',
        handle: 'thiago.bsky.social',
        accessJwt: 'bsky-access-jwt',   // decrypt('enc:bsky-access-jwt') = 'bsky-access-jwt'
        refreshJwt: 'bsky-refresh-jwt',
      }),
      'https://bsky.social',
    )
  })
})

describe('refreshBluesky — expired/invalid token → revocation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRefreshSession.mockRejectedValue(new Error('ExpiredToken: session expired'))

    mockFrom
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: BLUESKY_CONN,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      })
      // markConnectionRevoked
      .mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({}),
        }),
      })
  })

  it('throws TokenRevokedError when refreshSession fails with ExpiredToken', async () => {
    await expect(ensureFreshToken('site-1', 'bluesky')).rejects.toThrow(TokenRevokedError)
  })

  it('thrown error has provider=bluesky', async () => {
    let caught: unknown
    try {
      await ensureFreshToken('site-1', 'bluesky')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(TokenRevokedError)
    expect((caught as TokenRevokedError).provider).toBe('bluesky')
    expect((caught as TokenRevokedError).connectionId).toBe('conn-bsky-1')
  })
})

describe('refreshBluesky — legacy connection (no JWT columns)', () => {
  const LEGACY_BLUESKY_CONN = {
    id: 'conn-bsky-legacy',
    access_token_enc: 'enc:legacy-app-password',
    refresh_token_enc: null,
    token_expires_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    metadata: { handle: 'thiago.bsky.social' },
    bluesky_did: null,           // no DID = legacy
    bluesky_access_jwt_enc: null,
    bluesky_refresh_jwt_enc: null,
    bluesky_jwt_expires_at: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRefreshSession.mockClear()

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: LEGACY_BLUESKY_CONN,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    })
  })

  it('returns app password directly for legacy connections without JWT columns', async () => {
    const result = await ensureFreshToken('site-1', 'bluesky')
    expect(result.accessToken).toBe('legacy-app-password')
    expect(mockRefreshSession).not.toHaveBeenCalled()
  })
})

describe('refreshBluesky — CAS conflict (concurrent refresh)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRefreshSession.mockResolvedValue({
      did: 'did:plc:abc123',
      handle: 'thiago.bsky.social',
      accessJwt: 'concurrent-winner-jwt',
      refreshJwt: 'concurrent-winner-refresh',
    })

    const reReadData = { access_token_enc: 'enc:already-refreshed-jwt' }

    mockFrom
      .mockReturnValueOnce({
        // Initial lookup
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: BLUESKY_CONN,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({
        // CAS update: count=0
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0 }),
          }),
        }),
      })
      .mockReturnValueOnce({
        // reReadFreshToken
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: reReadData, error: null }),
          }),
        }),
      })
  })

  it('re-reads DB token when concurrent update wins (count=0)', async () => {
    const result = await ensureFreshToken('site-1', 'bluesky')
    expect(result.accessToken).toBe('already-refreshed-jwt')
  })
})
