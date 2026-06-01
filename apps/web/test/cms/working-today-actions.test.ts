import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  createServerClient: vi.fn().mockReturnValue({ auth: { getUser: () => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } } }) } }),
  requireSiteScope: vi.fn().mockResolvedValue({ ok: true, user: { id: 'user-1' } }),
}))

vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', timezone: 'America/Sao_Paulo' }),
}))

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/pipeline/auth', () => ({
  UUID_REGEX: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
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
import { revalidateTag } from 'next/cache'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'

describe('pinWorkingToday', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls pin_working_today RPC with user_id and item_id', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'pinned' }, error: null })
    const result = await pinWorkingToday(VALID_UUID)
    expect(result).toEqual({ ok: true, data: { status: 'pinned' } })
    expect(mockRpc).toHaveBeenCalledWith('pin_working_today', {
      p_user_id: 'user-1',
      p_item_id: VALID_UUID,
    })
  })

  it('returns ok:true when already pinned (idempotent)', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'already_pinned' }, error: null })
    const result = await pinWorkingToday(VALID_UUID)
    expect(result).toEqual({ ok: true, data: { status: 'already_pinned' } })
  })

  it('returns ok:false when cap reached', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'cap_reached', current: 3, max: 3 }, error: null })
    const result = await pinWorkingToday(VALID_UUID)
    expect(result).toEqual({ ok: false, error: 'Pin limit reached (3/3)' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('returns ok:false on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'permission_denied' } })
    const result = await pinWorkingToday(VALID_UUID)
    expect(result).toEqual({ ok: false, error: 'Falha ao fixar item' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('returns ok:false for invalid UUID', async () => {
    const result = await pinWorkingToday('not-a-uuid')
    expect(result).toEqual({ ok: false, error: 'Invalid item ID' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns ok:false when auth fails', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({ ok: false, reason: 'unauthenticated' } as never)
    const result = await pinWorkingToday(VALID_UUID)
    expect(result).toEqual({ ok: false, error: 'unauthorized' })
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

describe('unpinWorkingToday', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls unpin_working_today RPC with user_id and item_id', async () => {
    mockRpc.mockResolvedValue({ data: { status: 'unpinned' }, error: null })
    const result = await unpinWorkingToday(VALID_UUID)
    expect(result).toEqual({ ok: true })
    expect(mockRpc).toHaveBeenCalledWith('unpin_working_today', {
      p_user_id: 'user-1',
      p_item_id: VALID_UUID,
    })
  })

  it('returns ok:false on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not_found' } })
    const result = await unpinWorkingToday(VALID_UUID)
    expect(result).toEqual({ ok: false, error: 'Falha ao remover item' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('returns ok:false for invalid UUID', async () => {
    const result = await unpinWorkingToday('')
    expect(result).toEqual({ ok: false, error: 'Invalid item ID' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns ok:false when auth fails', async () => {
    vi.mocked(requireSiteScope).mockResolvedValueOnce({ ok: false, reason: 'forbidden' } as never)
    const result = await unpinWorkingToday(VALID_UUID)
    expect(result).toEqual({ ok: false, error: 'unauthorized' })
    expect(mockRpc).not.toHaveBeenCalled()
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
              pipeline_item_id: VALID_UUID,
              pinned_at: '2026-05-26T10:00:00Z',
              content_pipeline: {
                id: VALID_UUID,
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
      itemId: VALID_UUID,
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

  it('filters out rows with null content_pipeline', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            { pipeline_item_id: VALID_UUID, pinned_at: '2026-05-26T10:00:00Z', content_pipeline: null },
            {
              pipeline_item_id: '00000000-0000-0000-0000-000000000002',
              pinned_at: '2026-05-26T11:00:00Z',
              content_pipeline: {
                id: '00000000-0000-0000-0000-000000000002',
                title_pt: 'Valid item',
                stage: 'draft',
                format: 'article',
                priority: 2,
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
    expect(result[0]!.title).toBe('Valid item')
  })

  it('returns empty array on database error', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'db_error' } }),
      }),
    })
    mockFrom.mockReturnValue({ select: selectMock })
    const result = await getWorkingTodayPins()
    expect(result).toEqual([])
  })

  it('falls back to title_en when title_pt is empty', async () => {
    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [{
            pipeline_item_id: VALID_UUID,
            pinned_at: '2026-05-26T10:00:00Z',
            content_pipeline: {
              id: VALID_UUID,
              title_pt: '',
              title_en: 'English Title',
              stage: 'draft',
              format: 'video',
              priority: 1,
            },
          }],
          error: null,
        }),
      }),
    })
    mockFrom.mockReturnValue({ select: selectMock })
    const result = await getWorkingTodayPins()
    expect(result[0]!.title).toBe('English Title')
  })
})
