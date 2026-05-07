import { describe, it, expect } from 'vitest'
import type { InstagramPostRow, InstagramFeedSlotRow } from '@/lib/instagram/types'
import { resolveSlots } from '@/lib/instagram/slots'

function makePost(id: string, igTimestamp: string): InstagramPostRow {
  return {
    id, account_id: 'acc-1', ig_media_id: `media-${id}`, media_type: 'IMAGE',
    media_url: null, thumbnail_url: null, cached_image_url: `https://blob/${id}.jpg`,
    caption: `Post ${id}`, permalink: `https://instagram.com/p/${id}/`,
    like_count: 10, comments_count: 2, ig_timestamp: igTimestamp, created_at: '', updated_at: '',
  }
}

function makeSlot(position: number, postId: string | null): InstagramFeedSlotRow {
  return { id: `slot-${position}`, account_id: 'acc-1', position, post_id: postId, created_at: '', updated_at: '' }
}

describe('resolveSlots', () => {
  it('fills all slots with latest posts when no pins exist', () => {
    const posts = [makePost('p1', '2026-05-03T00:00:00Z'), makePost('p2', '2026-05-02T00:00:00Z'), makePost('p3', '2026-05-01T00:00:00Z')]
    const slots = [makeSlot(1, null), makeSlot(2, null), makeSlot(3, null)]
    const result = resolveSlots(slots, posts, 3)
    expect(result).toHaveLength(3)
    expect(result[0].post.id).toBe('p1')
    expect(result[0].pinned).toBe(false)
  })

  it('keeps pinned posts in position, fills rest with latest', () => {
    const posts = [makePost('p1', '2026-05-04T00:00:00Z'), makePost('p2', '2026-05-03T00:00:00Z'), makePost('p3', '2026-05-02T00:00:00Z'), makePost('p4', '2026-05-01T00:00:00Z')]
    const slots = [makeSlot(1, 'p3'), makeSlot(2, null), makeSlot(3, null)]
    const result = resolveSlots(slots, posts, 3)
    expect(result[0].post.id).toBe('p3')
    expect(result[0].pinned).toBe(true)
    expect(result[1].post.id).toBe('p1')
    expect(result[2].post.id).toBe('p2')
  })

  it('handles all slots pinned', () => {
    const posts = [makePost('p1', '2026-05-03T00:00:00Z'), makePost('p2', '2026-05-02T00:00:00Z')]
    const slots = [makeSlot(1, 'p2'), makeSlot(2, 'p1')]
    const result = resolveSlots(slots, posts, 2)
    expect(result[0].post.id).toBe('p2')
    expect(result[0].pinned).toBe(true)
    expect(result[1].post.id).toBe('p1')
    expect(result[1].pinned).toBe(true)
  })

  it('handles fewer posts than slots', () => {
    const posts = [makePost('p1', '2026-05-01T00:00:00Z')]
    const slots = [makeSlot(1, null), makeSlot(2, null), makeSlot(3, null)]
    const result = resolveSlots(slots, posts, 3)
    expect(result).toHaveLength(1)
  })

  it('handles deleted pinned post', () => {
    const posts = [makePost('p1', '2026-05-02T00:00:00Z'), makePost('p2', '2026-05-01T00:00:00Z')]
    const slots = [makeSlot(1, 'deleted-post-id'), makeSlot(2, null)]
    const result = resolveSlots(slots, posts, 2)
    expect(result).toHaveLength(2)
    expect(result[0].post.id).toBe('p1')
    expect(result[0].pinned).toBe(false)
  })

  it('respects count override', () => {
    const posts = [makePost('p1', '2026-05-03T00:00:00Z'), makePost('p2', '2026-05-02T00:00:00Z'), makePost('p3', '2026-05-01T00:00:00Z')]
    const slots = [makeSlot(1, null), makeSlot(2, null), makeSlot(3, null)]
    const result = resolveSlots(slots, posts, 2)
    expect(result).toHaveLength(2)
  })

  it('creates default slots when none exist', () => {
    const posts = [makePost('p1', '2026-05-02T00:00:00Z'), makePost('p2', '2026-05-01T00:00:00Z')]
    const result = resolveSlots([], posts, 3)
    expect(result).toHaveLength(2)
    expect(result[0].pinned).toBe(false)
  })
})
