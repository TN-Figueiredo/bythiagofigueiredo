import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/service', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@tn-figueiredo/social', () => ({
  decrypt: vi.fn((v: string) => v),
  getMasterKey: vi.fn(() => 'test-key'),
}))

import {
  shouldPollPost,
  type PollCandidate,
} from '@/lib/social/metrics-poller'

describe('shouldPollPost', () => {
  const now = Date.now()

  it('returns true for posts less than 7 days old with last poll over 6h ago', () => {
    const candidate: PollCandidate = {
      postId: 'p1',
      publishedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      lastPolledAt: new Date(now - 7 * 60 * 60 * 1000).toISOString(), // 7h ago
      isStory: false,
    }
    expect(shouldPollPost(candidate)).toBe(true)
  })

  it('returns false for posts less than 7 days old polled less than 6h ago', () => {
    const candidate: PollCandidate = {
      postId: 'p2',
      publishedAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
      lastPolledAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
      isStory: false,
    }
    expect(shouldPollPost(candidate)).toBe(false)
  })

  it('returns true for stories less than 48h old polled over 2h ago', () => {
    const candidate: PollCandidate = {
      postId: 'p3',
      publishedAt: new Date(now - 20 * 60 * 60 * 1000).toISOString(), // 20h ago
      lastPolledAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
      isStory: true,
    }
    expect(shouldPollPost(candidate)).toBe(true)
  })

  it('returns false for posts older than 7 days', () => {
    const candidate: PollCandidate = {
      postId: 'p4',
      publishedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      lastPolledAt: null,
      isStory: false,
    }
    expect(shouldPollPost(candidate)).toBe(false)
  })

  it('returns true for posts never polled before within the window', () => {
    const candidate: PollCandidate = {
      postId: 'p5',
      publishedAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      lastPolledAt: null,
      isStory: false,
    }
    expect(shouldPollPost(candidate)).toBe(true)
  })
})
