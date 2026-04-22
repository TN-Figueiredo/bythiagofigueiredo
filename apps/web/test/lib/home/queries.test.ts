import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('getFeaturedPost', () => {
  beforeEach(() => vi.resetModules())

  it('returns null when no data comes back', async () => {
    vi.doMock('../../../lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () => makeListBuilder({ data: null, error: null }),
      }),
    }))

    const { getFeaturedPost } = await import('../../../lib/home/queries')
    expect(await getFeaturedPost('pt-BR')).toBeNull()
  })

  it('returns null when featured query returns no match and fallback is empty', async () => {
    vi.doMock('../../../lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () => makeListBuilder({ data: null, error: { code: 'PGRST116', message: 'no rows' } }),
      }),
    }))

    const { getFeaturedPost } = await import('../../../lib/home/queries')
    expect(await getFeaturedPost('pt-BR')).toBeNull()
  })

  it('maps a full row correctly to HomePost shape', async () => {
    const row = makeTranslationRow({
      slug: 'hello-world',
      locale: 'pt-BR',
      title: 'Olá Mundo',
      excerpt: 'Um post incrível',
      reading_time_min: 5,
      cover_image_url: 'https://cdn.test/img.jpg',
      blog_posts: {
        id: 'post-1',
        published_at: '2026-01-01T00:00:00Z',
        category: 'tech',
        is_featured: true,
        status: 'published',
      },
    })

    vi.doMock('../../../lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () => makeListBuilder({ data: row, error: null }),
      }),
    }))

    const { getFeaturedPost } = await import('../../../lib/home/queries')
    const post = await getFeaturedPost('pt-BR')

    expect(post).not.toBeNull()
    expect(post?.id).toBe('post-1')
    expect(post?.slug).toBe('hello-world')
    expect(post?.locale).toBe('pt-BR')
    expect(post?.title).toBe('Olá Mundo')
    expect(post?.excerpt).toBe('Um post incrível')
    expect(post?.publishedAt).toBe('2026-01-01T00:00:00Z')
    expect(post?.category).toBe('tech')
    expect(post?.readingTimeMin).toBe(5)
    expect(post?.coverImageUrl).toBe('https://cdn.test/img.jpg')
    expect(post?.isFeatured).toBe(true)
  })
})

describe('getLatestPosts', () => {
  beforeEach(() => vi.resetModules())

  it('returns an array of mapped HomePosts', async () => {
    const rows = [
      makeTranslationRow({
        slug: 'post-a',
        locale: 'en',
        title: 'Post A',
        excerpt: 'Excerpt A',
        reading_time_min: 3,
        cover_image_url: null,
        blog_posts: {
          id: 'id-a',
          published_at: '2026-03-01T00:00:00Z',
          category: 'life',
          is_featured: false,
          status: 'published',
        },
      }),
      makeTranslationRow({
        slug: 'post-b',
        locale: 'en',
        title: 'Post B',
        excerpt: null,
        reading_time_min: 7,
        cover_image_url: 'https://cdn.test/b.jpg',
        blog_posts: {
          id: 'id-b',
          published_at: '2026-02-01T00:00:00Z',
          category: null,
          is_featured: false,
          status: 'published',
        },
      }),
    ]

    vi.doMock('../../../lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () => makeListBuilder({ data: rows, error: null }),
      }),
    }))

    const { getLatestPosts } = await import('../../../lib/home/queries')
    const posts = await getLatestPosts('en')

    expect(posts).toHaveLength(2)
    expect(posts[0].id).toBe('id-a')
    expect(posts[1].id).toBe('id-b')
    expect(posts[1].coverImageUrl).toBe('https://cdn.test/b.jpg')
    expect(posts[1].category).toBeNull()
  })

  it('returns empty array when data is null', async () => {
    vi.doMock('../../../lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () => makeListBuilder({ data: null, error: null }),
      }),
    }))

    const { getLatestPosts } = await import('../../../lib/home/queries')
    expect(await getLatestPosts('pt-BR')).toEqual([])
  })

  it('throws when supabase returns an error', async () => {
    vi.doMock('../../../lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () =>
          makeListBuilder({
            data: null,
            error: { message: 'connection refused', code: '08000', details: '', hint: '' },
          }),
      }),
    }))

    const { getLatestPosts } = await import('../../../lib/home/queries')
    await expect(getLatestPosts('en')).rejects.toMatchObject({
      message: 'connection refused',
    })
  })
})

describe('getNewslettersForLocale', () => {
  beforeEach(() => vi.resetModules())

  it('returns empty array when supabase returns an error', async () => {
    vi.doMock('../../../lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () =>
          makeListBuilder({
            data: null,
            error: { message: 'table not found', code: '42P01', details: '', hint: '' },
          }),
      }),
    }))

    const { getNewslettersForLocale } = await import('../../../lib/home/queries')
    expect(await getNewslettersForLocale('pt-BR')).toEqual([])
  })

  it('returns empty array when data is null without error', async () => {
    vi.doMock('../../../lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () => makeListBuilder({ data: null, error: null }),
      }),
    }))

    const { getNewslettersForLocale } = await import('../../../lib/home/queries')
    expect(await getNewslettersForLocale('pt-BR')).toEqual([])
  })

  it('returns newsletters mapped from data rows', async () => {
    const newsletters = [
      {
        id: 'nl-1',
        locale: 'pt-BR',
        name: 'Tech Semanal',
        tagline: 'As melhores novidades',
        cadence: 'weekly',
        color: '#4F46E5',
      },
      {
        id: 'nl-2',
        locale: 'pt-BR',
        name: 'Vida & Código',
        tagline: null,
        cadence: 'monthly',
        color: '#10B981',
      },
    ]

    vi.doMock('../../../lib/supabase/service', () => ({
      getSupabaseServiceClient: () => ({
        from: () => makeListBuilder({ data: newsletters, error: null }),
      }),
    }))

    const { getNewslettersForLocale } = await import('../../../lib/home/queries')
    const result = await getNewslettersForLocale('pt-BR')

    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('nl-1')
    expect(result[0].name).toBe('Tech Semanal')
    expect(result[0].tagline).toBe('As melhores novidades')
    expect(result[0].cadence).toBe('weekly')
    expect(result[0].color).toBe('#4F46E5')
    expect(result[1].tagline).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface BlogPostRow {
  id: string
  published_at: string
  category: string | null
  is_featured: boolean
  status: string
}

interface TranslationRowInput {
  slug: string
  locale: string
  title: string
  excerpt: string | null
  reading_time_min: number
  cover_image_url: string | null
  blog_posts: BlogPostRow | null
}

function makeTranslationRow(input: TranslationRowInput): TranslationRowInput {
  return input
}

function makeListBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const passthrough = () => builder
  for (const m of [
    'select', 'eq', 'in', 'lte', 'gte', 'not', 'is', 'order', 'limit', 'range', 'single',
  ]) {
    builder[m] = passthrough
  }
  builder.then = (
    resolve: (v: { data: unknown; error: unknown }) => unknown,
    reject: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject)
  return builder
}
