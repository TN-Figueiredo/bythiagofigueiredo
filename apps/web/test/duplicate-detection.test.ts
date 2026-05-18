import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
const mockSelect = vi.fn()
const mockFrom = vi.fn(() => ({
  select: mockSelect,
}))

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: () => ({ from: mockFrom }),
}))

describe('duplicate-detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty when no existing posts', async () => {
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
      }),
    })

    const { checkDuplicates } = await import(
      '@/lib/social/duplicate-detection'
    )

    const result = await checkDuplicates(
      { from: mockFrom } as never,
      'blog',
      'content-123',
    )

    expect(result.hasDuplicates).toBe(false)
    expect(result.posts).toEqual([])
  })

  it('detects same-content same-platform duplicate', async () => {
    const existingPosts = [
      {
        id: 'post-1',
        platform: 'facebook',
        status: 'completed',
        published_at: '2026-05-15T10:00:00Z',
      },
    ]

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            data: existingPosts,
            error: null,
          }),
        }),
      }),
    })

    const { checkDuplicates, getDuplicateWarnings } = await import(
      '@/lib/social/duplicate-detection'
    )

    const result = await checkDuplicates(
      { from: mockFrom } as never,
      'blog',
      'content-123',
    )

    expect(result.hasDuplicates).toBe(true)
    expect(result.posts).toHaveLength(1)

    const warnings = getDuplicateWarnings(result.posts, ['facebook'])
    expect(warnings.samePlatformPosts).toHaveLength(1)
    expect(warnings.samePlatformPosts[0]!.platform).toBe('facebook')
    expect(warnings.severity).toBe('confirm')
  })

  it('allows cross-platform posting without confirmation', async () => {
    const existingPosts = [
      {
        id: 'post-1',
        platform: 'facebook',
        status: 'completed',
        published_at: '2026-05-15T10:00:00Z',
      },
    ]

    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          not: vi.fn().mockReturnValue({
            data: existingPosts,
            error: null,
          }),
        }),
      }),
    })

    const { checkDuplicates, getDuplicateWarnings } = await import(
      '@/lib/social/duplicate-detection'
    )

    const result = await checkDuplicates(
      { from: mockFrom } as never,
      'blog',
      'content-123',
    )

    // Posting to bluesky (different platform) — warning only, no confirmation needed
    const warnings = getDuplicateWarnings(result.posts, ['bluesky'])
    expect(warnings.samePlatformPosts).toHaveLength(0)
    expect(warnings.severity).toBe('warning')
  })

  it('returns severity "none" when no duplicates at all', async () => {
    const { getDuplicateWarnings } = await import(
      '@/lib/social/duplicate-detection'
    )

    const warnings = getDuplicateWarnings([], ['facebook', 'bluesky'])
    expect(warnings.severity).toBe('none')
    expect(warnings.totalExisting).toBe(0)
  })
})
