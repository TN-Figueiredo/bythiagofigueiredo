import { describe, it, expect } from 'vitest'
import { buildPublishPayload } from '@/lib/social/build-payload'

describe('buildPublishPayload', () => {
  const captions = {
    fb_page: 'Facebook caption',
    ig_feed: 'Instagram caption',
    bsky_feed: 'Bluesky caption',
  }

  const destsOn = {
    ig_story: false,
    yt_community: false,
    fb_page: true,
    ig_feed: true,
    bsky_feed: true,
  }

  it('sets content.description to primary caption', () => {
    const result = buildPublishPayload(captions, destsOn, 'now', {})
    expect(result.content.description).toBeTruthy()
  })

  it('includes per-platform captions keyed by provider', () => {
    const result = buildPublishPayload(captions, destsOn, 'now', {})
    expect(result.content.captions).toEqual({
      facebook: 'Facebook caption',
      instagram: 'Instagram caption',
      bluesky: 'Bluesky caption',
    })
  })

  it('does NOT set title (no duplication)', () => {
    const result = buildPublishPayload(captions, destsOn, 'now', {})
    expect(result.content).not.toHaveProperty('title')
  })

  it('includes media_urls from options', () => {
    const result = buildPublishPayload(captions, destsOn, 'now', {
      mediaUrls: ['https://blob.vercel.com/img.jpg'],
    })
    expect(result.content.media_urls).toEqual(['https://blob.vercel.com/img.jpg'])
  })

  it('deduplicates platforms', () => {
    const bothIg = { ...destsOn, ig_story: true }
    const result = buildPublishPayload(captions, bothIg, 'now', {})
    expect(result.platforms.filter(p => p === 'instagram').length).toBe(1)
  })

  it('sets storyMode when ig_story active', () => {
    const result = buildPublishPayload(captions, { ...destsOn, ig_story: true }, 'now', {})
    expect(result.storyMode).toBe(true)
  })

  it('sets scheduledAt only in schedule mode', () => {
    const now = buildPublishPayload(captions, destsOn, 'now', { scheduledAt: '2026-06-05T10:00:00Z' })
    expect(now.scheduledAt).toBeUndefined()
    const sched = buildPublishPayload(captions, destsOn, 'schedule', { scheduledAt: '2026-06-05T10:00:00Z' })
    expect(sched.scheduledAt).toBe('2026-06-05T10:00:00Z')
  })
})
