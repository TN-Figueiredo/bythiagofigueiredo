// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockHandleUpload, mockRequireSiteScope, mockGetSiteContext } = vi.hoisted(() => ({
  mockHandleUpload: vi.fn(),
  mockRequireSiteScope: vi.fn(),
  mockGetSiteContext: vi.fn(),
}))

vi.mock('@vercel/blob/client', () => ({
  handleUpload: mockHandleUpload,
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: mockGetSiteContext,
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: mockRequireSiteScope,
}))

import { POST } from '../../src/app/api/media/upload/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SITE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function uploadRequest(body: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/api/media/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/media/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSiteContext.mockResolvedValue({
      siteId: SITE_ID,
      orgId: 'org-1',
      defaultLocale: 'pt-br',
    })
    mockRequireSiteScope.mockResolvedValue({ ok: true, user: { id: 'u1' } })
  })

  it('returns upload token on successful handleUpload', async () => {
    const expectedResponse = {
      type: 'blob.generate-client-token',
      clientToken: 'vercel_blob_client_token_xyz',
    }
    mockHandleUpload.mockResolvedValueOnce(expectedResponse)

    const res = await POST(uploadRequest({ type: 'blob.generate-client-token' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.clientToken).toBe('vercel_blob_client_token_xyz')
  })

  it('returns 400 when handleUpload throws (unauthenticated)', async () => {
    mockHandleUpload.mockImplementationOnce(async ({ onBeforeGenerateToken }: { onBeforeGenerateToken: () => Promise<unknown> }) => {
      // Simulate the auth check inside onBeforeGenerateToken
      mockRequireSiteScope.mockResolvedValueOnce({ ok: false, reason: 'unauthenticated' })
      await onBeforeGenerateToken()
    })

    const res = await POST(uploadRequest({ type: 'blob.generate-client-token' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('unauthenticated')
  })

  it('returns 400 when handleUpload throws (forbidden)', async () => {
    mockHandleUpload.mockImplementationOnce(async ({ onBeforeGenerateToken }: { onBeforeGenerateToken: () => Promise<unknown> }) => {
      mockRequireSiteScope.mockResolvedValueOnce({ ok: false, reason: 'forbidden' })
      await onBeforeGenerateToken()
    })

    const res = await POST(uploadRequest({ type: 'blob.generate-client-token' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('forbidden')
  })

  it('returns 400 with generic message for non-Error throws', async () => {
    mockHandleUpload.mockRejectedValueOnce('string-error')

    const res = await POST(uploadRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Upload failed')
  })

  it('invokes onBeforeGenerateToken with correct allowed types and max size', async () => {
    let tokenConfig: Record<string, unknown> | undefined

    mockHandleUpload.mockImplementationOnce(async ({ onBeforeGenerateToken }: { onBeforeGenerateToken: () => Promise<Record<string, unknown>> }) => {
      tokenConfig = await onBeforeGenerateToken()
      return { type: 'blob.generate-client-token', clientToken: 'tok' }
    })

    await POST(uploadRequest({ type: 'blob.generate-client-token' }))

    expect(tokenConfig).toBeDefined()
    expect(tokenConfig!.allowedContentTypes).toEqual(
      expect.arrayContaining(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
    )
    expect(tokenConfig!.maximumSizeInBytes).toBe(50 * 1024 * 1024)
  })
})
