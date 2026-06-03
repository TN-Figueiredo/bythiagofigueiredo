import { describe, it, expect } from 'vitest'
import { adaptContent } from '../src/lib/social/adapt-content'

describe('adaptContent', () => {
  const baseContent = {
    description: 'Default caption',
    url: 'https://go.example.com/abc',
    media_urls: ['https://blob.vercel.com/img.jpg'],
    hashtags: ['travel'],
    captions: {
      facebook: 'FB specific caption',
      instagram: 'IG specific caption',
      bluesky: 'BSky caption',
    },
  }

  it('Facebook with image → sets _photoMode, uses fb caption', () => {
    const result = adaptContent(baseContent, 'facebook', 'link_share')
    expect(result.description).toBe('FB specific caption')
    expect(result._photoMode).toBe(true)
  })

  it('Facebook without image → no _photoMode', () => {
    const result = adaptContent({ ...baseContent, media_urls: [] }, 'facebook', 'link_share')
    expect(result.description).toBe('FB specific caption')
    expect(result._photoMode).toBeUndefined()
  })

  it('Instagram feed → uses ig caption, no title', () => {
    const result = adaptContent(baseContent, 'instagram', 'image_post')
    expect(result.description).toBe('IG specific caption')
    expect(result.title).toBeUndefined()
  })

  it('Bluesky → uses bsky caption, no title', () => {
    const result = adaptContent(baseContent, 'bluesky', 'link_card')
    expect(result.description).toBe('BSky caption')
    expect(result.title).toBeUndefined()
  })

  it('falls back to description when no platform caption', () => {
    const result = adaptContent({ ...baseContent, captions: undefined }, 'facebook', 'link_share')
    expect(result.description).toBe('Default caption')
  })

  it('content_override takes precedence over captions map', () => {
    const result = adaptContent(baseContent, 'facebook', 'link_share', { description: 'Override' })
    expect(result.description).toBe('Override')
  })

  it('Facebook title not duplicated when same as description', () => {
    const result = adaptContent({ ...baseContent, title: 'FB specific caption' }, 'facebook', 'link_share')
    expect(result.title).toBeUndefined()
  })

  it('YouTube passes through unchanged (no special handling)', () => {
    const result = adaptContent(baseContent, 'youtube', 'link_share')
    // No platform caption for youtube in baseContent.captions, falls back to default
    expect(result.description).toBe('Default caption')
  })

  it('content_override can set any field', () => {
    const result = adaptContent(baseContent, 'instagram', 'image_post', { hashtags: ['override'] })
    expect(result.hashtags).toEqual(['override'])
  })

  it('does not mutate the original content', () => {
    const original = { ...baseContent }
    adaptContent(baseContent, 'instagram', 'image_post')
    expect(baseContent).toEqual(original)
  })
})
