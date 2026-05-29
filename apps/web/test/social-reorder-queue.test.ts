import { describe, it, expect, vi } from 'vitest'

const POST_A = '00000000-0000-0000-0000-00000000000a'
const POST_B = '00000000-0000-0000-0000-00000000000b'
const POST_C = '00000000-0000-0000-0000-00000000000c'

const mockUpdate = vi.fn().mockReturnValue({ error: null })

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table !== 'social_posts') return {}
      return {
        select: () => ({
          eq: (col: string, val: string) => {
            if (col === 'id') {
              return {
                single: () => ({ data: { id: val, site_id: 's1', queue_position: 0 }, error: null }),
              }
            }
            return {
              in: () => ({
                not: () => ({
                  order: () => ({
                    data: [
                      { id: POST_A, queue_position: 0 },
                      { id: POST_B, queue_position: 1 },
                      { id: POST_C, queue_position: 2 },
                    ],
                    error: null,
                  }),
                }),
              }),
            }
          },
        }),
        update: (data: unknown) => ({
          eq: () => {
            mockUpdate(data)
            return { error: null }
          },
        }),
      }
    },
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

describe('reorderQueue', () => {
  it('reorders queue positions', async () => {
    const { reorderQueue } = await import('@/lib/social/actions/posts')
    const result = await reorderQueue(POST_A, 2)
    expect(result.ok).toBe(true)
  })
})
