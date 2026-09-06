import { describe, it, expect, vi, beforeEach } from 'vitest'

// Real columns of `tracked_links` per supabase/migrations/20260529000002_links_redesign_views.sql
// and prod schema (confirmed via `npx supabase db query --linked` against
// information_schema.columns). Keep in sync if the table is altered.
const TRACKED_LINKS_COLUMNS = [
  'id',
  'site_id',
  'code',
  'slug',
  'destination_url',
  'title',
  'tags',
  'source_type',
  'source_id',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'has_qr',
  'qr_storage_path',
  'qr_config',
  'redirect_type',
  'expired_url',
  'click_limit',
  'password_hash',
  'active',
  'is_internal',
  'expires_at',
  'deleted_at',
  'total_clicks',
  'unique_visitors',
  'last_clicked_at',
  'created_by',
  'created_at',
  'updated_at',
  'qr_card_composition',
  'custom_params',
  'launched_at',
  'activates_at',
  'utm_id',
  'health_status',
  'health_checked_at',
  'pass_click_ids',
  '_utm_backup',
]

function assertKnownColumns(names: string[]): void {
  for (const name of names) {
    if (!TRACKED_LINKS_COLUMNS.includes(name)) {
      throw new Error(
        `tracked_links has no column "${name}" — check the migration before querying it`,
      )
    }
  }
}

/** Splits a Supabase `.select('a, b, c')` string into individual column names. */
function parseSelectColumns(selectArg: string): string[] {
  return selectArg.split(',').map((c) => c.trim())
}

const mockRpc = vi.fn()
const mockUpdate = vi.fn()
const mockIn = vi.fn()
const mockSelectResult = { data: [] as unknown[], error: null as unknown }

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'tracked_links') {
        return {
          update: (payload: Record<string, unknown>) => {
            assertKnownColumns(Object.keys(payload))
            mockUpdate(payload)
            return {
              in: mockIn,
            }
          },
          select: (selectArg: string) => {
            assertKnownColumns(parseSelectColumns(selectArg))
            return {
              eq: (column: string) => {
                assertKnownColumns([column])
                return {
                  lt: (column2: string) => {
                    assertKnownColumns([column2])
                    return {
                      not: (column3: string) => {
                        assertKnownColumns([column3])
                        return Promise.resolve(mockSelectResult)
                      },
                    }
                  },
                }
              },
            }
          },
        }
      }
      return {}
    },
    rpc: mockRpc,
  }),
}))

vi.mock('@/lib/links/cache', () => ({
  invalidateLink: vi.fn(),
  invalidateList: vi.fn(),
  invalidateAnalytics: vi.fn(),
}))

vi.stubEnv('CRON_SECRET', 'test-secret')

describe('GET /api/cron/links-check-expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockRpc.mockResolvedValue({ data: true, error: null })
    mockSelectResult.data = []
    mockSelectResult.error = null
    mockIn.mockResolvedValue({ error: null })
  })

  it('returns 401 without valid CRON_SECRET', async () => {
    const { GET } = await import('../../../src/app/api/cron/links-check-expiry/route')
    const req = new Request('http://localhost/api/cron/links-check-expiry', {
      headers: { authorization: 'Bearer wrong' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 200 and reports expired count', async () => {
    const { GET } = await import('../../../src/app/api/cron/links-check-expiry/route')
    const req = new Request('http://localhost/api/cron/links-check-expiry', {
      headers: { authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('expired')
  })

  it('deactivates links past expires_at using real column names', async () => {
    mockSelectResult.data = [
      { id: 'l1', site_id: 's1', code: 'abc' },
      { id: 'l2', site_id: 's1', code: 'def' },
    ]
    const { GET } = await import('../../../src/app/api/cron/links-check-expiry/route')
    const req = new Request('http://localhost/api/cron/links-check-expiry', {
      headers: { authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith({ active: false })
  })

  it('acquires cron lock', async () => {
    const { GET } = await import('../../../src/app/api/cron/links-check-expiry/route')
    const req = new Request('http://localhost/api/cron/links-check-expiry', {
      headers: { authorization: 'Bearer test-secret' },
    })
    await GET(req)
    expect(mockRpc).toHaveBeenCalledWith('cron_try_lock', {
      p_job: 'cron:links-check-expiry',
    })
  })
})
