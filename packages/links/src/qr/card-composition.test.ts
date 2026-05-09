import { describe, it, expect } from 'vitest'
import {
  CardCompositionSchema,
  ASPECT_RATIO_PRESETS,
  AVAILABLE_FONTS,
  createDefaultComposition,
  createQrElement,
  createTextElement,
  createImageElement,
  migrateLegacyQrConfig,
  nextElementName,
} from './card-composition.js'

describe('CardCompositionSchema', () => {
  const validComposition = {
    version: 1,
    canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
    background: { type: 'solid' as const, color: '#ffffff' },
    elements: [],
  }

  it('accepts a valid empty composition', () => {
    const result = CardCompositionSchema.safeParse(validComposition)
    expect(result.success).toBe(true)
  })

  it('accepts composition with QR element', () => {
    const comp = {
      ...validComposition,
      elements: [{
        id: 'qr-1', type: 'qr', x: 100, y: 100, width: 200, height: 200,
        rotation: 0, opacity: 1, locked: false,
        foregroundColor: '#000000', backgroundColor: '#ffffff',
        errorCorrection: 'M', cornerRadius: 0, maintainAspectRatio: true as const,
      }],
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('accepts composition with text element', () => {
    const comp = {
      ...validComposition,
      elements: [{
        id: 'txt-1', type: 'text', x: 10, y: 10, width: 300, height: 40,
        rotation: 0, opacity: 1, locked: false,
        content: 'Hello', fontFamily: 'Inter', fontSize: 24, fontWeight: 400,
        lineHeight: 1.2, letterSpacing: '0em', align: 'left', color: '#000000',
        uppercase: false,
      }],
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('accepts composition with image element', () => {
    const comp = {
      ...validComposition,
      elements: [{
        id: 'img-1', type: 'image', x: 0, y: 0, width: 500, height: 500,
        rotation: 0, opacity: 1, locked: false,
        src: 'https://example.com/img.png', objectFit: 'cover',
        borderRadius: 0, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      }],
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('accepts gradient background', () => {
    const comp = {
      ...validComposition,
      background: {
        type: 'gradient' as const,
        angle: 90,
        stops: [
          { color: '#ff0000', position: 0 },
          { color: '#0000ff', position: 1 },
        ],
      },
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('accepts image background', () => {
    const comp = {
      ...validComposition,
      background: {
        type: 'image' as const,
        url: 'https://example.com/bg.jpg',
        fallbackColor: '#cccccc',
      },
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('rejects version !== 1', () => {
    const comp = { ...validComposition, version: 2 }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })

  it('rejects canvas width below 200', () => {
    const comp = { ...validComposition, canvas: { ...validComposition.canvas, width: 100 } }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })

  it('rejects canvas width above 4096', () => {
    const comp = { ...validComposition, canvas: { ...validComposition.canvas, width: 5000 } }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })

  it('rejects more than 20 elements', () => {
    const elements = Array.from({ length: 21 }, (_, i) => ({
      id: `txt-${i}`, type: 'text' as const, x: 0, y: 0, width: 100, height: 40,
      rotation: 0, opacity: 1, locked: false,
      content: 'x', fontFamily: 'Inter', fontSize: 24, fontWeight: 400,
      lineHeight: 1.2, letterSpacing: '0em', align: 'left' as const,
      color: '#000000', uppercase: false,
    }))
    const comp = { ...validComposition, elements }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })

  it('rejects invalid hex color', () => {
    const comp = {
      ...validComposition,
      background: { type: 'solid' as const, color: 'not-a-color' },
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })

  it('rejects gradient with fewer than 2 stops', () => {
    const comp = {
      ...validComposition,
      background: {
        type: 'gradient' as const,
        angle: 0,
        stops: [{ color: '#ff0000', position: 0 }],
      },
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })
})

describe('ASPECT_RATIO_PRESETS', () => {
  it('has 6 presets', () => {
    expect(ASPECT_RATIO_PRESETS).toHaveLength(6)
  })

  it('includes Story 1080x1920', () => {
    const story = ASPECT_RATIO_PRESETS.find(p => p.label === 'Story')
    expect(story).toEqual({ name: '9:16', label: 'Story', width: 1080, height: 1920 })
  })

  it('includes Square 1080x1080', () => {
    const square = ASPECT_RATIO_PRESETS.find(p => p.label === 'Square')
    expect(square).toEqual({ name: '1:1', label: 'Square', width: 1080, height: 1080 })
  })
})

describe('AVAILABLE_FONTS', () => {
  it('has all expected fonts', () => {
    expect(AVAILABLE_FONTS.length).toBeGreaterThanOrEqual(30)
    expect(AVAILABLE_FONTS).toContain('Inter')
  })
})

describe('createDefaultComposition', () => {
  it('creates a valid composition', () => {
    const comp = createDefaultComposition()
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('defaults to Square preset', () => {
    const comp = createDefaultComposition()
    expect(comp.canvas.width).toBe(1080)
    expect(comp.canvas.height).toBe(1080)
    expect(comp.canvas.aspectRatio).toBe('1:1')
  })

  it('uses provided preset', () => {
    const comp = createDefaultComposition(ASPECT_RATIO_PRESETS[0]!)
    expect(comp.canvas.width).toBe(1080)
    expect(comp.canvas.height).toBe(1920)
  })

  it('starts with solid white background', () => {
    const comp = createDefaultComposition()
    expect(comp.background).toEqual({ type: 'solid', color: '#ffffff' })
  })

  it('starts with no elements', () => {
    const comp = createDefaultComposition()
    expect(comp.elements).toEqual([])
  })
})

describe('createQrElement', () => {
  it('centers QR in canvas', () => {
    const qr = createQrElement('qr-1', 1080, 1080)
    const size = 1080 * 0.4
    expect(qr.x).toBe((1080 - size) / 2)
    expect(qr.y).toBe((1080 - size) / 2)
    expect(qr.width).toBe(size)
    expect(qr.height).toBe(size)
  })

  it('sets type to qr', () => {
    const qr = createQrElement('qr-1', 1080, 1080)
    expect(qr.type).toBe('qr')
  })

  it('maintains aspect ratio', () => {
    const qr = createQrElement('qr-1', 1080, 1080)
    expect(qr.maintainAspectRatio).toBe(true)
  })
})

describe('createTextElement', () => {
  it('positions text near bottom', () => {
    const txt = createTextElement('txt-1', 1080, 1080)
    expect(txt.y).toBe(1080 * 0.8)
    expect(txt.type).toBe('text')
  })
})

describe('createImageElement', () => {
  it('centers image in canvas', () => {
    const img = createImageElement('img-1', 'https://example.com/img.png', 1080, 1080)
    expect(img.type).toBe('image')
    expect(img.src).toBe('https://example.com/img.png')
  })
})

describe('element name field', () => {
  it('accepts element without name', () => {
    const comp = {
      version: 1,
      canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
      background: { type: 'solid' as const, color: '#ffffff' },
      elements: [{
        id: 'qr-1', type: 'qr', x: 0, y: 0, width: 200, height: 200,
        rotation: 0, opacity: 1, locked: false,
        foregroundColor: '#000000', backgroundColor: '#ffffff',
        errorCorrection: 'M', cornerRadius: 0, maintainAspectRatio: true as const,
      }],
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('accepts element with name', () => {
    const comp = {
      version: 1,
      canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
      background: { type: 'solid' as const, color: '#ffffff' },
      elements: [{
        id: 'qr-1', name: 'My QR Code', type: 'qr', x: 0, y: 0, width: 200, height: 200,
        rotation: 0, opacity: 1, locked: false,
        foregroundColor: '#000000', backgroundColor: '#ffffff',
        errorCorrection: 'M', cornerRadius: 0, maintainAspectRatio: true as const,
      }],
    }
    const result = CardCompositionSchema.safeParse(comp)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.elements[0]!.name).toBe('My QR Code')
  })

  it('passes name through createQrElement', () => {
    const qr = createQrElement('id', 1080, 1080, 'Logo QR')
    expect(qr.name).toBe('Logo QR')
  })

  it('passes name through createTextElement', () => {
    const txt = createTextElement('id', 1080, 1080, 'Title')
    expect(txt.name).toBe('Title')
  })

  it('passes name through createImageElement', () => {
    const img = createImageElement('id', 'https://x.com/a.png', 1080, 1080, undefined, undefined, 'Hero')
    expect(img.name).toBe('Hero')
  })
})

describe('nextElementName', () => {
  it('returns base label for first element of type', () => {
    expect(nextElementName([], 'qr')).toBe('QR Code')
    expect(nextElementName([], 'text')).toBe('Text')
    expect(nextElementName([], 'image')).toBe('Image')
  })

  it('increments for subsequent elements of same type', () => {
    const elements = [
      createQrElement('1', 1080, 1080),
    ]
    expect(nextElementName(elements, 'qr')).toBe('QR Code 2')
  })

  it('counts only elements of the requested type', () => {
    const elements = [
      createQrElement('1', 1080, 1080),
      createTextElement('2', 1080, 1080),
      createImageElement('3', 'https://x.com/a.png', 1080, 1080),
      createImageElement('4', 'https://x.com/b.png', 1080, 1080),
    ]
    expect(nextElementName(elements, 'image')).toBe('Image 3')
    expect(nextElementName(elements, 'text')).toBe('Text 2')
    expect(nextElementName(elements, 'qr')).toBe('QR Code 2')
  })
})

describe('migrateLegacyQrConfig', () => {
  it('creates valid composition from legacy config', () => {
    const comp = migrateLegacyQrConfig({
      foreground: '#ff0000',
      background: '#00ff00',
      error_correction: 'H',
    })
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
    expect(comp.elements).toHaveLength(1)
    expect(comp.elements[0]!.type).toBe('qr')
  })

  it('uses legacy colors', () => {
    const comp = migrateLegacyQrConfig({ foreground: '#ff0000', background: '#00ff00' })
    const qr = comp.elements[0] as { foregroundColor: string; backgroundColor: string }
    expect(qr.foregroundColor).toBe('#ff0000')
    expect(qr.backgroundColor).toBe('#00ff00')
  })

  it('defaults to black/white when no colors provided', () => {
    const comp = migrateLegacyQrConfig({})
    const qr = comp.elements[0] as { foregroundColor: string; backgroundColor: string }
    expect(qr.foregroundColor).toBe('#000000')
    expect(qr.backgroundColor).toBe('#ffffff')
  })
})
