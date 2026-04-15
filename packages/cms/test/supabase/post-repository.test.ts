import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SupabasePostRepository } from '../../src/supabase/post-repository'

function mockChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    from: vi.fn(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  }
  ;(chain.from as ReturnType<typeof vi.fn>).mockImplementation(() => chain)
  return chain
}

beforeEach(() => { vi.clearAllMocks() })

describe('SupabasePostRepository', () => {
  it('getBySlug queries blog_posts + translations via inner join', async () => {
    const chain = mockChain()
    ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        id: 'p1', site_id: 's1', author_id: 'a1', status: 'published',
        published_at: '2026-01-01', scheduled_for: null, cover_image_url: null,
        created_at: '2026-01-01', updated_at: '2026-01-01',
        blog_translations: [{
          id: 't1', post_id: 'p1', locale: 'pt-BR', title: 'T', slug: 'hello',
          excerpt: null, content_mdx: '# T', content_compiled: null,
          content_toc: [], reading_time_min: 1,
          created_at: '2026-01-01', updated_at: '2026-01-01',
        }],
      },
      error: null,
    })
    const repo = new SupabasePostRepository(chain as never)
    const post = await repo.getBySlug({ siteId: 's1', locale: 'pt-BR', slug: 'hello' })
    expect(post).not.toBeNull()
    expect(post!.id).toBe('p1')
    expect(post!.translations).toHaveLength(1)
  })

  it('list applies filters and pagination', async () => {
    const chain = mockChain()
    ;(chain.range as ReturnType<typeof vi.fn>).mockReturnThis()
    ;(chain.order as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: [{
        id: 'p1', status: 'published', published_at: '2026-01-01', cover_image_url: null,
        blog_translations: [{ locale: 'pt-BR', title: 'T', slug: 's', excerpt: null, reading_time_min: 1 }],
      }],
      error: null,
    })
    const repo = new SupabasePostRepository(chain as never)
    const items = await repo.list({ siteId: 's1', locale: 'pt-BR', status: 'published', page: 1, perPage: 10 })
    expect(items).toHaveLength(1)
    expect((chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('status', 'published')
  })

  it('publish updates status + published_at', async () => {
    const chain = mockChain()
    ;(chain.single as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { id: 'p1', site_id: 's1', author_id: 'a1', status: 'published', published_at: '2026-01-01', scheduled_for: null, cover_image_url: null, created_at: '', updated_at: '', blog_translations: [] },
      error: null,
    })
    const repo = new SupabasePostRepository(chain as never)
    await repo.publish('p1')
    const updateArg = (chain.update as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Record<string, unknown>
    expect(updateArg.status).toBe('published')
    expect(updateArg.published_at).toBeTruthy()
  })
})
