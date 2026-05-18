import { describe, it, expect } from 'vitest'
import { generateSlideCompositions } from '@/lib/social/story-slides'

describe('generateSlideCompositions', () => {
  it('generates 1 slide with title + cover + CTA', () => {
    const slides = generateSlideCompositions({
      title: 'Test Post',
      excerpt: 'This is a test excerpt for the post.',
      coverImageUrl: 'https://example.com/cover.jpg',
      logoUrl: 'https://example.com/logo.png',
      primaryColor: '#6366f1',
      slideCount: 1,
    })
    expect(slides).toHaveLength(1)
    expect(slides[0].canvas.aspectRatio).toBe('9:16')
    expect(slides[0].canvas.width).toBe(1080)
    expect(slides[0].canvas.height).toBe(1920)
  })

  it('generates 3 slides: cover, excerpt, CTA', () => {
    const slides = generateSlideCompositions({
      title: 'Test Post',
      excerpt: 'This is a test excerpt.',
      coverImageUrl: 'https://example.com/cover.jpg',
      logoUrl: 'https://example.com/logo.png',
      primaryColor: '#6366f1',
      slideCount: 3,
    })
    expect(slides).toHaveLength(3)
    const titleEl = slides[0].elements.find(
      (e) => e.type === 'text' && (e as any).content?.includes('Test Post')
    )
    expect(titleEl).toBeDefined()
  })

  it('generates 5 slides: cover, 3 content, CTA', () => {
    const slides = generateSlideCompositions({
      title: 'Test Post',
      excerpt: 'Point one. Point two. Point three. Extra content here.',
      coverImageUrl: 'https://example.com/cover.jpg',
      logoUrl: null,
      primaryColor: '#10b981',
      slideCount: 5,
    })
    expect(slides).toHaveLength(5)
  })

  it('clamps slide count to max 10', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Test',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#000',
      slideCount: 15,
    })
    expect(slides.length).toBeLessThanOrEqual(10)
  })
})
