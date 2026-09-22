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

  // Regression for the 2026-09-20 fix: parseBody(req, ClaimSchema, auth) threads the
  // already-authenticated `auth` through so its 400 carries the same X-RateLimit-* the
  // 204 branch below already sends — an api_key caller shouldn't lose rate-limit
  // visibility just because its body happened to be invalid.
  it("400s an invalid body with X-RateLimit-* for an api_key caller — parseBody's `auth` wiring", async () => {
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/claim/route')
    const res = await POST(post({ channel_ids: [] }))
    expect(res.status).toBe(400)
    expect(res.headers.get('X-RateLimit-Remaining')).not.toBeNull()
    expect(res.headers.get('X-RateLimit-Reset')).not.toBeNull()
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

  // Regression for the 2026-09-20 fix: parseBody(req, FailSchema, auth) threads `auth`
  // through so a bad-reason 400 carries X-RateLimit-* for an api_key caller, same as the
  // claim route's 400 and 204.
  it("400s an invalid body with X-RateLimit-* for an api_key caller — parseBody's `auth` wiring", async () => {
    const { POST } = await import('@/app/api/pipeline/youtube/intelligence/task/[id]/fail/route')
    const res = await POST(postFail({}), { params: Promise.resolve({ id: TASK }) })
    expect(res.status).toBe(400)
    expect(res.headers.get('X-RateLimit-Remaining')).not.toBeNull()
    expect(res.headers.get('X-RateLimit-Reset')).not.toBeNull()
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

// ─── PATCH .../intelligence — real parseBody, wiring of the `auth` 3rd arg ──

const SESSION_AUTH = { ok: true as const, auth: { siteId: 'site-1', permissions: ['read', 'intelligence'], source: 'session' as const } }

function patchIntel(rawBody: string) {
  return new Request('http://localhost/api/pipeline/youtube/intelligence', {
    method: 'PATCH', body: rawBody, headers: { 'content-type': 'application/json' },
  }) as never
}

describe('PATCH .../intelligence — parseBody(req, undefined, auth) wiring', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(authenticateIntel).mockResolvedValue(AUTH) })

  // Regression for the 2026-09-20 fix: PATCH now calls parseBody(req, undefined, auth) —
  // schema is undefined here (the service layer validates the shape), so the only way to
  // hit parseBody's 400 from this route is invalid JSON. Mirrors the claim/fail coverage
  // above: an api_key caller keeps its rate-limit visibility on a bad body, same as a
  // valid one.
  it('400s invalid JSON with X-RateLimit-* for an api_key caller', async () => {
    const { PATCH } = await import('@/app/api/pipeline/youtube/intelligence/route')
    const res = await PATCH(patchIntel('not json'))
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
    expect(res.headers.get('X-RateLimit-Remaining')).not.toBeNull()
    expect(res.headers.get('X-RateLimit-Reset')).not.toBeNull()
  })

  // buildRateLimitHeaders only attaches headers for source === 'api_key' (it needs a
  // keyHash to look up the rate-limit bucket by). Unlike claim/fail, PATCH's
  // authenticateIntel call has no `apiKeyOnly` gate, so a session caller reaches
  // parseBody — and must NOT get rate-limit headers it has no bucket for.
  it('400s invalid JSON with NO rate-limit headers for a session caller', async () => {
    vi.mocked(authenticateIntel).mockResolvedValue(SESSION_AUTH)
    const { PATCH } = await import('@/app/api/pipeline/youtube/intelligence/route')
    const res = await PATCH(patchIntel('not json'))
    expect(res.status).toBe(400)
    expect(res.headers.get('X-RateLimit-Remaining')).toBeNull()
    expect(res.headers.get('X-RateLimit-Reset')).toBeNull()
  })
})
