import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'

// Mock Supabase service client
const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockUpdate = vi.fn().mockResolvedValue({ error: null })
const mockSelect = vi.fn()
const mockUniquenessCheck = vi.fn()
const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null })

vi.mock('../../../lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => {
      if (table === 'link_clicks') {
        return {
          insert: mockInsert,
          select: (_col?: string, opts?: { count?: string; head?: boolean }) => {
            if (opts?.head) {
              return {
                eq: () => ({
                  eq: () => ({
                    limit: () => mockUniquenessCheck(),
                  }),
                }),
              }
            }
            return {
              eq: () => ({
                eq: () => ({
                  gte: () => ({
                    maybeSingle: mockSelect,
                  }),
                }),
              }),
            }
          },
        }
      }
      if (table === 'tracked_links') {
        return {
          update: () => ({
            eq: () => ({
              is: (col: string, val: unknown) => mockUpdate(col, val),
            }),
          }),
        }
      }
      return { insert: mockInsert }
    },
    rpc: mockRpc,
  }),
}))

describe('ClickRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockResolvedValue({ data: null, error: null })
    mockUniquenessCheck.mockResolvedValue({ count: 0 })
  })

  it('generates visitor_id as sha256(ip+ua+date)', async () => {
    const { generateVisitorId } = await import('../../../src/lib/links/click-recorder')
    const ip = '192.168.1.1'
    const ua = 'Mozilla/5.0'
    const date = '2026-05-05'
    const expected = createHash('sha256').update(`${ip}|${ua}|${date}`).digest('hex')
    expect(generateVisitorId(ip, ua, date)).toBe(expected)
  })

  it('extracts referrer domain from full URL', async () => {
    const { extractReferrerDomain } = await import('../../../src/lib/links/click-recorder')
    expect(extractReferrerDomain('https://twitter.com/user/status/123')).toBe('twitter.com')
    expect(extractReferrerDomain('')).toBeNull()
    expect(extractReferrerDomain(null)).toBeNull()
  })

  it('detects common bots from user agent', async () => {
    const { isBot } = await import('../../../src/lib/links/click-recorder')
    expect(isBot('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe(true)
    expect(isBot('Mozilla/5.0 (compatible; Bingbot/2.0)')).toBe(true)
    expect(isBot('Twitterbot/1.0')).toBe(true)
    expect(isBot('facebookexternalhit/1.1')).toBe(true)
    expect(isBot('LinkedInBot/1.0')).toBe(true)
    expect(isBot('Slackbot-LinkExpanding 1.0')).toBe(true)
    expect(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false)
  })

  it('skips recording when dedup window hit (same visitor within 30s)', async () => {
    mockSelect.mockResolvedValue({ data: { id: 'existing-click' }, error: null })
    const { recordClick } = await import('../../../src/lib/links/click-recorder')
    const result = await recordClick({
      linkId: 'link-1',
      siteId: 'site-1',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      referrer: null,
      headers: new Headers({}),
    })
    expect(result.deduplicated).toBe(true)
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('records click and updates counters when not deduplicated', async () => {
    mockSelect.mockResolvedValue({ data: null, error: null })
    const { recordClick } = await import('../../../src/lib/links/click-recorder')
    const result = await recordClick({
      linkId: 'link-1',
      siteId: 'site-1',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      referrer: 'https://google.com/search?q=test',
      headers: new Headers({}),
    })
    expect(result.deduplicated).toBe(false)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('sets device_type based on user agent', async () => {
    mockSelect.mockResolvedValue({ data: null, error: null })
    const { recordClick } = await import('../../../src/lib/links/click-recorder')
    await recordClick({
      linkId: 'link-1',
      siteId: 'site-1',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
      referrer: null,
      headers: new Headers({}),
    })
    const insertData = mockInsert.mock.calls[0][0]
    expect(insertData.device_type).toBe('mobile')
  })

  it('classifies referrer_source from referrer URL', async () => {
    mockSelect.mockResolvedValue({ data: null, error: null })
    const { recordClick } = await import('../../../src/lib/links/click-recorder')
    await recordClick({
      linkId: 'link-1',
      siteId: 'site-1',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      referrer: 'https://www.youtube.com/watch?v=abc',
      headers: new Headers({}),
    })
    const insertData = mockInsert.mock.calls[0][0]
    expect(insertData.referrer_source).toBe('youtube')
  })

  it('sets referrer_source to direct when referrer is null', async () => {
    mockSelect.mockResolvedValue({ data: null, error: null })
    const { recordClick } = await import('../../../src/lib/links/click-recorder')
    await recordClick({
      linkId: 'link-1',
      siteId: 'site-1',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      referrer: null,
      headers: new Headers({}),
    })
    const insertData = mockInsert.mock.calls[0][0]
    expect(insertData.referrer_source).toBe('direct')
  })

  it('sets is_unique false when visitor has prior clicks', async () => {
    mockSelect.mockResolvedValue({ data: null, error: null })
    mockUniquenessCheck.mockResolvedValue({ count: 3 })
    const { recordClick } = await import('../../../src/lib/links/click-recorder')
    await recordClick({
      linkId: 'link-1',
      siteId: 'site-1',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      referrer: null,
      headers: new Headers({}),
    })
    const insertData = mockInsert.mock.calls[0][0]
    expect(insertData.is_unique).toBe(false)
    expect(mockRpc).toHaveBeenCalledWith('increment_link_clicks', {
      p_link_id: 'link-1',
      p_is_unique: false,
    })
  })

  it('sets is_unique true when visitor has no prior clicks', async () => {
    mockSelect.mockResolvedValue({ data: null, error: null })
    mockUniquenessCheck.mockResolvedValue({ count: 0 })
    const { recordClick } = await import('../../../src/lib/links/click-recorder')
    await recordClick({
      linkId: 'link-1',
      siteId: 'site-1',
      ip: '1.2.3.4',
      userAgent: 'Mozilla/5.0',
      referrer: null,
      headers: new Headers({}),
    })
    const insertData = mockInsert.mock.calls[0][0]
    expect(insertData.is_unique).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('increment_link_clicks', {
      p_link_id: 'link-1',
      p_is_unique: true,
    })
  })
})
