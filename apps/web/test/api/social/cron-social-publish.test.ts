import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
})
const mockSelect = vi.fn()
const mockInsert = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    rpc: vi.fn().mockResolvedValue({ data: null, error: { code: '42883', message: 'function not found' } }),
    from: (table: string) => {
      if (table === 'social_posts') {
        const chainTerminal = {
          order: () => ({
            limit: mockSelect,
          }),
        }
        return {
          select: () => ({
            eq: () => ({
              lte: () => chainTerminal,
              lt: () => chainTerminal,
            }),
          }),
          update: mockUpdate,
        }
      }
      if (table === 'cron_runs') {
        return { insert: mockInsert }
      }
      if (table === 'social_connections') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                is: () => ({
                  limit: () => ({
                    single: vi.fn().mockResolvedValue({
                      data: { page_token_enc: 'enc-token' },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      return { select: mockSelect, update: mockUpdate, insert: mockInsert }
    },
  }),
}))

const mockPublishSocialPost = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/social/workflows', () => ({
  publishSocialPost: mockPublishSocialPost,
}))

const mockScrapeOg = vi.fn().mockResolvedValue({
  status: 'ok',
  tags: 7,
  latency_ms: 800,
  http_status: 200,
})
vi.mock('@/lib/social/og-scraper', () => ({
  scrapeOg: mockScrapeOg,
}))

const mockUpdatePipelineStep = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/social/pipeline', () => ({
  updatePipelineStep: mockUpdatePipelineStep,
  createInitialPipelineSteps: vi.fn(),
  getPipelineDuration: vi.fn(),
  isPipelineComplete: vi.fn(),
}))

vi.mock('@tn-figueiredo/social', () => ({}))

vi.mock('@tn-figueiredo/social/vault', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-token'),
  getMasterKey: vi.fn().mockReturnValue('master-key'),
}))

vi.mock('@/lib/logger', () => ({
  withCronLock: vi.fn(async (_sb: unknown, _key: string, _runId: string, _job: string, fn: () => Promise<unknown>) => {
    const result = await fn()
    return Response.json(result)
  }),
  newRunId: () => 'run-1',
}))

describe('social-publish cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'test-secret')
  })

  it('runs OG scrape for posts within 5 min of scheduled_at before delivery', async () => {
    const fiveMinFromNow = new Date(Date.now() + 3 * 60 * 1000).toISOString()
    const postNeedingScrape = {
      id: 'post-1',
      status: 'scheduled',
      scheduled_at: fiveMinFromNow,
      pipeline_steps: [
        { step: 'post_created', status: 'completed' },
        { step: 'short_link', status: 'completed' },
        { step: 'platform_prepare', status: 'pending' },
        { step: 'deliver', status: 'pending' },
      ],
      short_link_id: 'link-1',
      site_id: 'site-1',
      content: { url: 'https://example.com/post' },
    }

    mockSelect.mockResolvedValue({ data: [postNeedingScrape], error: null })

    const { POST } = await import('@/app/api/cron/social-publish/route')
    const req = new Request('http://localhost/api/cron/social-publish', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    })

    await POST(req as any)

    expect(mockScrapeOg).toHaveBeenCalled()
    expect(mockUpdatePipelineStep).toHaveBeenCalledWith(
      expect.anything(),
      'post-1',
      'platform_prepare',
      'in_progress',
    )
  })

  it('runs delivery for posts at or past scheduled_at', async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString()
    const postReadyToDeliver = {
      id: 'post-2',
      status: 'scheduled',
      scheduled_at: pastTime,
      pipeline_steps: [
        { step: 'post_created', status: 'completed' },
        { step: 'short_link', status: 'completed' },
        { step: 'platform_prepare', status: 'completed' },
        { step: 'deliver', status: 'pending' },
      ],
      site_id: 'site-1',
      content: {},
    }

    mockSelect.mockResolvedValue({ data: [postReadyToDeliver], error: null })

    const { POST } = await import('@/app/api/cron/social-publish/route')
    const req = new Request('http://localhost/api/cron/social-publish', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    })

    await POST(req as any)

    expect(mockPublishSocialPost).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'post-2' }),
    )
  })

  it('skips OG scrape when already completed', async () => {
    const soonTime = new Date(Date.now() + 2 * 60 * 1000).toISOString()
    const postAlreadyScraped = {
      id: 'post-3',
      status: 'scheduled',
      scheduled_at: soonTime,
      pipeline_steps: [
        { step: 'post_created', status: 'completed' },
        { step: 'short_link', status: 'completed' },
        { step: 'platform_prepare', status: 'completed' },
        { step: 'deliver', status: 'pending' },
      ],
      site_id: 'site-1',
      content: {},
    }

    mockSelect.mockResolvedValue({ data: [postAlreadyScraped], error: null })

    const { POST } = await import('@/app/api/cron/social-publish/route')
    const req = new Request('http://localhost/api/cron/social-publish', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret' },
    })

    await POST(req as any)

    expect(mockScrapeOg).not.toHaveBeenCalled()
  })

  it('returns 401 for missing auth', async () => {
    const { POST } = await import('@/app/api/cron/social-publish/route')
    const req = new Request('http://localhost/api/cron/social-publish', {
      method: 'POST',
      headers: {},
    })

    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })
})
