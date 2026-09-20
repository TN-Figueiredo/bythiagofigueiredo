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
import { claimNextTask, failTask } from '@/lib/pipeline/services/youtube'
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

  it('204s on an empty queue, still carrying the rate-limit headers', async () => {
    vi.mocked(claimNextTask).mockResolvedValue({ data: null } as never)
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const res = await POST(post({ channel_ids: [CH] }))
    expect(res.status).toBe(204)
    expect(res.headers.get('X-RateLimit-Remaining')).not.toBeNull()
    expect(res.headers.get('X-RateLimit-Reset')).not.toBeNull()
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

const TASK = '22222222-2222-4222-8222-222222222222'

function postFail(body: unknown, id = TASK) {
  return new Request(`http://localhost/api/pipeline/youtube/intelligence/task/${id}/fail`, {
    method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
  }) as never
}

describe('POST .../intelligence/task/:id/fail', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(authenticateIntel).mockResolvedValue(AUTH) })

  it('200s with {id, status, retry_count} inside the data envelope', async () => {
    vi.mocked(failTask).mockResolvedValue({ data: { id: TASK, status: 'pending', retry_count: 1 } } as never)
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    const res = await POST(postFail({ reason: 'llama', retry: true }), { params: Promise.resolve({ id: TASK }) })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { id: TASK, status: 'pending', retry_count: 1 } })
    expect(vi.mocked(failTask).mock.calls[0]!.slice(1)).toEqual([TASK, { reason: 'llama', retry: true }])
  })

  it('400s on an invalid uuid, on a missing reason and on a reason over 500 chars — before touching the service', async () => {
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    const bad = await POST(postFail({ reason: 'x' }, 'nope'), { params: Promise.resolve({ id: 'nope' }) })
    expect(bad.status).toBe(400)
    const noReason = await POST(postFail({}), { params: Promise.resolve({ id: TASK }) })
    expect(noReason.status).toBe(400)
    const long = await POST(postFail({ reason: 'x'.repeat(501) }), { params: Promise.resolve({ id: TASK }) })
    expect(long.status).toBe(400)
    expect(failTask).not.toHaveBeenCalled()
  })

  it('maps service errors to 404, 409 and 500', async () => {
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    for (const [code, status] of [['NOT_FOUND', 404], ['TASK_NOT_RUNNING', 409], ['INTERNAL_ERROR', 500]] as const) {
      vi.mocked(failTask).mockRejectedValue(new PipelineServiceError(code, code, status))
      const res = await POST(postFail({ reason: 'x' }), { params: Promise.resolve({ id: TASK }) })
      expect(res.status).toBe(status)
    }
  })
})
