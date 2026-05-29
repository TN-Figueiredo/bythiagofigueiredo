import { describe, it, expect, vi } from 'vitest'

const mockInsert = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => ({
            data: {
              id: 'orig-1', site_id: 's1', type: 'text', status: 'completed',
              content: { title: 'Original' }, template_id: null,
              user_timezone: 'America/Sao_Paulo',
            },
            error: null,
          }),
        }),
      }),
      insert: (row: unknown) => {
        mockInsert(row)
        return {
          select: () => ({
            single: () => ({ data: { id: 'new-1' }, error: null }),
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
  getSiteContext: () => ({ siteId: 's1' }),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

describe('duplicatePost', () => {
  it('duplicates a post as draft', async () => {
    const { duplicatePost } = await import('@/lib/social/actions/posts')
    const result = await duplicatePost('orig-1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe('new-1')
    expect(mockInsert).toHaveBeenCalled()
    const row = mockInsert.mock.calls[0][0]
    expect(row.status).toBe('draft')
    expect(row.origin).toBe('manual')
  })
})

describe('createAutoDraft', () => {
  it('creates auto draft for content', async () => {
    mockInsert.mockClear()
    const { createAutoDraft } = await import('@/lib/social/actions/posts')
    const result = await createAutoDraft('content-1', ['youtube', 'instagram'])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.id).toBe('new-1')
  })
})
