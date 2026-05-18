import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockScrapeOg = vi.fn()

vi.mock('@/lib/social/og-scraper', () => ({
  scrapeOg: (...args: unknown[]) => mockScrapeOg(...args),
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({}),
}))

import type { Provider } from '@tn-figueiredo/social'

describe('platformPrepare', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockScrapeOg.mockResolvedValue({ status: 'ok', tags: 5 })
  })

  it('calls scrapeOg for facebook with the page token', async () => {
    const { platformPrepare } = await import('@/lib/social/platform-prepare')
    const result = await platformPrepare('facebook', 'https://example.com/post', 'fake-page-token')
    expect(mockScrapeOg).toHaveBeenCalledWith('https://example.com/post', 'fake-page-token')
    expect(result).toEqual({ status: 'ok', tags: 5 })
  })

  it('returns noop for bluesky (OG done at publish time)', async () => {
    const { platformPrepare } = await import('@/lib/social/platform-prepare')
    const result = await platformPrepare('bluesky', 'https://example.com/post')
    expect(mockScrapeOg).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'noop', reason: 'bluesky prepares OG inline at publish time' })
  })

  it('returns noop for instagram', async () => {
    const { platformPrepare } = await import('@/lib/social/platform-prepare')
    const result = await platformPrepare('instagram', 'https://example.com/post')
    expect(mockScrapeOg).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'noop', reason: 'instagram does not use OG link cards' })
  })

  it('returns noop for youtube', async () => {
    const { platformPrepare } = await import('@/lib/social/platform-prepare')
    const result = await platformPrepare('youtube', 'https://example.com/post')
    expect(mockScrapeOg).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'noop', reason: 'youtube community posts do not use OG cards' })
  })

  it('returns error result when facebook scrape fails', async () => {
    mockScrapeOg.mockResolvedValue({ status: 'error', error: 'timeout' })
    const { platformPrepare } = await import('@/lib/social/platform-prepare')
    const result = await platformPrepare('facebook', 'https://example.com/post', 'fake-token')
    expect(result).toEqual({ status: 'error', error: 'timeout' })
  })

  it('returns noop when facebook has no page token', async () => {
    const { platformPrepare } = await import('@/lib/social/platform-prepare')
    const result = await platformPrepare('facebook', 'https://example.com/post')
    expect(mockScrapeOg).not.toHaveBeenCalled()
    expect(result).toEqual({ status: 'noop', reason: 'no page token available for Facebook OG warm' })
  })
})
