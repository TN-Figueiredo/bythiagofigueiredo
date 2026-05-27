import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'user-1' } }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', timezone: 'America/Sao_Paulo' }),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

const mockRpc = vi.fn()
const mockFrom = vi.fn()
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

import { pinWorkingToday, unpinWorkingToday, getWorkingTodayPins } from
  '../../src/app/cms/(authed)/pipeline/working-today-actions'

describe('pinWorkingToday', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls pin_working_today RPC with item id', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'pinned' }, error: null })
    const result = await pinWorkingToday('item-1')
    expect(result).toEqual({ ok: true, data: { status: 'pinned' } })
    expect(mockRpc).toHaveBeenCalledWith('pin_working_today', { p_item_id: 'item-1', p_max: 3 })
  })

  it('returns ok:true when already pinned (idempotent)', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'already_pinned' }, error: null })
    const result = await pinWorkingToday('item-1')
    expect(result).toEqual({ ok: true, data: { status: 'already_pinned' } })
  })

  it('returns ok:false when cap reached', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'cap_reached', current: 3, max: 3 }, error: null })
    const result = await pinWorkingToday('item-1')
    expect(result).toEqual({ ok: false, error: 'Pin limit reached (3/3)' })
  })

  it('returns ok:false on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission_denied' } })
    const result = await pinWorkingToday('item-1')
    expect(result).toEqual({ ok: false, error: 'permission_denied' })
  })
})

describe('unpinWorkingToday', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls unpin_working_today RPC with item id', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'unpinned' }, error: null })
    const result = await unpinWorkingToday('item-1')
    expect(result).toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith('unpin_working_today', { p_item_id: 'item-1' })
  })

  it('returns ok:false on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not_found' } })
    const result = await unpinWorkingToday('item-1')
    expect(result).toEqual({ ok: false, error: 'not_found' })
  })
})

describe('getWorkingTodayPins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns pinned items joined with pipeline data', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              pipeline_item_id: 'item-1',
              pinned_at: '2026-05-26T10:00:00Z',
              content_pipeline: {
                id: 'item-1',
                title_pt: 'Video 1',
                stage: 'roteiro',
                format: 'video',
                priority: 4,
              },
            },
          ],
          error: null,
        }),
      }),
    })
    mockFrom.mockReturnValue({ select: selectMock })

    const result = await getWorkingTodayPins()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      itemId: 'item-1',
      title: 'Video 1',
      stage: 'roteiro',
      format: 'video',
    })
  })

  it('returns empty array when no pins', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    })
    mockFrom.mockReturnValue({ select: selectMock })

    const result = await getWorkingTodayPins()
    expect(result).toEqual([])
  })
})
