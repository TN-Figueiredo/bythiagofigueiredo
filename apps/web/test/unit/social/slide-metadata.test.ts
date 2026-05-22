import { describe, it, expect } from 'vitest'
import { extractSlideMetadata } from '@/lib/social/slide-metadata'

describe('extractSlideMetadata', () => {
  it('returns empty metadata for empty slides', () => {
    expect(extractSlideMetadata([])).toEqual({ title: '', coverImageUrl: undefined })
  })

  it('returns empty metadata for non-object slides', () => {
    expect(extractSlideMetadata([null, 'string', 42])).toEqual({ title: '', coverImageUrl: undefined })
  })

  it('extracts coverImageUrl from image background', () => {
    const slides = [{
      background: { type: 'image', url: 'https://blob.vercel-storage.com/cover.jpg', fallbackColor: '#0a0a0a', blur: 40 },
      elements: [],
    }]
    const result = extractSlideMetadata(slides)
    expect(result.coverImageUrl).toBe('https://blob.vercel-storage.com/cover.jpg')
  })

  it('extracts coverImageUrl from first image element when background is not image', () => {
    const slides = [{
      background: { type: 'solid', color: '#0a0a0a' },
      elements: [
        { type: 'text', content: 'Title', fontSize: 64 },
        { type: 'image', src: 'https://blob.vercel-storage.com/photo.jpg' },
      ],
    }]
    const result = extractSlideMetadata(slides)
    expect(result.coverImageUrl).toBe('https://blob.vercel-storage.com/photo.jpg')
  })

  it('prefers background image URL over element image', () => {
    const slides = [{
      background: { type: 'image', url: 'https://blob.vercel-storage.com/bg.jpg' },
      elements: [
        { type: 'image', src: 'https://blob.vercel-storage.com/element.jpg' },
      ],
    }]
    const result = extractSlideMetadata(slides)
    expect(result.coverImageUrl).toBe('https://blob.vercel-storage.com/bg.jpg')
  })

  it('extracts title from largest text element', () => {
    const slides = [{
      background: { type: 'solid', color: '#000' },
      elements: [
        { type: 'text', content: 'Small label', fontSize: 24 },
        { type: 'text', content: 'Main Title', fontSize: 64 },
        { type: 'text', content: 'Medium text', fontSize: 36 },
      ],
    }]
    const result = extractSlideMetadata(slides)
    expect(result.title).toBe('Main Title')
  })

  it('skips placeholder text elements', () => {
    const slides = [{
      background: { type: 'solid', color: '#000' },
      elements: [
        { type: 'text', content: '{{title}}', fontSize: 64 },
        { type: 'text', content: 'Actual Title', fontSize: 48 },
      ],
    }]
    const result = extractSlideMetadata(slides)
    expect(result.title).toBe('Actual Title')
  })

  it('ignores non-http image URLs', () => {
    const slides = [{
      background: { type: 'image', url: 'data:image/png;base64,...' },
      elements: [
        { type: 'image', src: 'blob:something' },
      ],
    }]
    const result = extractSlideMetadata(slides)
    expect(result.coverImageUrl).toBeUndefined()
  })

  it('handles real-world cover slide composition', () => {
    const slides = [{
      version: 1,
      canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
      background: { type: 'image', url: 'https://xxxx.public.blob.vercel-storage.com/cover.jpg', fallbackColor: '#0a0a0a', blur: 40, mediaType: 'image' },
      elements: [
        { id: 'img-1', type: 'image', src: 'https://xxxx.public.blob.vercel-storage.com/cover.jpg', x: 0, y: 0, width: 1080, height: 810, objectFit: 'cover' },
        { id: 'txt-1', type: 'text', content: 'Corondelet Travel Guide', x: 80, y: 910, width: 920, height: 400, fontSize: 64, fontWeight: 700 },
        { id: 'txt-2', type: 'text', content: 'bythiagofigueiredo.com', x: 80, y: 1600, width: 920, height: 60, fontSize: 24 },
      ],
    }]
    const result = extractSlideMetadata(slides)
    expect(result.title).toBe('Corondelet Travel Guide')
    expect(result.coverImageUrl).toBe('https://xxxx.public.blob.vercel-storage.com/cover.jpg')
  })

  it('only inspects the first slide', () => {
    const slides = [
      { background: { type: 'solid', color: '#000' }, elements: [{ type: 'text', content: 'First', fontSize: 40 }] },
      { background: { type: 'image', url: 'https://example.com/second.jpg' }, elements: [{ type: 'text', content: 'Second', fontSize: 64 }] },
    ]
    const result = extractSlideMetadata(slides)
    expect(result.title).toBe('First')
    expect(result.coverImageUrl).toBeUndefined()
  })
})
