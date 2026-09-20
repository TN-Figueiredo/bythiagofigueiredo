// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/pipeline/helpers', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/helpers')>()),
  authenticateIntel: vi.fn(),
}))
vi.mock('@/lib/pipeline/services/youtube', () => ({
  claimNextTask: vi.fn(),
  failTask: vi.fn(),
}))
vi.mock('@/lib/pipeline/services/http-adapter', async (orig) => ({
  ...(await orig<typeof import('@/lib/pipeline/services/http-adapter')>()),
  authToServiceContext: vi.fn(() => ({ siteId: 'site-1', permissions: ['read', 'intelligence'], keyId: 'key-forja', supabase: {}, source: 'api_key' })),
}))

import { authenticateIntel } from '@/lib/pipeline/helpers'
import { claimNextTask } from '@/lib/pipeline/services/youtube'
import { PipelineServiceError } from '@/lib/pipeline/services/types'

const AUTH = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'intelligence'], source: 'api_key' as const, keyHash: 'h', keyId: 'key-forja' } }
const CH = '11111111-1111-4111-8111-111111111111'

function post(body: unknown, url = 'http://localhost/api/pipeline/youtube/intelligence/task/claim') {
  return new Request(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) as never
}

describe('POST .../intelligence/task/claim', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(authenticateIntel).mockResolvedValue(AUTH) })

  it('200s with the claimed task, including started_at', async () => {
    vi.mocked(claimNextTask).mockResolvedValue({ data: { id: 't1', site_id: 'site-1', channel_id: CH, trigger_type: 'cron', requested_at: '2026-09-01T00:00:00Z', started_at: '2026-09-19T10:00:00Z' } } as never)
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const res = await POST(post({ channel_ids: [CH] }))
    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({ id: 't1', started_at: '2026-09-19T10:00:00Z' })
    expect(vi.mocked(claimNextTask).mock.calls[0]![1]).toEqual([CH])
  })

  it('204s on an empty queue', async () => {
    vi.mocked(claimNextTask).mockResolvedValue({ data: null } as never)
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const res = await POST(post({ channel_ids: [CH] }))
    expect(res.status).toBe(204)
  })

  it('400s without a body, with an empty list, with 11 ids or with a non-uuid — and never reaches the service', async () => {
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const eleven = Array.from({ length: 11 }, () => CH)
    for (const body of [{}, { channel_ids: [] }, { channel_ids: eleven }, { channel_ids: ['nope'] }]) {
      const res = await POST(post(body))
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
    }
    expect(claimNextTask).not.toHaveBeenCalled()
  })

  it('500s when the service reports a DB error — never a silent 204', async () => {
    vi.mocked(claimNextTask).mockRejectedValue(new PipelineServiceError('INTERNAL_ERROR', 'Failed to read the task queue', 500))
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const res = await POST(post({ channel_ids: [CH] }))
    expect(res.status).toBe(500)
  })
})
