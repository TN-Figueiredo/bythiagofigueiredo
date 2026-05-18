import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
}

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => mockSupabase,
}))

describe('Link-in-Bio data layer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getLinkinBioEntries returns up to 20 entries ordered by position', async () => {
    const mockEntries = Array.from({ length: 20 }, (_, i) => ({
      id: `entry-${i}`,
      position: i,
      post_id: `post-${i}`,
      link_id: `link-${i}`,
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
      social_posts: { content: { title: `Post ${i}` } },
      tracked_links: {
        id: `link-${i}`,
        code: `code${i}`,
        destination_url: `https://example.com/${i}`,
      },
    }))

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockEntries,
              error: null,
            }),
          }),
        }),
      }),
    })

    const { getLinkinBioEntries } = await import('@/lib/social/link-in-bio')
    const entries = await getLinkinBioEntries('site-1')

    expect(entries).toHaveLength(20)
    expect(entries[0]!.title).toBe('Post 0')
    expect(mockSupabase.from).toHaveBeenCalledWith('link_in_bio_entries')
  })

  it('addLinkinBioEntry prepends and auto-prunes beyond 20', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockDelete = vi.fn().mockResolvedValue({ error: null })

    // shift_link_in_bio_positions RPC succeeds
    mockSupabase.rpc.mockResolvedValue({ error: null })

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'link_in_bio_entries') {
        return {
          insert: mockInsert,
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({
                  data: [{ id: 'oldest-entry' }],
                  error: null,
                }),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            in: mockDelete,
          }),
        }
      }
      return { select: vi.fn() }
    })

    const { addLinkinBioEntry } = await import('@/lib/social/link-in-bio')
    await addLinkinBioEntry({
      siteId: 'site-1',
      postId: 'post-new',
      linkId: 'link-new',
    })

    expect(mockSupabase.rpc).toHaveBeenCalledWith('shift_link_in_bio_positions', {
      p_site_id: 'site-1',
      p_min_position: 0,
    })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        site_id: 'site-1',
        post_id: 'post-new',
        link_id: 'link-new',
        position: 0,
      }),
    )
  })
})

describe('Link-in-Bio page rendering', () => {
  it('renders avatar, display name, and link list', async () => {
    const { render, screen } = await import('@testing-library/react')
    const React = await import('react')

    const { LinkInBio } = await import(
      '@/app/go/ig/_components/link-in-bio'
    )

    const entries = [
      {
        id: 'e1',
        title: 'First Post',
        shortUrl: 'https://go.btf.com/abc',
        thumbnailUrl: null,
        createdAt: '2026-05-17T10:00:00Z',
      },
      {
        id: 'e2',
        title: 'Second Post',
        shortUrl: 'https://go.btf.com/def',
        thumbnailUrl: 'https://example.com/thumb.jpg',
        createdAt: '2026-05-16T10:00:00Z',
      },
    ]

    render(
      React.createElement(LinkInBio, {
        site: {
          displayName: 'Thiago Figueiredo',
          bio: 'Writer & Developer',
          avatarUrl: 'https://example.com/avatar.jpg',
          brandColor: '#7c3aed',
        },
        entries,
      }),
    )

    expect(screen.getByText('Thiago Figueiredo')).toBeTruthy()
    expect(screen.getByText('Writer & Developer')).toBeTruthy()
    expect(screen.getByText('First Post')).toBeTruthy()
    expect(screen.getByText('Second Post')).toBeTruthy()
  })
})
