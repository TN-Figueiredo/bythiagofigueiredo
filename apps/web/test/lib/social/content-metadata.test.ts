import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ContentType } from '@/lib/social/types'

// ---------------------------------------------------------------------------
// Mock Supabase client builder
// ---------------------------------------------------------------------------
function createMockSupabase(tableData: Record<string, unknown>) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: tableData[table] ?? null,
            error: tableData[table] ? null : { message: 'not found' },
          }),
        }),
      }),
    })),
  }
}

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
        id: 'bp-1',
        title: 'AI Empire: O Que Vem Por Ai',
        slug: 'ai-empire',
        locale: 'pt',
        cover_image_url: 'https://cdn.example.com/cover.jpg',
        excerpt: 'O futuro da inteligencia artificial...',
        tags: ['AI', 'BuildInPublic'],
      },
    })

    const meta = await extractContentMetadata(
      supabase as never,
      'blog' as ContentType,
      'bp-1',
    )

    expect(meta.title).toBe('AI Empire: O Que Vem Por Ai')
    expect(meta.url).toBe('https://bythiagofigueiredo.com/pt/blog/ai-empire')
    expect(meta.image).toBe('https://cdn.example.com/cover.jpg')
    expect(meta.excerpt).toBe('O futuro da inteligencia artificial...')
    expect(meta.tags).toEqual(['AI', 'BuildInPublic'])
    expect(meta.locale).toBe('pt')
  })

  it('extracts metadata from a newsletter edition', async () => {
    const { extractContentMetadata } = await import(
      '@/lib/social/content-metadata'
    )

    const selectMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
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
        }),
      }),
    })
    const supabase = {
      from: vi.fn(() => ({
        select: selectMock,
      })),
    }

    const meta = await extractContentMetadata(
      supabase as never,
      'newsletter' as ContentType,
      'ne-1',
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
    )

    expect(meta.title).toBe('Summer Sale 2026')
    expect(meta.url).toBe(
      'https://bythiagofigueiredo.com/en/campaign/summer-sale-2026',
    )
    expect(meta.image).toBe('https://cdn.example.com/og-summer.jpg')
    expect(meta.excerpt).toBe('Biggest deals of the season')
  })

  it('extracts metadata from a video (YouTube)', async () => {
    const { extractContentMetadata } = await import(
      '@/lib/social/content-metadata'
    )
    const supabase = createMockSupabase({
      social_connections: {
        id: 'conn-yt',
        provider: 'youtube',
        metadata: {
          videos: [
            {
              id: 'dQw4w9WgXcQ',
              title: 'Never Gonna Give You Up',
              thumbnail_url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
              description:
                'Rick Astley - Never Gonna Give You Up (Official Music Video) - a very long description that should be truncated to 160 characters for the excerpt field in the metadata extraction process.',
              tags: ['music', 'classic'],
            },
          ],
        },
      },
    })

    const meta = await extractContentMetadata(
      supabase as never,
      'video' as ContentType,
      'dQw4w9WgXcQ',
    )

    expect(meta.title).toBe('Never Gonna Give You Up')
    expect(meta.url).toBe('https://youtube.com/watch?v=dQw4w9WgXcQ')
    expect(meta.image).toBe(
      'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    )
    expect(meta.excerpt!.length).toBeLessThanOrEqual(160)
    expect(meta.tags).toEqual(['music', 'classic'])
  })

  it('throws for unknown content type', async () => {
    const { extractContentMetadata } = await import(
      '@/lib/social/content-metadata'
    )
    const supabase = createMockSupabase({})

    await expect(
      extractContentMetadata(supabase as never, 'podcast' as ContentType, 'x'),
    ).rejects.toThrow('Unsupported content type: podcast')
  })

  it('throws when content is not found in the database', async () => {
    const { extractContentMetadata } = await import(
      '@/lib/social/content-metadata'
    )
    const supabase = createMockSupabase({}) // no data for any table

    await expect(
      extractContentMetadata(supabase as never, 'blog' as ContentType, 'missing-id'),
    ).rejects.toThrow()
  })
})
