import { describe, it, expect } from 'vitest'
// Use relative path — @/ alias doesn't resolve parenthesized route groups in Vite
import { reorderSlides, duplicateSlide, removeSlide, addEmptySlide } from '../src/app/cms/(authed)/social/stories/_components/slide-strip'
import type { CardComposition } from '@tn-figueiredo/links/qr'

const makeSlide = (id?: string): CardComposition => ({
  version: 1,
  canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
  background: { type: 'solid', color: id ?? '#000000' },
  elements: [],
})

describe('slide operations', () => {
  it('reorders slides correctly', () => {
    const slides = [makeSlide('a'), makeSlide('b'), makeSlide('c')]
    const result = reorderSlides(slides, 0, 2)
    expect((result[0].background as { color: string }).color).toBe('b')
    expect((result[2].background as { color: string }).color).toBe('a')
  })

  it('duplicates a slide', () => {
    const slides = [makeSlide('a'), makeSlide('b')]
    const result = duplicateSlide(slides, 0)
    expect(result).toHaveLength(3)
    expect((result[1].background as { color: string }).color).toBe('a')
  })

  it('rejects duplicate when at max 10', () => {
    const slides = Array(10).fill(null).map(() => makeSlide())
    const result = duplicateSlide(slides, 0)
    expect(result).toHaveLength(10)
  })

  it('removes a slide', () => {
    const slides = [makeSlide('a'), makeSlide('b'), makeSlide('c')]
    const result = removeSlide(slides, 1)
    expect(result).toHaveLength(2)
    expect((result[1].background as { color: string }).color).toBe('c')
  })

  it('prevents removing last slide', () => {
    const slides = [makeSlide('a')]
    const result = removeSlide(slides, 0)
    expect(result).toHaveLength(1)
  })

  it('adds an empty slide', () => {
    const slides = [makeSlide()]
    const result = addEmptySlide(slides)
    expect(result).toHaveLength(2)
    expect(result[1].canvas.aspectRatio).toBe('9:16')
  })
})
