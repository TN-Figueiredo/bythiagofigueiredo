import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            range: () => ({
              data: [
                {
                  id: 'post-1', site_id: 's1', created_by: 'u1', type: 'text',
                  status: 'completed', content: { title: 'Test' },
                  idempotency_key: 'k1', created_at: '2026-01-01',
                  updated_at: '2026-01-01', user_timezone: 'America/Sao_Paulo',
                  social_deliveries: [
                    { id: 'd1', provider: 'instagram', status: 'published', platform_post_id: 'ig-123', format: null },
                  ],
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
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

describe('listFeedPostsWithDeliveries', () => {
  it('returns posts with deliveries', async () => {
    const { listFeedPostsWithDeliveries } = await import('@/lib/social/actions/posts')
    const result = await listFeedPostsWithDeliveries('s1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(1)
    expect(result.data[0].post.id).toBe('post-1')
    expect(result.data[0].deliveries).toHaveLength(1)
    expect(result.data[0].deliveries[0].provider).toBe('instagram')
  })
})
