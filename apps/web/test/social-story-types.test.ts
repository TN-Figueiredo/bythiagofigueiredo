import { describe, it, expect } from 'vitest'
import {
  StorySlideSchema,
  StorySlidesSchema,
  FanInteractionSchema,
  postDataToTemplateContext,
} from '@/lib/social/story-types'
import type { SocialPostData } from '@/lib/social/story-types'

describe('StorySlideSchema', () => {
  it('validates a valid slide composition', () => {
    const slide = {
      version: 1 as const,
      canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
      background: { type: 'solid' as const, color: '#000000' },
      elements: [],
    }
    const result = StorySlideSchema.safeParse(slide)
    expect(result.success).toBe(true)
  })

  it('rejects invalid canvas dimensions', () => {
    const slide = {
      version: 1 as const,
      canvas: { width: 50, height: 50, aspectRatio: '1:1' },
      background: { type: 'solid' as const, color: '#000000' },
      elements: [],
    }
    const result = StorySlideSchema.safeParse(slide)
    expect(result.success).toBe(false)
  })
})

describe('StorySlidesSchema', () => {
  it('accepts 1 to 10 slides', () => {
    const makeSlide = () => ({
      version: 1 as const,
      canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
      background: { type: 'solid' as const, color: '#000000' },
      elements: [],
    })

    expect(StorySlidesSchema.safeParse([makeSlide()]).success).toBe(true)
    expect(StorySlidesSchema.safeParse(Array(10).fill(null).map(makeSlide)).success).toBe(true)
  })

  it('rejects more than 10 slides', () => {
    const makeSlide = () => ({
      version: 1 as const,
      canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
      background: { type: 'solid' as const, color: '#000000' },
      elements: [],
    })
    expect(StorySlidesSchema.safeParse(Array(11).fill(null).map(makeSlide)).success).toBe(false)
  })

  it('rejects empty array', () => {
    expect(StorySlidesSchema.safeParse([]).success).toBe(false)
  })
})

describe('FanInteractionSchema', () => {
  it('validates a valid interaction', () => {
    const interaction = {
      site_id: '00000000-0000-0000-0000-000000000001',
      visitor_hash: 'abc123',
      platform: 'instagram',
      interaction_type: 'story_view',
    }
    expect(FanInteractionSchema.safeParse(interaction).success).toBe(true)
  })
})

describe('postDataToTemplateContext', () => {
  it('maps SocialPostData camelCase to TemplateContext snake_case', () => {
    const postData: SocialPostData = {
      title: 'Test Title',
      description: 'Test Desc',
      coverImageUrl: 'https://example.com/cover.jpg',
      logoUrl: 'https://example.com/logo.png',
      shortUrl: 'go.btf.com/abc123',
    }
    const context = postDataToTemplateContext(postData)
    expect(context).toEqual({
      title: 'Test Title',
      description: 'Test Desc',
      cover_image: 'https://example.com/cover.jpg',
      logo: 'https://example.com/logo.png',
      short_url: 'go.btf.com/abc123',
    })
  })

  it('handles missing optional fields', () => {
    const postData: SocialPostData = { title: 'Test' }
    const context = postDataToTemplateContext(postData)
    expect(context.title).toBe('Test')
    expect(context.cover_image).toBeUndefined()
  })
})
