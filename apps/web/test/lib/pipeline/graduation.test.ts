import { describe, it, expect, vi } from 'vitest'
import {
  isSocialConfigComplete,
  buildPipelineSnapshot,
} from '@/lib/pipeline/graduation'
import type { PipelineItem } from '@/lib/pipeline/graduation'
import { PIPELINE_FORMAT_TO_CONTENT_TYPE } from '@/lib/social/types'
import type { SocialConfig } from '@/lib/social/types'

function baseConfig(overrides?: Partial<SocialConfig>): SocialConfig {
  return {
    enabled: true,
    platforms: ['facebook'],
    captions: { facebook: { pt: 'Test caption' } },
    hashtags: ['#test'],
    image_source: 'og_image',
    ig_template: 'card',
    formats: {},
    ...overrides,
  }
}

function baseItem(overrides?: Partial<PipelineItem>): PipelineItem {
  return {
    id: 'item-1',
    code: 'VID-001',
    format: 'video',
    stage: 'published',
    language: 'pt-br',
    title_pt: 'Titulo PT',
    title_en: 'Title EN',
    hook: 'A great hook',
    synopsis: 'Synopsis text',
    tags: ['ai', 'tech'],
    category: 'building',
    cover_image_url: 'https://example.com/cover.jpg',
    sections: { idea: { content: { hook: 'hook' } } },
    format_metadata: { duration_estimate_min: 10 },
    social_config: baseConfig(),
    blog_post_id: null,
    newsletter_edition_id: null,
    campaign_id: null,
    youtube_video_id: 'yt-123',
    social_post_id: null,
    version: 3,
    created_by: 'user-1',
    ...overrides,
  }
}

describe('isSocialConfigComplete', () => {
  it('returns false for null config', () => {
    expect(isSocialConfigComplete(null)).toBe(false)
  })

  it('returns false when enabled is false', () => {
    expect(isSocialConfigComplete(baseConfig({ enabled: false }))).toBe(false)
  })

  it('returns false when platforms is empty', () => {
    expect(isSocialConfigComplete(baseConfig({ platforms: [] }))).toBe(false)
  })

  it('returns false when captions object is missing for a platform', () => {
    expect(
      isSocialConfigComplete(
        baseConfig({ platforms: ['facebook'], captions: {} }),
      ),
    ).toBe(false)
  })

  it('returns false when caption is empty string', () => {
    expect(
      isSocialConfigComplete(
        baseConfig({
          platforms: ['facebook'],
          captions: { facebook: { pt: '' } },
        }),
      ),
    ).toBe(false)
  })

  it('returns false when caption is whitespace only', () => {
    expect(
      isSocialConfigComplete(
        baseConfig({
          platforms: ['facebook'],
          captions: { facebook: { pt: '   ' } },
        }),
      ),
    ).toBe(false)
  })

  it('returns true for a valid single-platform config', () => {
    expect(
      isSocialConfigComplete(
        baseConfig({
          platforms: ['facebook'],
          captions: { facebook: { pt: 'Hello' } },
          hashtags: [],
          image_source: 'og_image',
          ig_template: 'card',
          formats: {},
        }),
      ),
    ).toBe(true)
  })

  it('returns true for valid multi-platform config', () => {
    expect(
      isSocialConfigComplete(
        baseConfig({
          platforms: ['facebook', 'bluesky'],
          captions: { facebook: { pt: 'FB' }, bluesky: { pt: 'BS' } },
        }),
      ),
    ).toBe(true)
  })

  it('returns false when captions is undefined', () => {
    const config = { ...baseConfig(), captions: undefined as unknown as SocialConfig['captions'] }
    expect(isSocialConfigComplete(config)).toBe(false)
  })

  it('returns false when multi-platform has one missing caption', () => {
    expect(
      isSocialConfigComplete(
        baseConfig({
          platforms: ['facebook', 'bluesky'],
          captions: { facebook: { pt: 'FB' } },
        }),
      ),
    ).toBe(false)
  })

  it('accepts config where only en caption is provided', () => {
    expect(
      isSocialConfigComplete(
        baseConfig({
          platforms: ['facebook'],
          captions: { facebook: { en: 'English only' } },
        }),
      ),
    ).toBe(true)
  })
})

describe('buildPipelineSnapshot', () => {
  it('returns all expected fields from a full item', () => {
    const item = baseItem()
    const snapshot = buildPipelineSnapshot(item, 'user-42')

    expect(snapshot.pipeline_id).toBe('item-1')
    expect(snapshot.code).toBe('VID-001')
    expect(snapshot.format).toBe('video')
    expect(snapshot.stage).toBe('published')
    expect(snapshot.language).toBe('pt-br')
    expect(snapshot.title_pt).toBe('Titulo PT')
    expect(snapshot.title_en).toBe('Title EN')
    expect(snapshot.hook).toBe('A great hook')
    expect(snapshot.synopsis).toBe('Synopsis text')
    expect(snapshot.tags).toEqual(['ai', 'tech'])
    expect(snapshot.category).toBe('building')
    expect(snapshot.cover_image_url).toBe('https://example.com/cover.jpg')
    expect(snapshot.sections).toEqual({ idea: { content: { hook: 'hook' } } })
    expect(snapshot.format_metadata).toEqual({ duration_estimate_min: 10 })
    expect(snapshot.blog_post_id).toBeNull()
    expect(snapshot.newsletter_edition_id).toBeNull()
    expect(snapshot.campaign_id).toBeNull()
    expect(snapshot.youtube_video_id).toBe('yt-123')
    expect(snapshot.version).toBe(3)
  })

  it('defaults null sections to empty object', () => {
    const item = baseItem({ sections: null })
    const snapshot = buildPipelineSnapshot(item, 'user-1')
    expect(snapshot.sections).toEqual({})
  })

  it('preserves null optional fields', () => {
    const item = baseItem({
      title_pt: null,
      title_en: null,
      hook: null,
      synopsis: null,
      category: null,
      cover_image_url: null,
      blog_post_id: null,
      youtube_video_id: null,
    })
    const snapshot = buildPipelineSnapshot(item, 'user-1')
    expect(snapshot.title_pt).toBeNull()
    expect(snapshot.title_en).toBeNull()
    expect(snapshot.hook).toBeNull()
    expect(snapshot.synopsis).toBeNull()
    expect(snapshot.category).toBeNull()
    expect(snapshot.cover_image_url).toBeNull()
    expect(snapshot.blog_post_id).toBeNull()
    expect(snapshot.youtube_video_id).toBeNull()
  })

  it('sets graduated_at to an ISO timestamp', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-14T12:00:00.000Z'))

    const snapshot = buildPipelineSnapshot(baseItem(), 'user-1')
    expect(snapshot.graduated_at).toBe('2026-05-14T12:00:00.000Z')

    vi.useRealTimers()
  })

  it('sets graduated_by to the provided userId', () => {
    const snapshot = buildPipelineSnapshot(baseItem(), 'user-abc-123')
    expect(snapshot.graduated_by).toBe('user-abc-123')
  })

  it('sets version from item', () => {
    const snapshot = buildPipelineSnapshot(baseItem({ version: 7 }), 'user-1')
    expect(snapshot.version).toBe(7)
  })
})

describe('PIPELINE_FORMAT_TO_CONTENT_TYPE', () => {
  it('maps blog_post to blog', () => {
    expect(PIPELINE_FORMAT_TO_CONTENT_TYPE['blog_post']).toBe('blog')
  })

  it('maps newsletter to newsletter', () => {
    expect(PIPELINE_FORMAT_TO_CONTENT_TYPE['newsletter']).toBe('newsletter')
  })

  it('maps campaign to campaign', () => {
    expect(PIPELINE_FORMAT_TO_CONTENT_TYPE['campaign']).toBe('campaign')
  })

  it('maps video to video', () => {
    expect(PIPELINE_FORMAT_TO_CONTENT_TYPE['video']).toBe('video')
  })

  it('returns undefined for unmapped format', () => {
    expect(PIPELINE_FORMAT_TO_CONTENT_TYPE['course']).toBeUndefined()
  })
})
