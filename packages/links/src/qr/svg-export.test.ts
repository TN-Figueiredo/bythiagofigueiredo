import { describe, it, expect } from 'vitest'
import { compositionToSvg } from './svg-export.js'
import type { CardComposition } from './card-composition.js'

describe('compositionToSvg', () => {
  const base: CardComposition = {
    version: 1,
    canvas: { width: 500, height: 500, aspectRatio: '1:1' },
    background: { type: 'solid', color: '#ffffff' },
    elements: [],
  }

  it('produces valid SVG with correct dimensions', () => {
    const svg = compositionToSvg(base)
    expect(svg).toContain('width="500"')
    expect(svg).toContain('height="500"')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('renders solid background', () => {
    const svg = compositionToSvg(base)
    expect(svg).toContain('fill="#ffffff"')
  })

  it('renders gradient background', () => {
    const comp: CardComposition = {
      ...base,
      background: {
        type: 'gradient',
        angle: 90,
        stops: [
          { color: '#ff0000', position: 0 },
          { color: '#0000ff', position: 1 },
        ],
      },
    }
    const svg = compositionToSvg(comp)
    expect(svg).toContain('linearGradient')
    expect(svg).toContain('#ff0000')
    expect(svg).toContain('#0000ff')
  })

  it('renders image background with fallback', () => {
    const comp: CardComposition = {
      ...base,
      background: {
        type: 'image',
        url: 'https://example.com/bg.jpg',
        fallbackColor: '#cccccc',
      },
    }
    const svg = compositionToSvg(comp)
    expect(svg).toContain('fill="#cccccc"')
    expect(svg).toContain('https://example.com/bg.jpg')
  })

  it('renders text element', () => {
    const comp: CardComposition = {
      ...base,
      elements: [{
        id: 't1', type: 'text', x: 10, y: 20, width: 200, height: 40,
        rotation: 0, opacity: 1, locked: false,
        content: 'Hello World', fontFamily: 'Inter', fontSize: 24,
        fontWeight: 700, lineHeight: 1.2, letterSpacing: '0em',
        align: 'left', color: '#333333', uppercase: false,
      }],
    }
    const svg = compositionToSvg(comp)
    expect(svg).toContain('Hello World')
    expect(svg).toContain('font-family="Inter"')
    expect(svg).toContain('font-weight="700"')
    expect(svg).toContain('fill="#333333"')
  })

  it('applies uppercase to text', () => {
    const comp: CardComposition = {
      ...base,
      elements: [{
        id: 't1', type: 'text', x: 0, y: 0, width: 200, height: 40,
        rotation: 0, opacity: 1, locked: false,
        content: 'hello', fontFamily: 'Inter', fontSize: 24,
        fontWeight: 400, lineHeight: 1.2, letterSpacing: '0em',
        align: 'left', color: '#000000', uppercase: true,
      }],
    }
    const svg = compositionToSvg(comp)
    expect(svg).toContain('HELLO')
  })

  it('renders image element', () => {
    const comp: CardComposition = {
      ...base,
      elements: [{
        id: 'i1', type: 'image', x: 50, y: 50, width: 200, height: 200,
        rotation: 0, opacity: 0.8, locked: false,
        src: 'https://example.com/photo.png', objectFit: 'cover',
        borderRadius: 0, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      }],
    }
    const svg = compositionToSvg(comp)
    expect(svg).toContain('https://example.com/photo.png')
    expect(svg).toContain('opacity="0.8"')
  })

  it('applies rotation transform', () => {
    const comp: CardComposition = {
      ...base,
      elements: [{
        id: 't1', type: 'text', x: 100, y: 100, width: 200, height: 40,
        rotation: 45, opacity: 1, locked: false,
        content: 'Rotated', fontFamily: 'Inter', fontSize: 24,
        fontWeight: 400, lineHeight: 1.2, letterSpacing: '0em',
        align: 'left', color: '#000000', uppercase: false,
      }],
    }
    const svg = compositionToSvg(comp)
    expect(svg).toContain('rotate(45,')
  })

  it('includes canvas clip path', () => {
    const svg = compositionToSvg(base)
    expect(svg).toContain('clipPath')
    expect(svg).toContain('canvas-clip')
  })

  it('escapes XML special characters in text', () => {
    const comp: CardComposition = {
      ...base,
      elements: [{
        id: 't1', type: 'text', x: 0, y: 0, width: 200, height: 40,
        rotation: 0, opacity: 1, locked: false,
        content: '<script>alert("xss")</script>', fontFamily: 'Inter',
        fontSize: 24, fontWeight: 400, lineHeight: 1.2, letterSpacing: '0em',
        align: 'left', color: '#000000', uppercase: false,
      }],
    }
    const svg = compositionToSvg(comp)
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })

  it('preserves element z-order (first = bottom)', () => {
    const comp: CardComposition = {
      ...base,
      elements: [
        {
          id: 't1', type: 'text', x: 0, y: 0, width: 200, height: 40,
          rotation: 0, opacity: 1, locked: false,
          content: 'Bottom', fontFamily: 'Inter', fontSize: 24,
          fontWeight: 400, lineHeight: 1.2, letterSpacing: '0em',
          align: 'left', color: '#000000', uppercase: false,
        },
        {
          id: 't2', type: 'text', x: 0, y: 0, width: 200, height: 40,
          rotation: 0, opacity: 1, locked: false,
          content: 'Top', fontFamily: 'Inter', fontSize: 24,
          fontWeight: 400, lineHeight: 1.2, letterSpacing: '0em',
          align: 'left', color: '#000000', uppercase: false,
        },
      ],
    }
    const svg = compositionToSvg(comp)
    const bottomIdx = svg.indexOf('Bottom')
    const topIdx = svg.indexOf('Top')
    expect(bottomIdx).toBeLessThan(topIdx)
  })
})
