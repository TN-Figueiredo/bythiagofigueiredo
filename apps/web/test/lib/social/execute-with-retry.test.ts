import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEq = vi.fn().mockReturnThis()
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate })

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

vi.mock('@tn-figueiredo/social', async () => {
  const actual = await vi.importActual('@tn-figueiredo/social')
  return {
    ...actual,
    RETRY_DELAYS: [10, 20],
    encrypt: (val: string) => `encrypted-${val}`,
    getMasterKey: () => 'test-key-32-chars-for-testing!!!',
  }
})

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { executeWithRetry } from '@/lib/social/workflows'
import type {
  ISocialProvider,
  SocialConnection,
  SocialDelivery,
  SocialPost,
} from '@tn-figueiredo/social'
import * as Sentry from '@sentry/nextjs'

function makeDelivery(overrides: Partial<SocialDelivery> = {}): SocialDelivery {
  return {
    id: 'd1',
    post_id: 'p1',
    connection_id: 'c1',
    provider: 'facebook',
    status: 'pending',
    platform_post_id: null,
    platform_url: null,
    content_override: null,
    attempt: 0,
    max_attempts: 3,
    last_error: null,
    error_type: null,
    published_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makeConnection(overrides: Partial<SocialConnection> = {}): SocialConnection {
  return {
    id: 'c1',
    site_id: 's1',
    provider: 'facebook',
    account_id: 'acc1',
    account_name: 'Test Account',
    access_token_enc: 'enc-token',
    refresh_token_enc: 'enc-refresh',
    page_token_enc: null,
    token_expires_at: null,
    scopes: ['publish'],
    metadata: {},
    connected_at: '2026-01-01T00:00:00Z',
    revoked_at: null,
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: 'p1',
    site_id: 's1',
    created_by: 'u1',
    type: 'link',
    status: 'publishing',
    scheduled_at: null,
    user_timezone: 'America/Sao_Paulo',
    published_at: null,
    content: { title: 'Test', url: 'https://example.com' },
    template_id: null,
    idempotency_key: 'idem-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function makePublishFn(overrides: Partial<ISocialProvider> = {}): ISocialProvider {
  return {
    provider: 'facebook',
    publish: vi.fn().mockResolvedValue({ id: 'platform-123', url: 'https://fb.com/123' }),
    deletePost: vi.fn().mockResolvedValue(undefined),
    validateConnection: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

describe('executeWithRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEq.mockReturnThis()
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
  })

  it('returns failed when delivery.attempt >= maxAttempts', async () => {
    const delivery = makeDelivery({ attempt: 3, max_attempts: 3 })
    const result = await executeWithRetry(delivery, makeConnection(), makePost(), makePublishFn())

    expect(result).toEqual({
      status: 'failed',
      error: 'Max attempts exceeded',
      errorType: 'transient',
    })
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('returns published on successful publish', async () => {
    const publishFn = makePublishFn()
    const result = await executeWithRetry(makeDelivery(), makeConnection(), makePost(), publishFn)

    expect(result).toEqual({
      status: 'published',
      platformPostId: 'platform-123',
      platformUrl: 'https://fb.com/123',
    })
    expect(publishFn.publish).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('social_deliveries')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, status: 'publishing' }),
    )
  })

  it('returns failed immediately on permanent error', async () => {
    const publishFn = makePublishFn({
      publish: vi.fn().mockRejectedValue(new Error('Bad request (400)')),
    })
    const result = await executeWithRetry(makeDelivery(), makeConnection(), makePost(), publishFn)

    expect(result).toEqual({
      status: 'failed',
      error: 'Bad request (400)',
      errorType: 'permanent',
    })
    expect(publishFn.publish).toHaveBeenCalledTimes(1)
  })

  it('refreshes token on auth error and retries successfully', async () => {
    const publish = vi.fn()
      .mockRejectedValueOnce(new Error('Token expired (401)'))
      .mockResolvedValueOnce({ id: 'platform-456', url: 'https://fb.com/456' })

    const refreshToken = vi.fn().mockResolvedValue({
      access_token: 'new-token',
      expires_at: new Date('2027-01-01'),
    })

    const publishFn = makePublishFn({ publish, refreshToken })
    const result = await executeWithRetry(makeDelivery(), makeConnection(), makePost(), publishFn)

    expect(result).toEqual({
      status: 'published',
      platformPostId: 'platform-456',
      platformUrl: 'https://fb.com/456',
    })
    expect(refreshToken).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenCalledTimes(2)
    expect(mockFrom).toHaveBeenCalledWith('social_connections')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ access_token_enc: 'encrypted-new-token' }),
    )
  })

  it('returns skipped when token refresh throws', async () => {
    const publish = vi.fn().mockRejectedValue(new Error('Unauthorized (401)'))
    const refreshToken = vi.fn().mockRejectedValue(new Error('Refresh server down'))

    const publishFn = makePublishFn({ publish, refreshToken })
    const result = await executeWithRetry(makeDelivery(), makeConnection(), makePost(), publishFn)

    expect(result).toEqual({
      status: 'skipped',
      error: 'Auth failed: Unauthorized (401)',
      errorType: 'auth',
    })
    expect(refreshToken).toHaveBeenCalledTimes(1)
  })

  it('returns skipped when provider has no refreshToken method', async () => {
    const publish = vi.fn().mockRejectedValue(new Error('Token expired (401)'))
    const publishFn = makePublishFn({ publish })

    const result = await executeWithRetry(makeDelivery(), makeConnection(), makePost(), publishFn)

    expect(result).toEqual({
      status: 'skipped',
      error: 'Auth failed: Token expired (401)',
      errorType: 'auth',
    })
    expect(publish).toHaveBeenCalledTimes(1)
  })

  it('retries on transient error and succeeds on second attempt', async () => {
    const publish = vi.fn()
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce({ id: 'platform-789' })

    const publishFn = makePublishFn({ publish })
    const result = await executeWithRetry(makeDelivery(), makeConnection(), makePost(), publishFn)

    expect(result).toEqual({
      status: 'published',
      platformPostId: 'platform-789',
      platformUrl: undefined,
    })
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it('returns failed after exhausting all transient retries', async () => {
    const publish = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    const publishFn = makePublishFn({ publish })

    const delivery = makeDelivery({ attempt: 0, max_attempts: 3 })
    const result = await executeWithRetry(delivery, makeConnection(), makePost(), publishFn)

    expect(result).toEqual({
      status: 'failed',
      error: 'ECONNREFUSED',
      errorType: 'transient',
    })
    expect(publish).toHaveBeenCalledTimes(3)
  })

  it('caps maxAttempts to RETRY_DELAYS.length + 1', async () => {
    const publish = vi.fn().mockRejectedValue(new Error('Rate limit'))
    const publishFn = makePublishFn({ publish })

    const delivery = makeDelivery({ attempt: 0, max_attempts: 10 })
    const result = await executeWithRetry(delivery, makeConnection(), makePost(), publishFn)

    expect(result.status).toBe('failed')
    expect(publish).toHaveBeenCalledTimes(3)
  })

  it('updates status to retrying on subsequent attempts', async () => {
    const publish = vi.fn()
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({ id: 'ok' })

    const publishFn = makePublishFn({ publish })
    await executeWithRetry(makeDelivery(), makeConnection(), makePost(), publishFn)

    const updateCalls = mockUpdate.mock.calls
    expect(updateCalls[0][0]).toEqual(expect.objectContaining({ status: 'publishing', attempt: 1 }))
    expect(updateCalls[1][0]).toEqual(expect.objectContaining({ status: 'retrying', attempt: 2 }))
  })
})
