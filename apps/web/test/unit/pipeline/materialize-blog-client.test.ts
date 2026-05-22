import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { materializeBlogPost } from '@/lib/pipeline/materialize-blog-client'

describe('materializeBlogPost', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const baseParams = {
    pipelineItemId: '11111111-1111-1111-1111-111111111111',
    targetStage: 'published' as const,
    scheduledFor: null,
    vvsScore: 90,
  }

  it('returns ok result on successful API call', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ data: { blogPostId: 'blog-123', targetStage: 'published' } }),
        { status: 200 },
      ),
    )

    const result = await materializeBlogPost(baseParams)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.blogPostId).toBe('blog-123')
      expect(result.targetStage).toBe('published')
      expect(result.message).toContain('publicado')
    }
  })

  it('returns scheduled message when targetStage is scheduled', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ data: { blogPostId: 'blog-123', targetStage: 'scheduled' } }),
        { status: 200 },
      ),
    )

    const result = await materializeBlogPost({
      ...baseParams,
      targetStage: 'scheduled',
      scheduledFor: '2026-06-01T10:00:00Z',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.message).toContain('agendado')
    }
  })

  it('returns error message on non-OK HTTP response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: 'VVS score too low', code: 'VALIDATION_ERROR' } }),
        { status: 422 },
      ),
    )

    const result = await materializeBlogPost(baseParams)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('VVS score too low')
    }
  })

  it('returns generic HTTP error when no error message in response', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({}), { status: 500 }),
    )

    const result = await materializeBlogPost(baseParams)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('HTTP 500')
    }
  })

  it('returns error message on network failure (fetch throws)', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('Network error'))

    const result = await materializeBlogPost(baseParams)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Network error')
    }
  })

  it('returns fallback error for non-Error throws', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue('string error')

    const result = await materializeBlogPost(baseParams)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Erro desconhecido')
    }
  })

  it('sends correct JSON body with all params', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ data: { blogPostId: 'blog-123', targetStage: 'published' } }),
        { status: 200 },
      ),
    )

    await materializeBlogPost(baseParams)

    expect(globalThis.fetch).toHaveBeenCalledWith(
      `/api/pipeline/items/${baseParams.pipelineItemId}/publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStage: 'published',
          scheduledFor: null,
          vvsScore: 90,
        }),
      },
    )
  })
})
