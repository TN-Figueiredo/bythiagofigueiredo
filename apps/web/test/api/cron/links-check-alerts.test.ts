import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CRON_SECRET = 'test-secret'
process.env.CRON_SECRET = CRON_SECRET

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { GET } from '../../../src/app/api/cron/links-check-alerts/route'
import { getSupabaseServiceClient } from '../../../lib/supabase/service'
import { setLogger, resetLogger } from '../../../lib/logger'

type Alert = {
  id: string
  link_id: string
  site_id: string
  alert_type: string
  metric: string
  condition: { operator?: string; threshold?: number; window_days?: number }
  last_triggered_at: string | null
}

function makeSupabase(opts: {
  alertsResult?: { data: Alert[] | null; error: unknown }
  metricsResult?: { data: Array<Record<string, number>> | null; error: unknown }
  updateResult?: { error: unknown }
} = {}) {
  const rpcMock = vi.fn().mockImplementation((name: string) => {
    if (name === 'cron_try_lock') return Promise.resolve({ data: true, error: null })
    if (name === 'cron_unlock') return Promise.resolve({ data: null, error: null })
    return Promise.resolve({ data: null, error: null })
  })

  // Chain builders for .from('link_alerts').select(...).eq(...)
  const updateEqFn = vi.fn().mockResolvedValue(opts.updateResult ?? { error: null })
  const updateFn = vi.fn(() => ({ eq: updateEqFn }))

  // Chain for .from('link_daily_metrics').select(...).eq(...).gte(...).lte(...)
  const lteFn = vi.fn().mockResolvedValue(
    opts.metricsResult ?? { data: [{ clicks: 100 }], error: null },
  )
  const gteFn = vi.fn(() => ({ lte: lteFn }))
  const metricsEqFn = vi.fn(() => ({ gte: gteFn }))
  const metricsSelectFn = vi.fn(() => ({ eq: metricsEqFn }))

  // Chain for .from('link_alerts').select(...).eq('active', true)
  const alertsEqFn = vi.fn().mockResolvedValue(
    opts.alertsResult ?? { data: [], error: null },
  )
  const alertsSelectFn = vi.fn(() => ({ eq: alertsEqFn }))

  return {
    rpc: rpcMock,
    from: vi.fn((table: string) => {
      if (table === 'link_alerts') {
        return {
          select: alertsSelectFn,
          update: updateFn,
        }
      }
      if (table === 'link_daily_metrics') {
        return { select: metricsSelectFn }
      }
      return {}
    }),
    _rpcMock: rpcMock,
    _updateFn: updateFn,
    _updateEqFn: updateEqFn,
  }
}

function req(secret = CRON_SECRET) {
  return new Request('http://localhost/api/cron/links-check-alerts', {
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

describe('GET /api/cron/links-check-alerts', () => {
  it('401 without bearer', async () => {
    const res = await GET(new Request('http://localhost/api/cron/links-check-alerts'))
    expect(res.status).toBe(401)
  })

  it('401 with wrong secret', async () => {
    const res = await GET(req('wrong'))
    expect(res.status).toBe(401)
  })

  it('200 + checked=0 when no active alerts', async () => {
    const supabase = makeSupabase({
      alertsResult: { data: [], error: null },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checked).toBe(0)
    expect(body.triggered).toBe(0)
  })

  it('200 + triggered count when alert condition met', async () => {
    const supabase = makeSupabase({
      alertsResult: {
        data: [
          {
            id: 'alert-1',
            link_id: 'link-1',
            site_id: 'site-1',
            alert_type: 'threshold',
            metric: 'clicks',
            condition: { operator: 'gt', threshold: 50, window_days: 1 },
            last_triggered_at: null,
          },
        ],
        error: null,
      },
      metricsResult: { data: [{ clicks: 100 }], error: null },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checked).toBe(1)
    expect(body.triggered).toBe(1)
  })

  it('does not trigger when condition not met', async () => {
    const supabase = makeSupabase({
      alertsResult: {
        data: [
          {
            id: 'alert-1',
            link_id: 'link-1',
            site_id: 'site-1',
            alert_type: 'threshold',
            metric: 'clicks',
            condition: { operator: 'gt', threshold: 200, window_days: 1 },
            last_triggered_at: null,
          },
        ],
        error: null,
      },
      metricsResult: { data: [{ clicks: 50 }], error: null },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.checked).toBe(1)
    expect(body.triggered).toBe(0)
  })

  it('500 when alerts query fails', async () => {
    const supabase = makeSupabase({
      alertsResult: { data: null, error: { message: 'db error' } },
    })
    vi.mocked(getSupabaseServiceClient).mockReturnValue(supabase as never)

    const res = await GET(req())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('db error')
  })
})
