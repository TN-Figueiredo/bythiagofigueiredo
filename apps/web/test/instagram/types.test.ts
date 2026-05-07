import { describe, it, expect } from 'vitest'
import type {
  InstagramAccountRow,
  InstagramPostRow,
  InstagramFeedSlotRow,
  InstagramSyncLogRow,
  InstagramPostView,
  ResolvedSlot,
  InstagramSyncMode,
  InstagramAccountPublic,
} from '@/lib/instagram/types'

describe('Instagram types', () => {
  it('InstagramAccountRow has all required fields', () => {
    const row: InstagramAccountRow = {
      id: 'acc-1',
      site_id: 'site-1',
      locale: 'pt',
      handle: '@test',
      ig_user_id: '123',
      access_token: 'tok',
      token_expires_at: '2026-07-01T00:00:00Z',
      sync_enabled: true,
      display_slots: 6,
      layout_type: 'grid',
      last_synced_at: null,
      created_at: '2026-05-07T00:00:00Z',
      updated_at: '2026-05-07T00:00:00Z',
    }
    expect(row.id).toBe('acc-1')
    expect(row.layout_type).toBe('grid')
  })

  it('InstagramPostRow has all required fields', () => {
    const row: InstagramPostRow = {
      id: 'post-1',
      account_id: 'acc-1',
      ig_media_id: '17890123456789',
      media_type: 'IMAGE',
      media_url: 'https://scontent.cdninstagram.com/...',
      thumbnail_url: null,
      cached_image_url: 'https://abc.public.blob.vercel-storage.com/instagram/...',
      caption: 'Hello world',
      permalink: 'https://www.instagram.com/p/abc123/',
      like_count: 42,
      comments_count: 5,
      ig_timestamp: '2026-05-01T12:00:00Z',
      created_at: '2026-05-07T00:00:00Z',
      updated_at: '2026-05-07T00:00:00Z',
    }
    expect(row.media_type).toBe('IMAGE')
  })

  it('InstagramFeedSlotRow supports null post_id for auto-fill', () => {
    const slot: InstagramFeedSlotRow = {
      id: 'slot-1',
      account_id: 'acc-1',
      position: 1,
      post_id: null,
      created_at: '2026-05-07T00:00:00Z',
      updated_at: '2026-05-07T00:00:00Z',
    }
    expect(slot.post_id).toBeNull()
  })

  it('ResolvedSlot has pinned flag', () => {
    const slot: ResolvedSlot = {
      position: 1,
      post: {
        id: 'post-1',
        igMediaId: '17890123456789',
        mediaType: 'IMAGE',
        cachedImageUrl: 'https://blob.vercel-storage.com/...',
        caption: 'test',
        permalink: 'https://instagram.com/p/abc/',
        likeCount: 10,
        commentsCount: 2,
        igTimestamp: '2026-05-01T12:00:00Z',
      },
      pinned: true,
    }
    expect(slot.pinned).toBe(true)
  })

  it('InstagramSyncMode covers all valid modes', () => {
    const modes: InstagramSyncMode[] = ['daily', 'manual', 'token_refresh']
    expect(modes).toHaveLength(3)
  })
})
