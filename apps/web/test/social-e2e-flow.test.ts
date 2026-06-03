import { describe, it, expect } from 'vitest'
import { buildPublishPayload } from '@/lib/social/build-payload'
import { adaptContent } from '../src/lib/social/adapt-content'
import { SocialPostContentSchema } from '@tn-figueiredo/social'
import { formatFacebookContent } from '@tn-figueiredo/social/providers/meta'

describe('Social E2E flow', () => {
  it('buildPublishPayload produces correct structure with per-platform captions', () => {
    const payload = buildPublishPayload(
      { fb_page: 'FB text', ig_feed: 'IG text', bsky_feed: 'BSky text' },
      { fb_page: true, ig_feed: true, ig_story: false, yt_community: false, bsky_feed: true },
      'now',
      {
        publishNow: true,
        mediaUrls: ['https://blob.vercel.com/test.jpg'],
        contentUrl: 'https://example.com/blog/1',
        sourceContentId: '11111111-1111-1111-1111-111111111111',
        sourceContentType: 'blog',
      },
    )

    expect(payload.content.captions).toEqual({
      facebook: 'FB text',
      instagram: 'IG text',
      bluesky: 'BSky text',
    })
    expect(payload.content.media_urls).toEqual(['https://blob.vercel.com/test.jpg'])
    expect(payload.content.url).toBe('https://example.com/blog/1')
    expect(payload.platforms).toContain('facebook')
    expect(payload.platforms).toContain('instagram')
    expect(payload.platforms).toContain('bluesky')
    expect(payload.publishNow).toBe(true)
  })

  it('adaptContent produces different output per provider', () => {
    const content = {
      description: 'Default',
      url: 'https://go.test.com/abc',
      media_urls: ['https://blob.vercel.com/test.jpg'],
      captions: { facebook: 'FB specific', instagram: 'IG specific', bluesky: 'BSky specific' },
    }

    const fbResult = adaptContent(content, 'facebook', 'link_share')
    const igResult = adaptContent(content, 'instagram', 'image_post')
    const bskyResult = adaptContent(content, 'bluesky', 'link_card')

    // Facebook: uses fb caption, sets _photoMode
    expect(fbResult.description).toBe('FB specific')
    expect(fbResult._photoMode).toBe(true)

    // Instagram: uses ig caption, strips title
    expect(igResult.description).toBe('IG specific')
    expect(igResult.title).toBeUndefined()

    // Bluesky: uses bsky caption, strips title
    expect(bskyResult.description).toBe('BSky specific')
    expect(bskyResult.title).toBeUndefined()
  })

  it('content_override takes precedence in adaptContent', () => {
    const content = {
      description: 'Default',
      captions: { facebook: 'FB caption' },
    }

    const result = adaptContent(content, 'facebook', 'link_share', { description: 'Override wins' })
    expect(result.description).toBe('Override wins')
  })

  it('SocialPostContentSchema accepts full payload with captions', () => {
    const result = SocialPostContentSchema.safeParse({
      description: 'Main text',
      url: 'https://example.com',
      media_urls: ['https://blob.vercel.com/test.jpg'],
      hashtags: ['test'],
      captions: {
        facebook: 'FB text',
        instagram: 'IG text',
        bluesky: 'BSky text',
      },
    })

    expect(result.success).toBe(true)
  })

  it('formatFacebookContent does not duplicate identical title and description', () => {
    const result = formatFacebookContent(
      { title: 'Same text', description: 'Same text' },
      63206,
    )

    const occurrences = result.message.split('Same text').length - 1
    expect(occurrences).toBe(1)
  })
})
