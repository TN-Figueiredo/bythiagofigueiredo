import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock supabase
// ---------------------------------------------------------------------------
const mockPostSelect = vi.fn()
const mockPipelineUpdate = vi.fn()

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'social_posts') {
        return {
          select: () => ({
            eq: () => ({
              single: mockPostSelect,
            }),
          }),
          update: mockPipelineUpdate,
        }
      }
      if (table === 'social_connections') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'conn-fb',
                      provider: 'facebook',
                      page_token_enc: 'enc-token',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }
      }
      return {}
    }),
  }),
}))

// Mock OG scraper
vi.mock('@/lib/social/og-scraper', () => ({
  scrapeOg: vi.fn(),
}))

// Mock pipeline helpers
vi.mock('@/lib/social/pipeline', () => ({
  updatePipelineStep: vi.fn(),
}))

// Mock publishSocialPost
vi.mock('@/lib/social/workflows', () => ({
  publishSocialPost: vi.fn(),
}))

// Mock @tn-figueiredo/social decrypt
vi.mock('@tn-figueiredo/social', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-page-token'),
  getMasterKey: vi.fn().mockReturnValue('master-key'),
}))

// Mock @sentry/nextjs
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

import { POST } from '@/app/api/social/pipeline/run/route'
import { scrapeOg } from '@/lib/social/og-scraper'
import { updatePipelineStep } from '@/lib/social/pipeline'
import { publishSocialPost } from '@/lib/social/workflows'

describe('POST /api/social/pipeline/run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')

    // Default: post found with short_link_id and pipeline_steps
    mockPostSelect.mockResolvedValue({
      data: {
        id: 'post-1',
        site_id: 'site-1',
        status: 'draft',
        type: 'link',
        content: { title: 'Test', url: 'https://example.com' },
        short_link_id: 'link-1',
        pipeline_steps: [
          { step: 'post_created', status: 'completed', at: '2026-01-01T00:00:00Z' },
          { step: 'short_link', status: 'completed', at: '2026-01-01T00:00:01Z' },
          { step: 'og_scrape', status: 'pending', at: '' },
          { step: 'deliver', status: 'pending', at: '' },
        ],
        created_by: 'user-1',
        scheduled_at: null,
        user_timezone: 'America/Sao_Paulo',
        published_at: null,
        template_id: null,
        idempotency_key: 'key-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    })

    // Pipeline update succeeds
    mockPipelineUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    // OG scrape succeeds
    vi.mocked(scrapeOg).mockResolvedValue({
      status: 'ok',
      tags: 7,
      latency_ms: 1200,
      http_status: 200,
    })

    // Pipeline step updates succeed
    vi.mocked(updatePipelineStep).mockResolvedValue(undefined)

    // publishSocialPost succeeds
    vi.mocked(publishSocialPost).mockResolvedValue(undefined)
  })

  it('returns 401 when Authorization header is missing', async () => {
    const req = new Request('http://localhost/api/social/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: 'post-1' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(publishSocialPost).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header has wrong secret', async () => {
    const req = new Request('http://localhost/api/social/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong-secret' },
      body: JSON.stringify({ postId: 'post-1' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('runs OG scrape and delivers post, updating pipeline steps', async () => {
    const req = new Request('http://localhost/api/social/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-cron-secret' },
      body: JSON.stringify({ postId: 'post-1' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)

    expect(scrapeOg).toHaveBeenCalled()

    expect(updatePipelineStep).toHaveBeenCalledWith(
      expect.anything(),
      'post-1',
      'og_scrape',
      'in_progress',
    )
    expect(updatePipelineStep).toHaveBeenCalledWith(
      expect.anything(),
      'post-1',
      'og_scrape',
      'completed',
      expect.objectContaining({ tags: 7 }),
    )
    expect(updatePipelineStep).toHaveBeenCalledWith(
      expect.anything(),
      'post-1',
      'deliver',
      'in_progress',
    )

    expect(publishSocialPost).toHaveBeenCalled()
  })

  it('continues to deliver even when OG scrape fails with warning', async () => {
    vi.mocked(scrapeOg).mockResolvedValue({
      status: 'timeout',
      error: 'Request timed out',
    })

    const req = new Request('http://localhost/api/social/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-cron-secret' },
      body: JSON.stringify({ postId: 'post-1' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    expect(updatePipelineStep).toHaveBeenCalledWith(
      expect.anything(),
      'post-1',
      'og_scrape',
      'warning',
      expect.objectContaining({ status: 'timeout' }),
    )

    expect(publishSocialPost).toHaveBeenCalled()
  })

  it('returns 400 when postId is missing', async () => {
    const req = new Request('http://localhost/api/social/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-cron-secret' },
      body: JSON.stringify({}),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 404 when post is not found', async () => {
    mockPostSelect.mockResolvedValue({ data: null, error: { message: 'not found' } })

    const req = new Request('http://localhost/api/social/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-cron-secret' },
      body: JSON.stringify({ postId: 'missing-post' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('updates deliver step as completed after publishSocialPost', async () => {
    const req = new Request('http://localhost/api/social/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-cron-secret' },
      body: JSON.stringify({ postId: 'post-1' }),
    })

    await POST(req)

    expect(updatePipelineStep).toHaveBeenCalledWith(
      expect.anything(),
      'post-1',
      'deliver',
      'completed',
    )
  })

  it('marks deliver step as failed when publishSocialPost throws', async () => {
    vi.mocked(publishSocialPost).mockRejectedValue(new Error('Provider connection refused'))

    const req = new Request('http://localhost/api/social/pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-cron-secret' },
      body: JSON.stringify({ postId: 'post-1' }),
    })

    const res = await POST(req)

    expect(updatePipelineStep).toHaveBeenCalledWith(
      expect.anything(),
      'post-1',
      'deliver',
      'failed',
      expect.objectContaining({ error: expect.stringContaining('Provider connection refused') }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; error?: string }
    expect(body.ok).toBe(false)
  })
})
