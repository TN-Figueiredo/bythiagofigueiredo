import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { graduateToSocialPost } from '@/lib/pipeline/graduation'
import type { PipelineItem } from '@/lib/pipeline/graduation'
import type { SocialConfig } from '@/lib/social/types'

// ---------------------------------------------------------------------------
// Mocks — dynamic imports used by graduateToSocialPost
// ---------------------------------------------------------------------------

const mockCreateSocialPostFromContent = vi.fn()
const mockGetNextQueueSlot = vi.fn()
const mockCaptureException = vi.fn()

vi.mock('@/lib/social/create-from-content', () => ({
  createSocialPostFromContent: mockCreateSocialPostFromContent,
}))

vi.mock('@/lib/social/queue', () => ({
  getNextQueueSlot: mockGetNextQueueSlot,
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: mockCaptureException,
}))

// ---------------------------------------------------------------------------
// Supabase mock factory
// ---------------------------------------------------------------------------

interface MockCallRecord {
  table: string
  method: string
  args: unknown[]
}

function createMockSupabase(overrides?: {
  insertError?: { message: string }
  insertData?: { id: string } | null
  updateError?: { message: string }
  updateCount?: number
}) {
  const calls: MockCallRecord[] = []

  const insertData = overrides?.insertData ?? { id: 'post-123' }
  const insertError = overrides?.insertError ?? null
  const updateError = overrides?.updateError ?? null
  const updateCount = overrides?.updateCount ?? (updateError ? 0 : 1)

  function makeChain(table: string) {
    const chain = {
      insert: vi.fn((args: unknown) => {
        calls.push({ table, method: 'insert', args: [args] })
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: insertError ? null : insertData,
              error: insertError,
            }),
          }),
        }
      }),
      update: vi.fn((args: unknown) => {
        calls.push({ table, method: 'update', args: [args] })
        const resolvedValue = {
          data: updateError ? null : {},
          error: table === 'content_pipeline' ? updateError : null,
          count: table === 'content_pipeline' ? updateCount : 1,
        }
        return {
          eq: vi.fn((_col: string, _val: string) => ({
            eq: vi.fn((_col2: string, _val2: string) => ({
              is: vi.fn().mockResolvedValue(resolvedValue),
              then: (resolve: (v: typeof resolvedValue) => void) =>
                Promise.resolve(resolvedValue).then(resolve),
            })),
            is: vi.fn().mockResolvedValue(resolvedValue),
          })),
        }
      }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: insertData, error: null }),
    }
    return chain
  }

  const supabase = {
    from: vi.fn((table: string) => makeChain(table)),
    _calls: calls,
  }

  return supabase as unknown as SupabaseClient & { _calls: MockCallRecord[] }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides?: Partial<SocialConfig>): SocialConfig {
  return {
    enabled: true,
    platforms: ['facebook'],
    captions: { facebook: { pt: 'Confira!' } },
    hashtags: ['test'],
    image_source: 'og_image' as const,
    ig_template: 'card' as const,
    formats: { facebook: 'link_share' as const },
    ...overrides,
  }
}

function makeItem(overrides?: Partial<PipelineItem>): PipelineItem {
  return {
    id: 'pip-1',
    code: 'BP-001',
    format: 'blog_post',
    stage: 'publication',
    language: 'pt-br',
    title_pt: 'Test Post',
    title_en: null,
    hook: 'A test hook',
    synopsis: 'A test synopsis',
    tags: ['react'],
    category: 'tech',
    cover_image_url: 'https://example.com/cover.jpg',
    sections: { 'draft:pt': { content: 'text' } },
    format_metadata: {},
    social_config: makeConfig(),
    blog_post_id: 'blog-1',
    newsletter_edition_id: null,
    campaign_id: null,
    youtube_video_id: null,
    social_post_id: null,
    version: 5,
    created_by: 'user-1',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('graduateToSocialPost', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // -------------------------------------------------------------------------
  // Validation errors
  // -------------------------------------------------------------------------

  it('returns error for unknown format', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({ format: 'podcast' })

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    expect(result).toEqual({
      ok: false,
      error: 'Format "podcast" does not support social graduation',
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns error when created_by is null', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({ created_by: null })

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    expect(result).toEqual({
      ok: false,
      error: 'Pipeline item has no creator',
    })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Auto-graduation path
  // -------------------------------------------------------------------------

  it('auto-graduates when config complete and blog_post_id linked', async () => {
    const supabase = createMockSupabase()
    const item = makeItem()

    mockCreateSocialPostFromContent.mockResolvedValue({
      postId: 'auto-post-1',
      shortLinkId: null,
    })
    mockGetNextQueueSlot.mockResolvedValue({
      date: '2026-05-15',
      hour: 9,
      scheduledAt: '2026-05-15T12:00:00Z',
      label: '9h',
    })

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    expect(result).toEqual({
      ok: true,
      data: { postId: 'auto-post-1', isDraft: false },
    })

    // createSocialPostFromContent called with correct params
    expect(mockCreateSocialPostFromContent).toHaveBeenCalledOnce()
    const params = mockCreateSocialPostFromContent.mock.calls[0][0]
    expect(params.siteId).toBe('site-1')
    expect(params.contentType).toBe('blog')
    expect(params.contentId).toBe('blog-1')
    expect(params.origin).toBe('pipeline')
    expect(params.userId).toBe('user-1')
    expect(params.sourcePipelineId).toBe('pip-1')
    expect(params.config).toEqual(item.social_config)

    // content_pipeline updated with social_post_id
    const pipelineUpdateCall = supabase._calls.find(
      (c) => c.table === 'content_pipeline' && c.method === 'update',
    )
    expect(pipelineUpdateCall).toBeDefined()
    expect(pipelineUpdateCall!.args[0]).toEqual({ social_post_id: 'auto-post-1' })

    // content_pipeline_history insert with 'graduated' event
    const historyCall = supabase._calls.find(
      (c) => c.table === 'content_pipeline_history' && c.method === 'insert',
    )
    expect(historyCall).toBeDefined()
    expect(historyCall!.args[0]).toEqual({
      pipeline_id: 'pip-1',
      event_type: 'graduated',
      to_value: 'social:auto-post-1',
    })
  })

  it('auto-graduation passes queue slot scheduledAt', async () => {
    const supabase = createMockSupabase()
    const item = makeItem()

    mockCreateSocialPostFromContent.mockResolvedValue({
      postId: 'auto-post-2',
      shortLinkId: null,
    })
    mockGetNextQueueSlot.mockResolvedValue({
      date: '2026-05-16',
      hour: 15,
      scheduledAt: '2026-05-16T18:00:00Z',
      label: '15h',
    })

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    expect(mockGetNextQueueSlot).toHaveBeenCalledWith('site-1', 'America/Sao_Paulo')

    const params = mockCreateSocialPostFromContent.mock.calls[0][0]
    expect(params.scheduledAt).toBe('2026-05-16T18:00:00Z')
  })

  it('auto-graduation with null queue slot passes undefined scheduledAt', async () => {
    const supabase = createMockSupabase()
    const item = makeItem()

    mockCreateSocialPostFromContent.mockResolvedValue({
      postId: 'auto-post-3',
      shortLinkId: null,
    })
    mockGetNextQueueSlot.mockResolvedValue(null)

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    const params = mockCreateSocialPostFromContent.mock.calls[0][0]
    expect(params.scheduledAt).toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // Auto-graduation fallback to draft
  // -------------------------------------------------------------------------

  it('auto-graduation failure falls to draft path', async () => {
    const supabase = createMockSupabase()
    const item = makeItem()
    const autoError = new Error('Facebook API down')

    mockGetNextQueueSlot.mockResolvedValue(null)
    mockCreateSocialPostFromContent.mockRejectedValue(autoError)

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    // Sentry captured
    expect(mockCaptureException).toHaveBeenCalledOnce()
    expect(mockCaptureException).toHaveBeenCalledWith(autoError, {
      tags: { component: 'pipeline-graduation', path: 'auto' },
      extra: { pipelineId: 'pip-1' },
    })

    // Falls through to draft
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.isDraft).toBe(true)
      expect(result.data.postId).toBe('post-123')
    }

    // social_posts insert happened (draft path)
    const socialInsert = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    expect(socialInsert).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // Draft path — config incomplete
  // -------------------------------------------------------------------------

  it('draft path when config incomplete (no captions)', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({
      social_config: makeConfig({ captions: {} }),
    })

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    // Auto path should not be attempted
    expect(mockCreateSocialPostFromContent).not.toHaveBeenCalled()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.isDraft).toBe(true)
    }

    // Draft insert with status: 'draft'
    const insertCall = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    expect(insertCall).toBeDefined()
    const insertPayload = insertCall!.args[0] as Record<string, unknown>
    expect(insertPayload.status).toBe('draft')
  })

  it('draft path when config is null', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({ social_config: null })

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    expect(mockCreateSocialPostFromContent).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.isDraft).toBe(true)
    }
  })

  // -------------------------------------------------------------------------
  // Draft path — no content entity linked
  // -------------------------------------------------------------------------

  it('draft path when no content entity linked', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({
      blog_post_id: null,
      social_config: makeConfig(),
    })

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    // Auto path should not be attempted since no content entity
    expect(mockCreateSocialPostFromContent).not.toHaveBeenCalled()

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.isDraft).toBe(true)
    }

    // source_content_type should be null when no entity
    const insertCall = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    expect(insertCall).toBeDefined()
    const payload = insertCall!.args[0] as Record<string, unknown>
    expect(payload.source_content_type).toBeNull()
    expect(payload.source_content_id).toBeNull()
  })

  // -------------------------------------------------------------------------
  // Draft path — correct post content
  // -------------------------------------------------------------------------

  it('draft path inserts correct post content', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({
      social_config: null, // force draft path
      title_pt: 'Meu Artigo',
      hook: 'Entenda tudo',
      tags: ['react', 'nextjs'],
      cover_image_url: 'https://example.com/img.jpg',
    })

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    const insertCall = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    expect(insertCall).toBeDefined()

    const payload = insertCall!.args[0] as Record<string, unknown>
    const content = payload.content as Record<string, unknown>

    expect(content.title).toBe('Meu Artigo')
    expect(content.description).toBe('Entenda tudo')
    expect(content.hashtags).toEqual(['react', 'nextjs'])
    expect(content.media_urls).toEqual(['https://example.com/img.jpg'])
    expect(content.captions).toEqual({})
    expect(content.url).toBe('')
  })

  it('draft path uses title_en when title_pt is null', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({
      social_config: null,
      title_pt: null,
      title_en: 'English Title',
    })

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    const insertCall = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    const payload = insertCall!.args[0] as Record<string, unknown>
    const content = payload.content as Record<string, unknown>
    expect(content.title).toBe('English Title')
  })

  it('draft path uses synopsis when hook is null', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({
      social_config: null,
      hook: null,
      synopsis: 'Fallback synopsis',
    })

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    const insertCall = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    const payload = insertCall!.args[0] as Record<string, unknown>
    const content = payload.content as Record<string, unknown>
    expect(content.description).toBe('Fallback synopsis')
  })

  it('draft path uses config hashtags over tags when config exists', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({
      blog_post_id: null, // force draft path (no entity)
      social_config: makeConfig({ hashtags: ['configTag'] }),
      tags: ['itemTag'],
    })

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    const insertCall = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    const payload = insertCall!.args[0] as Record<string, unknown>
    const content = payload.content as Record<string, unknown>
    expect(content.hashtags).toEqual(['configTag'])
  })

  it('draft path uses captions from config when available', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({
      blog_post_id: null, // force draft path (no entity)
      social_config: makeConfig({
        captions: { facebook: { pt: 'Caption text' } },
      }),
    })

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    const insertCall = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    const payload = insertCall!.args[0] as Record<string, unknown>
    const content = payload.content as Record<string, unknown>
    expect(content.captions).toEqual({ facebook: { pt: 'Caption text' } })
  })

  it('draft path media_urls is empty when no cover_image_url', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({
      social_config: null,
      cover_image_url: null,
    })

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    const insertCall = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    const payload = insertCall!.args[0] as Record<string, unknown>
    const content = payload.content as Record<string, unknown>
    expect(content.media_urls).toEqual([])
  })

  // -------------------------------------------------------------------------
  // Draft path — updates content_pipeline
  // -------------------------------------------------------------------------

  it('draft path updates content_pipeline.social_post_id', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({ social_config: null })

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    const updateCall = supabase._calls.find(
      (c) => c.table === 'content_pipeline' && c.method === 'update',
    )
    expect(updateCall).toBeDefined()
    expect(updateCall!.args[0]).toEqual({ social_post_id: 'post-123' })
  })

  // -------------------------------------------------------------------------
  // Draft path — history event
  // -------------------------------------------------------------------------

  it('draft path inserts history with graduated_draft event', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({ social_config: null })

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    const historyCall = supabase._calls.find(
      (c) => c.table === 'content_pipeline_history' && c.method === 'insert',
    )
    expect(historyCall).toBeDefined()
    expect(historyCall!.args[0]).toEqual({
      pipeline_id: 'pip-1',
      event_type: 'graduated_draft',
      to_value: 'social:post-123',
    })
  })

  // -------------------------------------------------------------------------
  // Newsletter format
  // -------------------------------------------------------------------------

  it('handles newsletter format correctly', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({
      format: 'newsletter',
      blog_post_id: null,
      newsletter_edition_id: 'nl-1',
      social_config: makeConfig(),
    })

    mockCreateSocialPostFromContent.mockResolvedValue({
      postId: 'nl-post-1',
      shortLinkId: null,
    })
    mockGetNextQueueSlot.mockResolvedValue(null)

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.postId).toBe('nl-post-1')
      expect(result.data.isDraft).toBe(false)
    }

    const params = mockCreateSocialPostFromContent.mock.calls[0][0]
    expect(params.contentType).toBe('newsletter')
    expect(params.contentId).toBe('nl-1')
  })

  // -------------------------------------------------------------------------
  // Video format — type: 'video'
  // -------------------------------------------------------------------------

  it('draft path sets type to video for video format', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({
      format: 'video',
      blog_post_id: null,
      youtube_video_id: null,
      social_config: null, // force draft
    })

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    const insertCall = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    const payload = insertCall!.args[0] as Record<string, unknown>
    expect(payload.type).toBe('video')
  })

  it('draft path sets type to link for blog format', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({
      social_config: null, // force draft
    })

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    const insertCall = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    const payload = insertCall!.args[0] as Record<string, unknown>
    expect(payload.type).toBe('link')
  })

  // -------------------------------------------------------------------------
  // Return values — postId and isDraft
  // -------------------------------------------------------------------------

  it('auto path returns isDraft false', async () => {
    const supabase = createMockSupabase()
    const item = makeItem()

    mockCreateSocialPostFromContent.mockResolvedValue({
      postId: 'auto-99',
      shortLinkId: null,
    })
    mockGetNextQueueSlot.mockResolvedValue(null)

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    expect(result).toEqual({
      ok: true,
      data: { postId: 'auto-99', isDraft: false },
    })
  })

  it('draft path returns isDraft true', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({ social_config: null })

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    expect(result).toEqual({
      ok: true,
      data: { postId: 'post-123', isDraft: true },
    })
  })

  // -------------------------------------------------------------------------
  // Draft insert error
  // -------------------------------------------------------------------------

  it('returns error when draft insert fails', async () => {
    const supabase = createMockSupabase({
      insertError: { message: 'unique constraint violation' },
    })
    const item = makeItem({ social_config: null })

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    expect(result).toEqual({
      ok: false,
      error: 'Failed to create draft social post: unique constraint violation',
    })
  })

  // -------------------------------------------------------------------------
  // Draft path metadata fields
  // -------------------------------------------------------------------------

  it('draft path sets correct metadata fields', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({
      social_config: null,
      blog_post_id: 'blog-77',
    })

    await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    const insertCall = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    expect(insertCall).toBeDefined()

    const payload = insertCall!.args[0] as Record<string, unknown>
    expect(payload.site_id).toBe('site-1')
    expect(payload.created_by).toBe('user-1')
    expect(payload.status).toBe('draft')
    expect(payload.user_timezone).toBe('America/Sao_Paulo')
    expect(payload.source_content_type).toBe('blog')
    expect(payload.source_content_id).toBe('blog-77')
    expect(payload.source_pipeline_id).toBe('pip-1')
    expect(payload.origin).toBe('pipeline')
    expect(payload.pipeline_steps).toEqual([])
    expect(payload.pipeline_snapshot).toBeDefined()
    expect(payload.graduated_at).toBeDefined()
    expect(payload.idempotency_key).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // Timezone parameter
  // -------------------------------------------------------------------------

  it('timezone is passed to auto-graduation queue slot', async () => {
    const supabase = createMockSupabase()
    const item = makeItem()

    mockCreateSocialPostFromContent.mockResolvedValue({
      postId: 'tz-post-1',
      shortLinkId: null,
    })
    mockGetNextQueueSlot.mockResolvedValue(null)

    await graduateToSocialPost(supabase, item, 'site-1', 'Europe/London')

    expect(mockGetNextQueueSlot).toHaveBeenCalledWith('site-1', 'Europe/London')
  })

  it('timezone defaults to America/Sao_Paulo when undefined', async () => {
    const supabase = createMockSupabase()
    const item = makeItem({ social_config: null })

    await graduateToSocialPost(supabase, item, 'site-1')

    const insertCall = supabase._calls.find(
      (c) => c.table === 'social_posts' && c.method === 'insert',
    )
    expect(insertCall).toBeDefined()
    const payload = insertCall!.args[0] as Record<string, unknown>
    expect(payload.user_timezone).toBe('America/Sao_Paulo')
  })

  // -------------------------------------------------------------------------
  // FK update failure captured to Sentry but returns success
  // -------------------------------------------------------------------------

  it('FK update failure captures to Sentry but returns success', async () => {
    const supabase = createMockSupabase({
      updateError: { message: 'row not found' },
    })
    const item = makeItem()

    mockCreateSocialPostFromContent.mockResolvedValue({
      postId: 'fk-post-1',
      shortLinkId: null,
    })
    mockGetNextQueueSlot.mockResolvedValue(null)

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    // Should still succeed
    expect(result).toEqual({
      ok: true,
      data: { postId: 'fk-post-1', isDraft: false },
    })

    // Sentry should have been called for the FK error
    expect(mockCaptureException).toHaveBeenCalled()
    const sentryCall = mockCaptureException.mock.calls.find(
      (call) => call[1]?.tags?.path === 'fk-update',
    )
    expect(sentryCall).toBeDefined()
  })

  // -------------------------------------------------------------------------
  // Race condition — FK update count=0 (concurrent graduation)
  // -------------------------------------------------------------------------

  it('auto-graduation captures Sentry on FK race (count=0, no error)', async () => {
    const supabase = createMockSupabase({ updateCount: 0 })
    const item = makeItem()

    mockCreateSocialPostFromContent.mockResolvedValue({
      postId: 'race-post-1',
      shortLinkId: null,
    })
    mockGetNextQueueSlot.mockResolvedValue(null)

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    expect(result).toEqual({
      ok: true,
      data: { postId: 'race-post-1', isDraft: false },
    })

    const raceCall = mockCaptureException.mock.calls.find(
      (call) => call[1]?.tags?.path === 'fk-update-race',
    )
    expect(raceCall).toBeDefined()
    expect(raceCall![0].message).toContain('orphan post')
  })

  it('draft path captures Sentry on FK race (count=0, no error)', async () => {
    const supabase = createMockSupabase({ updateCount: 0 })
    const item = makeItem({ social_config: null })

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')

    expect(result.ok).toBe(true)

    const raceCall = mockCaptureException.mock.calls.find(
      (call) => call[1]?.tags?.path === 'draft-fk-update-race',
    )
    expect(raceCall).toBeDefined()
    expect(raceCall![0].message).toContain('orphan draft')
  })

  // -------------------------------------------------------------------------
  // Idempotency — already graduated
  // -------------------------------------------------------------------------

  it('returns early if item already has social_post_id (idempotency)', async () => {
    const item = makeItem({ social_post_id: 'existing-post-1' })
    const supabase = createMockSupabase()
    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')
    expect(result).toEqual({ ok: true, data: { postId: 'existing-post-1', isDraft: true } })
    // Should NOT call createSocialPostFromContent or insert anything
    expect(mockCreateSocialPostFromContent).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // getNextQueueSlot error resilience
  // -------------------------------------------------------------------------

  it('handles getNextQueueSlot throwing without failing', async () => {
    // getNextQueueSlot throws, but graduation should still succeed via auto path
    mockGetNextQueueSlot.mockRejectedValue(new Error('queue error'))
    const item = makeItem()
    const supabase = createMockSupabase()

    mockCreateSocialPostFromContent.mockResolvedValue({
      postId: 'resilient-post-1',
      shortLinkId: null,
    })

    const result = await graduateToSocialPost(supabase, item, 'site-1', 'America/Sao_Paulo')
    // Should still attempt createSocialPostFromContent with scheduledAt: undefined
    expect(mockCreateSocialPostFromContent).toHaveBeenCalled()
    const params = mockCreateSocialPostFromContent.mock.calls[0][0]
    expect(params.scheduledAt).toBeUndefined()
    expect(result.ok).toBe(true)
  })
})
