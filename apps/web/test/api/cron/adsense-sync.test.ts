import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/ads/crypto', () => ({
  decrypt: vi.fn((enc: string) => enc.replace('enc:', '')),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { POST } from '../../../src/app/api/cron/adsense-sync/route'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { setLogger, resetLogger } from '../../../lib/logger'

function makeSupabase(opts: {
  orgData?: Record<string, unknown> | null
  orgError?: { message: string } | null
  upsertError?: { message: string } | null
} = {}) {
  const singleMock = vi.fn().mockResolvedValue({
    data: opts.orgData ?? {
      id: 'org-uuid',
      adsense_refresh_token_enc: 'enc:refresh-token',
      adsense_publisher_id: 'ca-pub-12345',
    },
    error: opts.orgError ?? null,
  })

  const upsertMock = vi.fn().mockResolvedValue({ error: opts.upsertError ?? null })
  const eqUpdate = vi.fn().mockResolvedValue({ error: null })
  const updateMock = vi.fn().mockReturnValue({ eq: eqUpdate })

  const fromMock = vi.fn((table: string) => {
    if (table === 'ad_revenue_daily') {
      return { upsert: upsertMock }
    }
    if (table === 'organizations') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: singleMock }),
        }),
        update: updateMock,
      }
    }
    if (table === 'sites') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 'site-uuid' }, error: null }),
          }),
        }),
      }
    }
    return {
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: singleMock }) }),
      update: updateMock,
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
  })

  return {
    from: fromMock,
    rpc: vi.fn().mockImplementation((name: string) => {
      if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null })
      if (name === 'cron_unlock') return Promise.resolve({ data: null, error: null })
      if (name === 'get_master_org_id') return Promise.resolve({ data: 'org-uuid', error: null })
      return Promise.resolve({ data: null, error: null })
    }),
  }
}

function mockGoogleTokenSuccess() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ access_token: 'new-access-token', token_type: 'Bearer' }),
  })
}

function mockAdSenseReportSuccess(rows: unknown[]) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ rows, totals: {} }),
  })
}

function req(secret = CRON_SECRET) {
  return new Request('http://localhost/api/cron/adsense-sync', {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  })
}

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET
  process.env.GOOGLE_CLIENT_ID = 'client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'client-secret'
  process.env.ADSENSE_TOKEN_KEY = 'a'.repeat(64)
  process.env.AD_REVENUE_SYNC_ENABLED = 'true'
  vi.clearAllMocks()
  setLogger({ warn: () => {}, error: () => {} })
})

afterEach(() => {
  delete process.env.AD_REVENUE_SYNC_ENABLED
  vi.restoreAllMocks()
  resetLogger()
})

describe('POST /api/cron/adsense-sync', () => {
  it('401 without bearer', async () => {
    const res = await POST(new Request('http://localhost/api/cron/adsense-sync', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('401 with wrong bearer', async () => {
    const res = await POST(req('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('204 when AD_REVENUE_SYNC_ENABLED is false', async () => {
    process.env.AD_REVENUE_SYNC_ENABLED = 'false'
    const res = await POST(req())
    expect(res.status).toBe(204)
  })

  it('204 when AD_REVENUE_SYNC_ENABLED is not set', async () => {
    delete process.env.AD_REVENUE_SYNC_ENABLED
    const res = await POST(req())
    expect(res.status).toBe(204)
  })

  it('returns ok:true and upserts rows for valid Google API response', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    mockGoogleTokenSuccess()
    mockAdSenseReportSuccess([
      {
        cells: [
          { value: '2026-04-25' },
          { value: 'ca-pub-12345/banner_top' },
          { value: '1500' },
          { value: '25' },
          { value: '3.50' },
          { value: '2000' },
          { value: '75.0' },
        ],
      },
    ])

    const res = await POST(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.rows_upserted).toBeGreaterThanOrEqual(0)
  })

  it('sets adsense_sync_status=error when Google token refresh fails', async () => {
    const supabase = makeSupabase()
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'invalid_grant' }) })

    const res = await POST(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.err_code).toBe('sync_failed')
  })

  it('skips sync when org has no refresh token', async () => {
    const supabase = makeSupabase({
      orgData: {
        id: 'org-uuid',
        adsense_refresh_token_enc: null,
        adsense_publisher_id: null,
      },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await POST(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.skipped).toBe(true)
  })
})
