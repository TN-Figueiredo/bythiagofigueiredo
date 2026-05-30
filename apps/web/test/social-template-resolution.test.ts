import { describe, it, expect } from 'vitest'
import {
  CONTENT_TYPES,
  type ContentType,
  type SocialTemplate,
} from '@/lib/social/template-schemas'
import { DESTINATIONS, type DestId } from '@/lib/social/destinations'

describe('ContentType', () => {
  it('includes blog, newsletter, video, generic', () => {
    expect(CONTENT_TYPES).toEqual(['blog', 'newsletter', 'video', 'generic'])
  })

  it('SocialTemplate interface has slug and content_type fields', () => {
    const template: SocialTemplate = {
      id: 'test',
      site_id: null,
      name: 'Test',
      slug: 'test-slug',
      content_type: 'blog',
      aspect_ratio: '9:16',
      composition: {
        version: 1,
        canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
        background: { type: 'solid', color: '#000000' },
        elements: [],
      },
      thumbnail_url: null,
      is_default: false,
      created_at: '',
      updated_at: '',
    }
    expect(template.slug).toBe('test-slug')
    expect(template.content_type).toBe('blog')
  })
})

describe('DEST_TO_SLUG_PREFIX', () => {
  it('maps each destId to the correct slug prefix', () => {
    const DEST_TO_SLUG_PREFIX: Record<DestId, string> = {
      ig_story: 'ig-story',
      ig_feed: 'ig-feed',
      fb_page: 'fb',
      yt_community: 'yt',
    }

    expect(DEST_TO_SLUG_PREFIX.ig_story).toBe('ig-story')
    expect(DEST_TO_SLUG_PREFIX.ig_feed).toBe('ig-feed')
    expect(DEST_TO_SLUG_PREFIX.fb_page).toBe('fb')
    expect(DEST_TO_SLUG_PREFIX.yt_community).toBe('yt')
  })

  it('generates correct slug for each dest+contentType combo', () => {
    function buildSlug(destId: DestId, contentType: string): string {
      const DEST_TO_SLUG_PREFIX: Record<DestId, string> = {
        ig_story: 'ig-story',
        ig_feed: 'ig-feed',
        fb_page: 'fb',
        yt_community: 'yt',
      }
      return `${DEST_TO_SLUG_PREFIX[destId]}-${contentType}`
    }

    expect(buildSlug('ig_story', 'blog')).toBe('ig-story-blog')
    expect(buildSlug('ig_feed', 'newsletter')).toBe('ig-feed-newsletter')
    expect(buildSlug('fb_page', 'blog')).toBe('fb-blog')
    expect(buildSlug('yt_community', 'blog')).toBe('yt-blog')
  })
})
