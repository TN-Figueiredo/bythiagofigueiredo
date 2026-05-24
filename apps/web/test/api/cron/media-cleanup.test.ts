import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('@vercel/blob', () => ({
  del: vi.fn().mockResolvedValue(undefined),
}))

import { POST } from '../../../src/app/api/cron/media-cleanup/route'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { del } from '@vercel/blob'
import { setLogger, resetLogger } from '../../../lib/logger'

function makeSupabase(opts: {
  orphanIds?: { data: string[] | null; error: unknown }
  updateResult?: { error: unknown }
  staleAssets?: { data: Array<{ id: string; blob_url: string }> | null; error: unknown }
  deleteResult?: { error: unknown }
} = {}) {
  const rpcMock = vi.fn().mockImplementation((name: string) => {
    if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null })
    if (name === 'cron_unlock') return Promise.resolve({ data: null, error: null })
    if (name === 'find_orphan_media_assets') {
      return Promise.resolve(opts.orphanIds ?? { data: [], error: null })
    }
    return Promise.resolve({ data: null, error: null })
  })

  const limitFn = vi.fn().mockResolvedValue(
    opts.staleAssets ?? { data: [], error: null },
  )
  const ltFn = vi.fn(() => ({ limit: limitFn }))
  const selectFn = vi.fn(() => ({ lt: ltFn }))
  const inFn = vi.fn().mockResolvedValue(opts.updateResult ?? { error: null })
  const updateFn = vi.fn(() => ({ in: inFn }))
  const eqFn = vi.fn().mockResolvedValue(opts.deleteResult ?? { error: null })
  const deleteFn = vi.fn(() => ({ eq: eqFn }))

  return {
    rpc: rpcMock,
    from: vi.fn(() => ({
      update: updateFn,
      select: selectFn,
      delete: deleteFn,
    })),
    _rpcMock: rpcMock,
    _updateFn: updateFn,
    _inFn: inFn,
    _limitFn: limitFn,
  }
}

function req(secret = CRON_SECRET) {
  return new Request('http://localhost/api/cron/media-cleanup', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  })
}

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET
  vi.clearAllMocks()
  setLogger({ warn: () => {}, error: () => {} })
})

afterEach(() => {
  vi.restoreAllMocks()
  resetLogger()
})

describe('POST /api/cron/media-cleanup', () => {
  it('401 without bearer', async () => {
    const res = await POST(new Request('http://localhost/api/cron/media-cleanup', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('401 with wrong secret', async () => {
    const res = await POST(req('wrong'))
    expect(res.status).toBe(401)
  })

  it('200 + counts on success with no orphans or stale', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.softDeleted).toBe(0)
    expect(body.hardDeleted).toBe(0)
  })

  it('200 + softDeleted count when orphans found', async () => {
    const supabase = makeSupabase({
      orphanIds: { data: ['id-1', 'id-2', 'id-3'], error: null },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.softDeleted).toBe(3)
  })

  it('200 + hardDeleted count when stale assets exist', async () => {
    const supabase = makeSupabase({
      staleAssets: {
        data: [
          { id: 'old-1', blob_url: 'https://blob.example.com/old-1' },
          { id: 'old-2', blob_url: 'https://blob.example.com/old-2' },
        ],
        error: null,
      },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.hardDeleted).toBe(2)
    expect(del).toHaveBeenCalledTimes(2)
  })

  it('500 when find_orphan_media_assets RPC fails', async () => {
    const supabase = makeSupabase({
      orphanIds: { data: null, error: { message: 'rpc boom' } },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('rpc boom')
  })
})
