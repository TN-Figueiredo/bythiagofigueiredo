import { describe, it, expect, vi, beforeEach } from 'vitest'

/* ------------------------------------------------------------------ */
/*  Configurable mock data via vi.hoisted                              */
/* ------------------------------------------------------------------ */

const ORIG_ID = '00000000-0000-0000-0000-000000000001'
const NEW_ID = '00000000-0000-0000-0000-000000000002'

const { mockSelectData, mockInsertData } = vi.hoisted(() => ({
  mockSelectData: {
    data: null as any,
    error: null as any,
  },
  mockInsertData: {
    data: { id: '00000000-0000-0000-0000-000000000002' } as any,
    error: null as any,
  },
}))

const { mockSiteId } = vi.hoisted(() => ({
  mockSiteId: { value: 's1' },
}))

const mockInsert = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockSelectData,
        }),
      }),
      insert: (row: unknown) => {
        mockInsert(row)
        return {
          select: () => ({
            single: () => mockInsertData,
          }),
        }
      },
    }),
  }),
}))

vi.mock('@tn-figueiredo/auth-nextjs/server', () => ({
  requireSiteScope: () => ({ ok: true, user: { id: 'u1' } }),
}))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: () => ({ siteId: mockSiteId.value }),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { duplicatePost, createAutoDraft } from '@/lib/social/actions/posts'

describe('duplicatePost', () => {
  beforeEach(() => {
    mockInsert.mockClear()
    mockSiteId.value = 's1'
    mockSelectData.data = {
      id: ORIG_ID, site_id: 's1', type: 'text', status: 'completed',
      content: { title: 'Original' }, template_id: null,
      user_timezone: 'America/Sao_Paulo',
    }
    mockSelectData.error = null
    mockInsertData.data = { id: NEW_ID }
    mockInsertData.error = null
  })

  it('duplicates a post as draft', async () => {
    const result = await duplicatePost(ORIG_ID)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe(NEW_ID)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('sets status draft, origin manual, and correct site_id on inserted row', async () => {
    await duplicatePost(ORIG_ID)
    expect(mockInsert).toHaveBeenCalled()
    const row = mockInsert.mock.calls[0][0]
    expect(row.status).toBe('draft')
    expect(row.origin).toBe('manual')
    expect(row.site_id).toBe('s1')
  })

  it('returns forbidden when post site_id does not match', async () => {
    mockSelectData.data = {
      id: ORIG_ID, site_id: 'other-site', type: 'text', status: 'completed',
      content: { title: 'Original' }, template_id: null,
      user_timezone: 'America/Sao_Paulo',
    }
    const result = await duplicatePost(ORIG_ID)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('forbidden')
  })

  it('returns Post not found when select returns null', async () => {
    mockSelectData.data = null
    mockSelectData.error = { message: 'not found' }
    const result = await duplicatePost(ORIG_ID)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('Post not found')
  })
})

describe('createAutoDraft', () => {
  beforeEach(() => {
    mockInsert.mockClear()
    mockSiteId.value = 's1'
    mockSelectData.data = null
    mockSelectData.error = null
    mockInsertData.data = { id: NEW_ID }
    mockInsertData.error = null
  })

  it('creates auto draft for content', async () => {
    const result = await createAutoDraft('content-1', ['youtube', 'instagram'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe(NEW_ID)
  })

  it('sets origin to auto on inserted row', async () => {
    await createAutoDraft('content-1', ['youtube'])
    expect(mockInsert).toHaveBeenCalled()
    const row = mockInsert.mock.calls[0][0]
    expect(row.origin).toBe('auto')
  })

  it('rejects empty platforms array', async () => {
    const result = await createAutoDraft('content-1', [])
    expect(result.ok).toBe(false)
  })
})
