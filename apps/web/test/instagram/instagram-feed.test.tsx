import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/instagram/queries', () => ({ getInstagramFeedData: vi.fn() }))
vi.mock('@/lib/cms/site-context', () => ({
  getSiteContext: vi.fn().mockResolvedValue({ siteId: 'site-1', defaultLocale: 'pt-BR' }),
}))

import { getInstagramFeedData } from '@/lib/instagram/queries'
const mockGetData = vi.mocked(getInstagramFeedData)

describe('InstagramFeed', () => {
  it('returns null when no account configured', async () => {
    mockGetData.mockResolvedValueOnce({ account: null, slots: [] })
    const { InstagramFeed } = await import('@/components/instagram/instagram-feed')
    const result = await InstagramFeed({})
    expect(result).toBeNull()
  })

  it('returns null when no posts available', async () => {
    mockGetData.mockResolvedValueOnce({
      account: { id: 'acc-1', site_id: 'site-1', locale: 'pt', handle: '@test', ig_user_id: null, sync_enabled: true, display_slots: 6, layout_type: 'grid', last_synced_at: null, token_expires_at: null, created_at: '', updated_at: '' },
      slots: [],
    })
    const { InstagramFeed } = await import('@/components/instagram/instagram-feed')
    const result = await InstagramFeed({})
    expect(result).toBeNull()
  })

  it('returns null on error instead of crashing', async () => {
    mockGetData.mockRejectedValueOnce(new Error('DB connection failed'))
    const { InstagramFeed } = await import('@/components/instagram/instagram-feed')
    const result = await InstagramFeed({})
    expect(result).toBeNull()
  })
})
