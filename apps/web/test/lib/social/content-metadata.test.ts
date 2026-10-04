import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ContentType } from '@/lib/social/types'

// ---------------------------------------------------------------------------
// Mock Supabase client builder
// Supports chaining: from -> select -> eq -> eq -> single
// ---------------------------------------------------------------------------
function createMockSupabase(tableData: Record<string, unknown>) {
  const makeSingleResult = (table: string) => ({
    single: vi.fn().mockResolvedValue({
      data: tableData[table] ?? null,
      error: tableData[table] ? null : { message: 'not found' },
    }),
  })

  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue(makeSingleResult(table)),
        }),
      }),
    })),
  }
}

const TEST_SITE_ID = 'site-test-1'

describe('extractContentMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://bythiagofigueiredo.com'
  })

  it('extracts metadata from a blog post', async () => {
    const { extractContentMetadata } = await import(
      '@/lib/social/content-metadata'
    )
    const supabase = createMockSupabase({
      blog_posts: {
        locale: 'pt',
        cover_image_url: 'https://cdn.example.com/cover.jpg',
        blog_translations: [
          {
            title: 'AI Empire: O Que Vem Por Ai',
            slug: 'ai-empire',
            excerpt: 'O futuro da inteligencia artificial...',
          },
        ],
      },
    })

    const meta = await extractContentMetadata(
      supabase as never,
      'blog' as ContentType,
      'bp-1',
      TEST_SITE_ID,
    )

    expect(meta.title).toBe('AI Empire: O Que Vem Por Ai')
    expect(meta.url).toBe('https://bythiagofigueiredo.com/pt/blog/ai-empire')
    expect(meta.image).toBe('https://cdn.example.com/cover.jpg')
    expect(meta.excerpt).toBe('O futuro da inteligencia artificial...')
    expect(meta.tags).toEqual([])
    expect(meta.locale).toBe('pt')
  })

  it('extracts metadata from a newsletter edition', async () => {
    const { extractContentMetadata } = await import(
      '@/lib/social/content-metadata'
    )

    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'ne-1',
        subject: 'Weekly Digest #42',
        preheader: 'Top stories this week',
        content: '<p>Hello world</p><img src="https://cdn.example.com/nl-cover.jpg" />',
        locale: 'pt',
        newsletter_types: {
          slug: 'weekly-digest',
        },
      },
      error: null,
    })
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: singleMock }),
          }),
        }),
      })),
    }

    const meta = await extractContentMetadata(
      supabase as never,
      'newsletter' as ContentType,
      'ne-1',
      TEST_SITE_ID,
    )

    expect(meta.title).toBe('Weekly Digest #42')
    expect(meta.url).toBe(
      'https://bythiagofigueiredo.com/pt/newsletter/weekly-digest/editions/ne-1',
    )
    expect(meta.excerpt).toBe('Top stories this week')
    expect(meta.locale).toBe('pt')
  })

  it('extracts metadata from a campaign', async () => {
    const { extractContentMetadata } = await import(
      '@/lib/social/content-metadata'
    )
    const supabase = createMockSupabase({
      campaigns: {
        id: 'camp-1',
        meta_title: 'Summer Sale 2026',
        slug: 'summer-sale-2026',
        locale: 'en',
        og_image_url: 'https://cdn.example.com/og-summer.jpg',
        meta_description: 'Biggest deals of the season',
      },
    })

    const meta = await extractContentMetadata(
      supabase as never,
      'campaign' as ContentType,
      'camp-1',
      TEST_SITE_ID,
    )

    expect(meta.title).toBe('Summer Sale 2026')
    expect(meta.url).toBe(
      'https://bythiagofigueiredo.com/en/campaign/summer-sale-2026',
    )
    expect(meta.image).toBe('https://cdn.example.com/og-summer.jpg')
    expect(meta.excerpt).toBe('Biggest deals of the season')
  })

  describe('video (YouTube) — várias conexões', () => {
    const vid = (id: string, title: string) => ({
      id,
      title,
      thumbnail_url: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
      description: 'Rick Astley - a very long description '.repeat(10),
      tags: ['music', 'classic'],
    })

    /** social_connections: cada filtro é registrado; a consulta devolve só as linhas não revogadas. */
    function ytStub(rows: Array<{ metadata: unknown; revoked_at: string | null }>) {
      const calls: Array<[string, ...unknown[]]> = []
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.eq = (...a: unknown[]) => (calls.push(['eq', ...a]), builder)
      builder.is = (...a: unknown[]) => (calls.push(['is', ...a]), builder)
      builder.order = (...a: unknown[]) => (calls.push(['order', ...a]), builder)
      builder.single = () => {
        calls.push(['single'])
        return Promise.resolve({ data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } })
      }
      builder.then = (resolve: (v: unknown) => unknown) =>
        resolve({
          data: calls.some((c) => c[0] === 'is' && c[1] === 'revoked_at')
            ? rows.filter((r) => r.revoked_at === null)
            : rows,
          error: null,
        })
      return { calls, client: { from: () => builder } }
    }

    it('com duas conexões ativas, acha o vídeo nos metadados da segunda', async () => {
      const { extractContentMetadata } = await import('@/lib/social/content-metadata')
      const { client, calls } = ytStub([
        { metadata: { videos: [vid('AAA', 'Do canal PT')] }, revoked_at: null },
        { metadata: { videos: [vid('BBB', 'Do canal EN')] }, revoked_at: null },
      ])
      const meta = await extractContentMetadata(client as never, 'video' as ContentType, 'BBB', TEST_SITE_ID)
      expect(meta.title).toBe('Do canal EN')
      expect(meta.url).toBe('https://youtube.com/watch?v=BBB')
      expect(meta.excerpt!.length).toBeLessThanOrEqual(160)
      expect(meta.tags).toEqual(['music', 'classic'])
      expect(calls.some((c) => c[0] === 'single')).toBe(false)
      expect(calls).toContainEqual(['is', 'revoked_at', null])
    })

    it('ignora a conexão revogada', async () => {
      const { extractContentMetadata } = await import('@/lib/social/content-metadata')
      const { client } = ytStub([
        { metadata: { videos: [vid('AAA', 'Canal removido')] }, revoked_at: '2026-10-01T00:00:00Z' },
        { metadata: { videos: [vid('BBB', 'Canal vivo')] }, revoked_at: null },
      ])
      await expect(
        extractContentMetadata(client as never, 'video' as ContentType, 'AAA', TEST_SITE_ID),
      ).rejects.toThrow('Video not found in YouTube metadata: AAA')
    })

    it('vídeo em nenhuma conexão: "Video not found in YouTube metadata"', async () => {
      const { extractContentMetadata } = await import('@/lib/social/content-metadata')
      const { client } = ytStub([
        { metadata: { videos: [vid('AAA', 'a')] }, revoked_at: null },
        { metadata: null, revoked_at: null },
      ])
      await expect(
        extractContentMetadata(client as never, 'video' as ContentType, 'ZZZ', TEST_SITE_ID),
      ).rejects.toThrow('Video not found in YouTube metadata: ZZZ')
    })

    it('nenhuma conexão ativa: "YouTube connection not found"', async () => {
      const { extractContentMetadata } = await import('@/lib/social/content-metadata')
      const { client } = ytStub([])
      await expect(
        extractContentMetadata(client as never, 'video' as ContentType, 'AAA', TEST_SITE_ID),
      ).rejects.toThrow('YouTube connection not found for video: AAA')
    })
  })

  it('throws for unknown content type', async () => {
    const { extractContentMetadata } = await import(
      '@/lib/social/content-metadata'
    )
    const supabase = createMockSupabase({})

    await expect(
      extractContentMetadata(supabase as never, 'podcast' as ContentType, 'x', TEST_SITE_ID),
    ).rejects.toThrow('Unsupported content type: podcast')
  })

  it('throws when content is not found in the database', async () => {
    const { extractContentMetadata } = await import(
      '@/lib/social/content-metadata'
    )
    const supabase = createMockSupabase({}) // no data for any table

    await expect(
      extractContentMetadata(supabase as never, 'blog' as ContentType, 'missing-id', TEST_SITE_ID),
    ).rejects.toThrow()
  })
})
