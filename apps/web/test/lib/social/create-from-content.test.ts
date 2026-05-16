// apps/web/test/lib/social/create-from-content.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SocialConfig, ContentMetadata } from '@/lib/social/types'

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
const mockPostInsert = vi.fn()
const mockPostUpdate = vi.fn()
const mockPostSelect = vi.fn()
const mockDeliveryInsert = vi.fn()
const mockLinkInsert = vi.fn()
const mockTrackedLinkLookup = vi.fn()
const mockConnectionSelect = vi.fn()
const mockMaybeSingle = vi.fn()

function buildSupabaseMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'social_posts') {
        return {
          insert: mockPostInsert,
          update: mockPostUpdate,
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  in: () => ({
                    maybeSingle: mockMaybeSingle,
                  }),
                }),
              }),
              single: mockPostSelect,
            }),
          }),
        }
      }
      if (table === 'social_deliveries') {
        return { insert: mockDeliveryInsert }
      }
      if (table === 'tracked_links') {
        return {
          insert: mockLinkInsert,
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: mockTrackedLinkLookup,
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'social_connections') {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                in: (...args: unknown[]) => mockConnectionSelect(...args),
              }),
            }),
          }),
        }
      }
      return {}
    }),
  }
}

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/social/content-metadata', () => ({
  extractContentMetadata: vi.fn(),
}))

vi.mock('@/lib/social/pipeline', () => ({
  createInitialPipelineSteps: vi.fn().mockReturnValue([
    { step: 'post_created', status: 'completed', at: '2026-01-01T00:00:00Z' },
    { step: 'short_link', status: 'completed', at: '2026-01-01T00:00:01Z' },
    { step: 'og_scrape', status: 'pending', at: '' },
    { step: 'deliver', status: 'pending', at: '' },
  ]),
}))

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

// Mock auto-link module
const mockEnsureTrackedLink = vi.fn()
vi.mock('@/lib/links/auto-link', () => ({
  ensureTrackedLink: (...args: unknown[]) => mockEnsureTrackedLink(...args),
  generateShortCode: vi.fn().mockReturnValue('AbCdEfG'),
}))

// Mock fetch for fire-and-forget pipeline trigger
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true })

const defaultConfig: SocialConfig = {
  enabled: true,
  platforms: ['facebook', 'bluesky'],
  captions: {
    facebook: { pt: 'Post no FB' },
    bluesky: { pt: 'Post no BS' },
  },
  hashtags: ['#AI'],
  image_source: 'og_image',
  ig_template: 'card',
  formats: { facebook: 'link_share', bluesky: 'link_card' },
}

const defaultMetadata: ContentMetadata = {
  title: 'AI Empire',
  url: 'https://bythiagofigueiredo.com/pt/blog/ai-empire',
  image: 'https://cdn.example.com/cover.jpg',
  excerpt: 'O futuro da IA',
  tags: ['AI'],
  locale: 'pt',
}

describe('createSocialPostFromContent', () => {
  beforeEach(async () => {
    vi.clearAllMocks()

    const { extractContentMetadata } = await import(
      '@/lib/social/content-metadata'
    )
    vi.mocked(extractContentMetadata).mockResolvedValue(defaultMetadata)

    // No existing post (fresh create)
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })

    // ensureTrackedLink succeeds (used for all content types)
    mockEnsureTrackedLink.mockResolvedValue({ linkId: 'link-1', code: 'ai-empire', isNew: true })

    // Post insert succeeds
    mockPostInsert.mockReturnValue({
      select: () => ({
        single: vi.fn().mockResolvedValue({
          data: { id: 'post-1' },
          error: null,
        }),
      }),
    })

    // Post update succeeds (for re-publish case)
    mockPostUpdate.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })

    // Delivery insert succeeds
    mockDeliveryInsert.mockResolvedValue({ error: null })

    // Connections found
    mockConnectionSelect.mockResolvedValue({
      data: [
        { id: 'conn-fb', provider: 'facebook' },
        { id: 'conn-bs', provider: 'bluesky' },
      ],
      error: null,
    })

    process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'
    process.env.LINKS_SHORT_DOMAIN = 'go.bythiagofigueiredo.com'
  })

  it('creates a social post with correct fields and returns postId + shortLinkId', async () => {
    const { createSocialPostFromContent } = await import(
      '@/lib/social/create-from-content'
    )

    const result = await createSocialPostFromContent({
      supabase: buildSupabaseMock() as never,
      siteId: 'site-1',
      contentType: 'blog',
      contentId: 'bp-1',
      config: defaultConfig,
      origin: 'auto',
      userId: 'user-1',
    })

    expect(result.postId).toBe('post-1')
    expect(result.shortLinkId).toBe('link-1')
    expect(mockEnsureTrackedLink).toHaveBeenCalled()
    expect(mockPostInsert).toHaveBeenCalled()
  })

  it('creates one delivery per platform in config.platforms', async () => {
    const { createSocialPostFromContent } = await import(
      '@/lib/social/create-from-content'
    )

    await createSocialPostFromContent({
      supabase: buildSupabaseMock() as never,
      siteId: 'site-1',
      contentType: 'blog',
      contentId: 'bp-1',
      config: defaultConfig,
      origin: 'auto',
      userId: 'user-1',
    })

    expect(mockDeliveryInsert).toHaveBeenCalledTimes(1)
    const deliveryRows = mockDeliveryInsert.mock.calls[0]![0] as Array<{
      provider: string
      format: string
    }>
    expect(deliveryRows).toHaveLength(2)
    expect(deliveryRows[0]!.provider).toBe('facebook')
    expect(deliveryRows[0]!.format).toBe('link_share')
    expect(deliveryRows[1]!.provider).toBe('bluesky')
    expect(deliveryRows[1]!.format).toBe('link_card')
  })

  it('updates existing draft instead of creating new post (re-publish guard)', async () => {
    // Existing draft found
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'existing-draft', status: 'draft' },
      error: null,
    })

    const { createSocialPostFromContent } = await import(
      '@/lib/social/create-from-content'
    )

    const result = await createSocialPostFromContent({
      supabase: buildSupabaseMock() as never,
      siteId: 'site-1',
      contentType: 'blog',
      contentId: 'bp-1',
      config: defaultConfig,
      origin: 'auto',
      userId: 'user-1',
    })

    expect(result.postId).toBe('existing-draft')
    expect(mockPostUpdate).toHaveBeenCalled()
    expect(mockPostInsert).not.toHaveBeenCalled()
  })

  it('throws when existing post is in publishing status', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'active-post', status: 'publishing' },
      error: null,
    })

    const { createSocialPostFromContent } = await import(
      '@/lib/social/create-from-content'
    )

    await expect(
      createSocialPostFromContent({
        supabase: buildSupabaseMock() as never,
        siteId: 'site-1',
        contentType: 'blog',
        contentId: 'bp-1',
        config: defaultConfig,
        origin: 'auto',
        userId: 'user-1',
      }),
    ).rejects.toThrow('Pipeline em execucao')
  })

  it('fires pipeline trigger for immediate posts (no scheduledAt)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = mockFetch

    const { createSocialPostFromContent } = await import(
      '@/lib/social/create-from-content'
    )

    await createSocialPostFromContent({
      supabase: buildSupabaseMock() as never,
      siteId: 'site-1',
      contentType: 'blog',
      contentId: 'bp-1',
      config: defaultConfig,
      origin: 'auto',
      userId: 'user-1',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/social/pipeline/run'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('sets status to scheduled when scheduledAt is provided', async () => {
    const { createSocialPostFromContent } = await import(
      '@/lib/social/create-from-content'
    )

    await createSocialPostFromContent({
      supabase: buildSupabaseMock() as never,
      siteId: 'site-1',
      contentType: 'blog',
      contentId: 'bp-1',
      config: defaultConfig,
      origin: 'auto',
      scheduledAt: '2026-05-20T15:00:00Z',
      userId: 'user-1',
    })

    const insertCall = mockPostInsert.mock.calls[0]![0] as Record<string, unknown>
    expect(insertCall.status).toBe('scheduled')
    expect(insertCall.scheduled_at).toBe('2026-05-20T15:00:00Z')
  })

  it('does not create deliveries when connections array is empty', async () => {
    mockConnectionSelect.mockResolvedValue({ data: [], error: null })

    const { createSocialPostFromContent } = await import(
      '@/lib/social/create-from-content'
    )

    await createSocialPostFromContent({
      supabase: buildSupabaseMock() as never,
      siteId: 'site-1',
      contentType: 'blog',
      contentId: 'bp-1',
      config: defaultConfig,
      origin: 'auto',
      userId: 'user-1',
    })

    expect(mockDeliveryInsert).not.toHaveBeenCalled()
  })

  it('continues with null shortLinkId when ensureTrackedLink fails', async () => {
    mockEnsureTrackedLink.mockResolvedValue(null)

    const { createSocialPostFromContent } = await import(
      '@/lib/social/create-from-content'
    )

    const result = await createSocialPostFromContent({
      supabase: buildSupabaseMock() as never,
      siteId: 'site-1',
      contentType: 'blog',
      contentId: 'bp-1',
      config: defaultConfig,
      origin: 'auto',
      userId: 'user-1',
    })

    expect(result.postId).toBe('post-1')
    expect(result.shortLinkId).toBeNull()
    expect(mockPostInsert).toHaveBeenCalled()
  })

  it('handles unique constraint violation on post insert gracefully', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockPostInsert.mockReturnValue({
      select: () => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'duplicate key value violates unique constraint "social_posts_idempotency_key_key"' },
        }),
      }),
    })

    const { createSocialPostFromContent } = await import(
      '@/lib/social/create-from-content'
    )

    await expect(
      createSocialPostFromContent({
        supabase: buildSupabaseMock() as never,
        siteId: 'site-1',
        contentType: 'blog',
        contentId: 'bp-1',
        config: defaultConfig,
        origin: 'auto',
        userId: 'user-1',
      }),
    ).rejects.toThrow('Failed to create social post')
  })
})
