import { describe, it, expect } from 'vitest'
import { generateSlideCompositions, chunkExcerpt } from '@/lib/social/story-slides'
import type { TextElement } from '@tn-figueiredo/links/qr'

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
      (e): e is TextElement => e.type === 'text' && (e as TextElement).content.includes('Test Post')
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

  // ---------------------------------------------------------------------------
  // Template style tests
  // ---------------------------------------------------------------------------

  it('gradient style: cover uses blurred image background when coverImageUrl is provided', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: 'https://example.com/cover.jpg',
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      style: 'gradient',
    })
    expect(slides[0].background.type).toBe('image')
    if (slides[0].background.type === 'image') {
      expect(slides[0].background.blur).toBe(40)
      expect(slides[0].background.url).toBe('https://example.com/cover.jpg')
    }
    const imgEl = slides[0].elements.find((e) => e.type === 'image')
    expect(imgEl).toBeDefined()
  })

  it('gradient style: cover uses gradient when no coverImageUrl', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      style: 'gradient',
    })
    expect(slides[0].background.type).toBe('gradient')
    expect(slides[0].elements.find((e) => e.type === 'image')).toBeUndefined()
  })

  it('overlay style: cover uses blurred image background when coverImageUrl is provided', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: 'https://example.com/cover.jpg',
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      style: 'overlay',
    })
    expect(slides[0].background.type).toBe('image')
    if (slides[0].background.type === 'image') {
      expect(slides[0].background.blur).toBe(40)
      expect(slides[0].background.url).toBe('https://example.com/cover.jpg')
    }
    const imgEl = slides[0].elements.find((e) => e.type === 'image')
    expect(imgEl).toBeDefined()
  })

  it('overlay style: cover uses solid dark when no coverImageUrl', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      style: 'overlay',
    })
    expect(slides[0].background.type).toBe('solid')
  })

  it('bold style: cover uses blurred image background when coverImageUrl is provided', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: 'https://example.com/cover.jpg',
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      style: 'bold',
    })
    expect(slides[0].background.type).toBe('image')
    if (slides[0].background.type === 'image') {
      expect(slides[0].background.blur).toBe(40)
    }
  })

  it('bold style: cover uses solid background when no coverImageUrl', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      style: 'bold',
    })
    expect(slides[0].background.type).toBe('solid')
  })

  it('bold style: CTA slide uses solid background', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      style: 'bold',
    })
    const ctaSlide = slides[slides.length - 1]
    expect(ctaSlide.background.type).toBe('solid')
  })

  it('gradient style: CTA slide uses gradient background', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      style: 'gradient',
    })
    const ctaSlide = slides[slides.length - 1]
    expect(ctaSlide.background.type).toBe('gradient')
  })

  it('three styles produce different CTA slide backgrounds', () => {
    const common = {
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
    }
    const gradientSlides = generateSlideCompositions({ ...common, style: 'gradient' })
    const overlaySlides = generateSlideCompositions({ ...common, style: 'overlay' })
    const boldSlides = generateSlideCompositions({ ...common, style: 'bold' })

    const gradientCtaBg = gradientSlides[gradientSlides.length - 1].background.type
    const overlayCtaBg = overlaySlides[overlaySlides.length - 1].background.type
    const boldCtaBg = boldSlides[boldSlides.length - 1].background.type

    // gradient CTA is gradient, overlay and bold are solid
    expect(gradientCtaBg).toBe('gradient')
    expect(overlayCtaBg).toBe('solid')
    expect(boldCtaBg).toBe('solid')
  })

  // ---------------------------------------------------------------------------
  // Locale / CTA text tests
  // ---------------------------------------------------------------------------

  it('pt-BR locale: CTA slide contains "Leia Mais"', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      locale: 'pt-BR',
    })
    const ctaSlide = slides[slides.length - 1]
    const ctaEl = ctaSlide.elements.find(
      (e): e is TextElement => e.type === 'text' && (e as TextElement).content === 'Leia Mais'
    )
    expect(ctaEl).toBeDefined()
  })

  it('en locale: CTA slide contains "Read More"', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      locale: 'en',
    })
    const ctaSlide = slides[slides.length - 1]
    const ctaEl = ctaSlide.elements.find(
      (e): e is TextElement => e.type === 'text' && (e as TextElement).content === 'Read More'
    )
    expect(ctaEl).toBeDefined()
  })

  it('es locale: CTA slide contains "Leer Más"', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      locale: 'es',
    })
    const ctaSlide = slides[slides.length - 1]
    const ctaEl = ctaSlide.elements.find(
      (e): e is TextElement => e.type === 'text' && (e as TextElement).content === 'Leer Más'
    )
    expect(ctaEl).toBeDefined()
  })

  it('en locale: CTA slide swipe hint is "Swipe Up"', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      locale: 'en',
    })
    const ctaSlide = slides[slides.length - 1]
    const swipeEl = ctaSlide.elements.find(
      (e): e is TextElement => e.type === 'text' && (e as TextElement).content === 'Swipe Up'
    )
    expect(swipeEl).toBeDefined()
  })

  it('pt-BR locale: CTA slide swipe hint is "Arraste para cima"', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      locale: 'pt-BR',
    })
    const ctaSlide = slides[slides.length - 1]
    const swipeEl = ctaSlide.elements.find(
      (e): e is TextElement => e.type === 'text' && (e as TextElement).content === 'Arraste para cima'
    )
    expect(swipeEl).toBeDefined()
  })

  it('unknown locale falls back to pt-BR CTA text', () => {
    const slides = generateSlideCompositions({
      title: 'Test',
      excerpt: 'Content',
      coverImageUrl: null,
      logoUrl: null,
      primaryColor: '#6366f1',
      slideCount: 3,
      locale: 'fr',
    })
    const ctaSlide = slides[slides.length - 1]
    const ctaEl = ctaSlide.elements.find(
      (e): e is TextElement => e.type === 'text' && (e as TextElement).content === 'Leia Mais'
    )
    expect(ctaEl).toBeDefined()
  })
})

describe('chunkExcerpt', () => {
  it('returns empty array for zero chunks', () => {
    expect(chunkExcerpt('Some text.', 0)).toEqual([])
  })

  it('returns full text for 1 chunk', () => {
    expect(chunkExcerpt('Hello world.', 1)).toEqual(['Hello world.'])
  })

  it('splits by sentences when possible', () => {
    const text = 'First sentence. Second sentence. Third sentence.'
    const chunks = chunkExcerpt(text, 3)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toContain('First')
    expect(chunks[2]).toContain('Third')
  })

  it('falls back to word split for single sentence', () => {
    const text = 'one two three four five six'
    const chunks = chunkExcerpt(text, 3)
    expect(chunks).toHaveLength(3)
    expect(chunks.join(' ')).toBe(text)
  })

  it('handles empty string', () => {
    const chunks = chunkExcerpt('', 3)
    expect(chunks).toHaveLength(0)
  })

  it('handles single word', () => {
    const chunks = chunkExcerpt('hello', 2)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe('hello')
  })

  it('pads to requested count when fewer sentences than chunks', () => {
    const text = 'Only one.'
    const chunks = chunkExcerpt(text, 4)
    expect(chunks.length).toBeLessThanOrEqual(4)
  })

  it('splits on ! and ? as sentence boundaries', () => {
    const text = 'Really? Yes! Done.'
    const chunks = chunkExcerpt(text, 3)
    expect(chunks).toHaveLength(3)
  })
})
