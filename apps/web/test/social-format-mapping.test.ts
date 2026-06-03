import { describe, it, expect } from 'vitest'
import type { Provider } from '@tn-figueiredo/social'
import {
  CONTENT_FORMAT_MAP,
  type ContentType,
  type DeliveryFormat,
} from '../src/lib/social/types'
import { DESTINATIONS, type DestId } from '../src/lib/social/destinations'

// ---------------------------------------------------------------------------
// Helpers — extract the pure format-assignment logic from the two code paths
// so we can test them without Supabase / server action scaffolding.
// ---------------------------------------------------------------------------

/**
 * Replicates the format logic in createSocialPost (posts.ts lines 124-130).
 * This is the "compositor" path — manual post creation via the UI.
 */
function compositorFormat(provider: string, storyMode: boolean): string {
  return provider === 'instagram' && storyMode
    ? 'story'
    : provider === 'instagram'
      ? 'image_post'
      : provider === 'bluesky'
        ? 'link_card'
        : 'link_share'
}

/**
 * Replicates the format logic in createSocialPostFromContent
 * (create-from-content.ts lines 159-161).
 * This is the "content" path — auto-creation from blog/newsletter/campaign.
 */
function contentPathFormat(
  contentType: ContentType,
  provider: Provider,
  configFormats: Partial<Record<string, DeliveryFormat>> = {},
): DeliveryFormat {
  return (
    (configFormats[provider] as DeliveryFormat) ??
    CONTENT_FORMAT_MAP[contentType]?.[provider] ??
    'link_share'
  )
}

// ---------------------------------------------------------------------------
// Valid DeliveryFormat values (from types.ts)
// ---------------------------------------------------------------------------

const VALID_FORMATS: DeliveryFormat[] = [
  'link_share',
  'image_post',
  'story',
  'reel',
  'link_card',
  'video_share',
]

// ===================================================================
// 1. Facebook destination -> format 'link_share'
// ===================================================================

describe('Facebook destination -> link_share', () => {
  it('compositor path assigns link_share for facebook', () => {
    expect(compositorFormat('facebook', false)).toBe('link_share')
  })

  it('compositor path assigns link_share for facebook even with storyMode=true', () => {
    // storyMode only affects Instagram
    expect(compositorFormat('facebook', true)).toBe('link_share')
  })

  it('content path assigns link_share for blog->facebook', () => {
    expect(contentPathFormat('blog', 'facebook')).toBe('link_share')
  })

  it('content path assigns link_share for newsletter->facebook', () => {
    expect(contentPathFormat('newsletter', 'facebook')).toBe('link_share')
  })

  it('content path assigns link_share for campaign->facebook', () => {
    expect(contentPathFormat('campaign', 'facebook')).toBe('link_share')
  })

  it('content path assigns video_share for video->facebook', () => {
    expect(contentPathFormat('video', 'facebook')).toBe('video_share')
  })

  it('fb_page destination maps to facebook provider', () => {
    expect(DESTINATIONS.fb_page.provider).toBe('facebook')
  })
})

// ===================================================================
// 2. Instagram story destination -> format 'story'
// ===================================================================

describe('Instagram story destination -> story', () => {
  it('compositor path assigns story when storyMode=true', () => {
    expect(compositorFormat('instagram', true)).toBe('story')
  })

  it('content path assigns story for blog->instagram (default map)', () => {
    expect(contentPathFormat('blog', 'instagram')).toBe('story')
  })

  it('content path assigns story for newsletter->instagram', () => {
    expect(contentPathFormat('newsletter', 'instagram')).toBe('story')
  })

  it('content path assigns story for campaign->instagram', () => {
    expect(contentPathFormat('campaign', 'instagram')).toBe('story')
  })

  it('ig_story destination maps to instagram provider', () => {
    expect(DESTINATIONS.ig_story.provider).toBe('instagram')
  })

  it('ig_story has 0 captionLimit (text lives in the art)', () => {
    expect(DESTINATIONS.ig_story.captionLimit).toBe(0)
  })
})

// ===================================================================
// 3. Instagram feed destination -> format 'image_post'
// ===================================================================

describe('Instagram feed destination -> image_post', () => {
  it('compositor path returns "image_post" for instagram without storyMode', () => {
    const result = compositorFormat('instagram', false)
    expect(result).toBe('image_post')
    expect(VALID_FORMATS).toContain(result)
  })

  it('compositor path returns a valid DeliveryFormat for instagram feed', () => {
    const result = compositorFormat('instagram', false)
    expect(VALID_FORMATS).toContain(result)
  })

  it('content path returns "story" for instagram by default', () => {
    // The content path uses CONTENT_FORMAT_MAP which correctly maps
    // blog/newsletter/campaign -> instagram -> 'story'
    const result = contentPathFormat('blog', 'instagram')
    expect(result).toBe('story')
    expect(VALID_FORMATS).toContain(result)
  })

  it('content path returns "reel" for video->instagram (valid format)', () => {
    const result = contentPathFormat('video', 'instagram')
    expect(result).toBe('reel')
    expect(VALID_FORMATS).toContain(result)
  })

  it('ig_feed destination maps to instagram provider', () => {
    expect(DESTINATIONS.ig_feed.provider).toBe('instagram')
  })

  it('ig_feed has 2200 captionLimit (like a regular feed post)', () => {
    expect(DESTINATIONS.ig_feed.captionLimit).toBe(2200)
  })
})

// ===================================================================
// 4. Bluesky destination -> format 'link_card'
// ===================================================================

describe('Bluesky destination -> link_card', () => {
  it('compositor path assigns link_card for bluesky', () => {
    expect(compositorFormat('bluesky', false)).toBe('link_card')
  })

  it('compositor path assigns link_card for bluesky even with storyMode=true', () => {
    // storyMode is Instagram-only
    expect(compositorFormat('bluesky', true)).toBe('link_card')
  })

  it('content path assigns link_card for blog->bluesky', () => {
    expect(contentPathFormat('blog', 'bluesky')).toBe('link_card')
  })

  it('content path assigns link_card for newsletter->bluesky', () => {
    expect(contentPathFormat('newsletter', 'bluesky')).toBe('link_card')
  })

  it('content path assigns link_card for video->bluesky', () => {
    // Even video content gets link_card on Bluesky (no native video embedding)
    expect(contentPathFormat('video', 'bluesky')).toBe('link_card')
  })

  it('bluesky has a destination entry (bsky_feed)', () => {
    const bsDests = Object.values(DESTINATIONS).filter(d => d.provider === 'bluesky')
    expect(bsDests).toHaveLength(1)
    expect(bsDests[0]!.id).toBe('bsky_feed')
  })
})

// ===================================================================
// 5. YouTube destination -> format mapping
// ===================================================================

describe('YouTube destination -> format mapping', () => {
  it('compositor path assigns link_share for youtube', () => {
    expect(compositorFormat('youtube', false)).toBe('link_share')
  })

  it('compositor path assigns link_share for youtube even with storyMode=true', () => {
    expect(compositorFormat('youtube', true)).toBe('link_share')
  })

  it('content path assigns link_share for blog->youtube', () => {
    expect(contentPathFormat('blog', 'youtube')).toBe('link_share')
  })

  it('content path assigns video_share for video->youtube', () => {
    expect(contentPathFormat('video', 'youtube')).toBe('video_share')
  })

  it('yt_community destination maps to youtube provider', () => {
    expect(DESTINATIONS.yt_community.provider).toBe('youtube')
  })
})

// ===================================================================
// 6. Content-based format mapping (CONTENT_FORMAT_MAP)
// ===================================================================

describe('CONTENT_FORMAT_MAP matches expectations', () => {
  const contentTypes: ContentType[] = ['blog', 'newsletter', 'campaign', 'video']
  const providers: Provider[] = ['facebook', 'instagram', 'bluesky', 'youtube']

  it('all content types have entries for all 4 providers', () => {
    for (const ct of contentTypes) {
      for (const p of providers) {
        expect(
          CONTENT_FORMAT_MAP[ct][p],
          `${ct} -> ${p} should have a mapped format`,
        ).toBeDefined()
      }
    }
  })

  it('all mapped formats are valid DeliveryFormat values', () => {
    for (const ct of contentTypes) {
      for (const p of providers) {
        const format = CONTENT_FORMAT_MAP[ct][p]
        expect(
          VALID_FORMATS,
          `${ct} -> ${p} format "${format}" should be valid`,
        ).toContain(format)
      }
    }
  })

  it('blog, newsletter, campaign share the same format map', () => {
    expect(CONTENT_FORMAT_MAP.blog).toEqual(CONTENT_FORMAT_MAP.newsletter)
    expect(CONTENT_FORMAT_MAP.blog).toEqual(CONTENT_FORMAT_MAP.campaign)
  })

  it('video has different formats from blog for facebook and instagram', () => {
    expect(CONTENT_FORMAT_MAP.video.facebook).not.toBe(CONTENT_FORMAT_MAP.blog.facebook)
    expect(CONTENT_FORMAT_MAP.video.instagram).not.toBe(CONTENT_FORMAT_MAP.blog.instagram)
  })

  it('video uses video_share for facebook and youtube', () => {
    expect(CONTENT_FORMAT_MAP.video.facebook).toBe('video_share')
    expect(CONTENT_FORMAT_MAP.video.youtube).toBe('video_share')
  })

  it('video uses reel for instagram', () => {
    expect(CONTENT_FORMAT_MAP.video.instagram).toBe('reel')
  })

  it('video uses link_card for bluesky (no native video)', () => {
    expect(CONTENT_FORMAT_MAP.video.bluesky).toBe('link_card')
  })
})

// ===================================================================
// 7. storyMode flag only affects Instagram, not other providers
// ===================================================================

describe('storyMode flag isolation', () => {
  const nonInstagramProviders = ['facebook', 'youtube', 'bluesky'] as const

  it.each(nonInstagramProviders)(
    'storyMode=true has no effect on %s',
    (provider) => {
      const withoutStory = compositorFormat(provider, false)
      const withStory = compositorFormat(provider, true)
      expect(withStory).toBe(withoutStory)
    },
  )

  it('storyMode=true changes instagram from "image_post" to "story"', () => {
    expect(compositorFormat('instagram', false)).toBe('image_post')
    expect(compositorFormat('instagram', true)).toBe('story')
  })

  it('storyMode has no concept in the content path (uses CONTENT_FORMAT_MAP)', () => {
    // The content path does not accept storyMode; it relies on
    // CONTENT_FORMAT_MAP which always maps non-video instagram to 'story'
    expect(contentPathFormat('blog', 'instagram')).toBe('story')
    expect(contentPathFormat('newsletter', 'instagram')).toBe('story')
  })
})

// ===================================================================
// 8. Multiple providers: FB+IG+BS simultaneously get correct formats
// ===================================================================

describe('multi-provider simultaneous format assignment', () => {
  const platforms: Provider[] = ['facebook', 'instagram', 'bluesky']

  it('compositor path: FB+IG+BS with storyMode=true', () => {
    const formats = platforms.map(p => ({
      provider: p,
      format: compositorFormat(p, true),
    }))
    expect(formats).toEqual([
      { provider: 'facebook', format: 'link_share' },
      { provider: 'instagram', format: 'story' },
      { provider: 'bluesky', format: 'link_card' },
    ])
  })

  it('compositor path: FB+IG+BS with storyMode=false', () => {
    const formats = platforms.map(p => ({
      provider: p,
      format: compositorFormat(p, false),
    }))
    expect(formats).toEqual([
      { provider: 'facebook', format: 'link_share' },
      { provider: 'instagram', format: 'image_post' },
      { provider: 'bluesky', format: 'link_card' },
    ])
  })

  it('content path: blog -> FB+IG+BS', () => {
    const formats = platforms.map(p => ({
      provider: p,
      format: contentPathFormat('blog', p),
    }))
    expect(formats).toEqual([
      { provider: 'facebook', format: 'link_share' },
      { provider: 'instagram', format: 'story' },
      { provider: 'bluesky', format: 'link_card' },
    ])
  })

  it('content path: all 4 providers for video content', () => {
    const allProviders: Provider[] = ['facebook', 'instagram', 'bluesky', 'youtube']
    const formats = allProviders.map(p => ({
      provider: p,
      format: contentPathFormat('video', p),
    }))
    expect(formats).toEqual([
      { provider: 'facebook', format: 'video_share' },
      { provider: 'instagram', format: 'reel' },
      { provider: 'bluesky', format: 'link_card' },
      { provider: 'youtube', format: 'video_share' },
    ])
  })

  it('each provider gets a unique or expected format (no accidental duplication)', () => {
    // For blog content, facebook and youtube both get link_share (expected),
    // but instagram and bluesky should differ from each other and from link_share
    const blogFormats = platforms.map(p => contentPathFormat('blog', p))
    // Instagram = story, Bluesky = link_card, Facebook = link_share -> all different
    expect(new Set(blogFormats).size).toBe(3)
  })
})

// ===================================================================
// 9. Format consistency: compositor and content path should produce
//    same formats for same provider (when content path uses defaults)
// ===================================================================

describe('format consistency between compositor and content paths', () => {
  it('facebook: both paths produce link_share (for non-video)', () => {
    expect(compositorFormat('facebook', false)).toBe('link_share')
    expect(contentPathFormat('blog', 'facebook')).toBe('link_share')
  })

  it('bluesky: both paths produce link_card', () => {
    expect(compositorFormat('bluesky', false)).toBe('link_card')
    expect(contentPathFormat('blog', 'bluesky')).toBe('link_card')
  })

  it('youtube: both paths produce link_share (for non-video)', () => {
    expect(compositorFormat('youtube', false)).toBe('link_share')
    expect(contentPathFormat('blog', 'youtube')).toBe('link_share')
  })

  it('instagram with storyMode=true: compositor matches content path default', () => {
    // Content path always defaults to 'story' for non-video instagram
    expect(compositorFormat('instagram', true)).toBe('story')
    expect(contentPathFormat('blog', 'instagram')).toBe('story')
  })

  it('instagram without storyMode: compositor returns "image_post", content path returns "story"', () => {
    // Compositor uses image_post for non-story Instagram feed posts,
    // while content path defaults to story for blog/newsletter/campaign.
    // Both are valid DeliveryFormats — different use cases.
    const compositorResult = compositorFormat('instagram', false)
    const contentResult = contentPathFormat('blog', 'instagram')
    expect(compositorResult).toBe('image_post')
    expect(contentResult).toBe('story')
    expect(VALID_FORMATS).toContain(compositorResult)
    expect(VALID_FORMATS).toContain(contentResult)
  })

  it('content path config.formats override takes precedence over defaults', () => {
    // When explicit format is provided in config, it wins
    const result = contentPathFormat('blog', 'facebook', { facebook: 'image_post' })
    expect(result).toBe('image_post')
  })

  it('content path config.formats override works for all providers', () => {
    const overrides: Partial<Record<string, DeliveryFormat>> = {
      facebook: 'video_share',
      instagram: 'reel',
      bluesky: 'image_post',
      youtube: 'video_share',
    }
    const providers: Provider[] = ['facebook', 'instagram', 'bluesky', 'youtube']
    for (const p of providers) {
      expect(contentPathFormat('blog', p, overrides)).toBe(overrides[p])
    }
  })
})

// ===================================================================
// 10. Unknown provider: graceful handling (no crash)
// ===================================================================

describe('unknown provider graceful handling', () => {
  it('compositor path falls through to link_share for unknown provider', () => {
    // The compositor ternary chain ends with 'link_share' as default
    expect(compositorFormat('tiktok', false)).toBe('link_share')
    expect(compositorFormat('twitter', false)).toBe('link_share')
    expect(compositorFormat('', false)).toBe('link_share')
  })

  it('content path falls back to link_share for unknown provider', () => {
    // CONTENT_FORMAT_MAP.blog has no 'tiktok' key -> undefined -> fallback 'link_share'
    const result = contentPathFormat('blog', 'tiktok' as Provider)
    expect(result).toBe('link_share')
  })

  it('content path falls back to link_share for unknown content type', () => {
    // If contentType is not in CONTENT_FORMAT_MAP, the ?. chain returns undefined -> 'link_share'
    const result = contentPathFormat('unknown' as ContentType, 'facebook')
    expect(result).toBe('link_share')
  })

  it('content path config.formats override still works for unknown provider', () => {
    const result = contentPathFormat('blog', 'tiktok' as Provider, { tiktok: 'video_share' })
    expect(result).toBe('video_share')
  })
})

// ===================================================================
// Destination -> Provider -> Format integration
// ===================================================================

describe('destination-to-format end-to-end mapping', () => {
  const destFormatExpectations: Array<{
    destId: DestId
    storyMode: boolean
    expectedCompositorFormat: string
    expectedContentFormat: DeliveryFormat
    contentType: ContentType
  }> = [
    {
      destId: 'fb_page',
      storyMode: false,
      expectedCompositorFormat: 'link_share',
      expectedContentFormat: 'link_share',
      contentType: 'blog',
    },
    {
      destId: 'ig_story',
      storyMode: true,
      expectedCompositorFormat: 'story',
      expectedContentFormat: 'story',
      contentType: 'blog',
    },
    {
      destId: 'ig_feed',
      storyMode: false,
      expectedCompositorFormat: 'image_post',
      expectedContentFormat: 'story', // content path default for non-video
      contentType: 'blog',
    },
    {
      destId: 'yt_community',
      storyMode: false,
      expectedCompositorFormat: 'link_share',
      expectedContentFormat: 'link_share',
      contentType: 'blog',
    },
  ]

  it.each(destFormatExpectations)(
    '$destId (storyMode=$storyMode): compositor=$expectedCompositorFormat, content=$expectedContentFormat',
    ({ destId, storyMode, expectedCompositorFormat, expectedContentFormat, contentType }) => {
      const dest = DESTINATIONS[destId]
      expect(compositorFormat(dest.provider, storyMode)).toBe(expectedCompositorFormat)
      expect(contentPathFormat(contentType, dest.provider as Provider)).toBe(expectedContentFormat)
    },
  )

  it('all destinations map to known providers', () => {
    const knownProviders: Provider[] = ['youtube', 'facebook', 'instagram', 'bluesky']
    for (const destId of Object.keys(DESTINATIONS) as DestId[]) {
      expect(knownProviders).toContain(DESTINATIONS[destId].provider)
    }
  })
})
