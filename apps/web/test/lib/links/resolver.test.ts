import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMaybeSingle = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: mockFrom,
  }),
}))

import { resolveLink, _clearLinkCacheForTesting } from '../../../src/lib/links/resolver'

function setupChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: mockMaybeSingle.mockResolvedValue(result),
  }
  mockFrom.mockReturnValue(chain)
  return chain
}

describe('resolveLink', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _clearLinkCacheForTesting()
  })

  it('returns link data for valid site+code', async () => {
    const linkData = {
      id: 'link-1',
      site_id: 'site-1',
      code: 'abc1234',
      title: 'My Post',
      destination_url: 'https://example.com/blog/my-post',
      redirect_type: 307,
      active: true,
      deleted_at: null,
      password_hash: null,
      click_limit: null,
      total_clicks: 42,
      expires_at: null,
      utm_source: null,
      utm_medium: 'referral',
      utm_campaign: 'blog-my-post',
      utm_term: null,
      utm_content: null,
      utm_id: null,
      launched_at: '2026-05-20T10:00:00Z',
      activates_at: null,
      custom_params: {},
      pass_click_ids: true,
    }
    setupChain({ data: linkData, error: null })

    const result = await resolveLink('site-1', 'abc1234')

    expect(result).toEqual(linkData)
    expect(mockFrom).toHaveBeenCalledWith('tracked_links')
  })

  it('returns null when link not found', async () => {
    setupChain({ data: null, error: null })

    const result = await resolveLink('site-1', 'notfound')
    expect(result).toBeNull()
  })

  it('returns null on DB error', async () => {
    setupChain({ data: null, error: { message: 'db error' } })

    const result = await resolveLink('site-1', 'abc1234')
    expect(result).toBeNull()
  })

  it('queries with correct site_id and code filters', async () => {
    const chain = setupChain({ data: null, error: null })

    await resolveLink('site-99', 'XyZ7890')

    expect(chain.eq).toHaveBeenCalledWith('site_id', 'site-99')
    expect(chain.eq).toHaveBeenCalledWith('code', 'XyZ7890')
  })

  it('selects all required fields for redirect handling', async () => {
    const chain = setupChain({ data: null, error: null })

    await resolveLink('site-1', 'abc')

    const selectArg = chain.select.mock.calls[0][0] as string
    const requiredFields = [
      'id', 'site_id', 'code', 'destination_url', 'redirect_type',
      'active', 'deleted_at', 'password_hash', 'click_limit', 'total_clicks',
      'expires_at', 'utm_source', 'utm_medium', 'utm_campaign',
      'activates_at', 'custom_params', 'pass_click_ids',
    ]
    for (const field of requiredFields) {
      expect(selectArg).toContain(field)
    }
  })
})
