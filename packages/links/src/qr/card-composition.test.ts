import { describe, it, expect } from 'vitest'
import {
  CardCompositionSchema,
  ASPECT_RATIO_PRESETS,
  AVAILABLE_FONTS,
  createDefaultComposition,
  createQrElement,
  createTextElement,
  createImageElement,
  createVideoElement,
  migrateLegacyQrConfig,
  nextElementName,
  QR_DOT_STYLES,
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
  it('has 4 presets', () => {
    expect(ASPECT_RATIO_PRESETS).toHaveLength(4)
  })

  it('includes Vertical 350x960', () => {
    const vertical = ASPECT_RATIO_PRESETS.find(p => p.name === 'vertical')
    expect(vertical).toEqual({ name: 'vertical', label: 'Vertical', width: 350, height: 960 })
  })

  it('includes Quadrado 1080x1080', () => {
    const square = ASPECT_RATIO_PRESETS.find(p => p.name === 'square')
    expect(square).toEqual({ name: 'square', label: 'Quadrado', width: 1080, height: 1080 })
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

  it('defaults to Quadrado preset', () => {
    const comp = createDefaultComposition()
    expect(comp.canvas.width).toBe(1080)
    expect(comp.canvas.height).toBe(1080)
    expect(comp.canvas.aspectRatio).toBe('square')
  })

  it('uses provided preset', () => {
    const comp = createDefaultComposition(ASPECT_RATIO_PRESETS[0]!)
    expect(comp.canvas.width).toBe(350)
    expect(comp.canvas.height).toBe(960)
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
    expect(nextElementName([], 'text')).toBe('Texto')
    expect(nextElementName([], 'image')).toBe('Imagem')
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
    expect(nextElementName(elements, 'image')).toBe('Imagem 3')
    expect(nextElementName(elements, 'text')).toBe('Texto 2')
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

/* ---------- helpers for new test groups ---------- */

const validComp = {
  version: 1,
  canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
  background: { type: 'solid' as const, color: '#ffffff' },
  elements: [] as unknown[],
}

function qrEl(overrides: Record<string, unknown> = {}) {
  return {
    id: 'qr-1', type: 'qr', x: 0, y: 0, width: 200, height: 200,
    rotation: 0, opacity: 1, locked: false,
    foregroundColor: '#000000', backgroundColor: '#ffffff',
    errorCorrection: 'M', cornerRadius: 0, maintainAspectRatio: true as const,
    ...overrides,
  }
}

function textEl(overrides: Record<string, unknown> = {}) {
  return {
    id: 'txt-1', type: 'text', x: 10, y: 10, width: 300, height: 40,
    rotation: 0, opacity: 1, locked: false,
    content: 'Hello', fontFamily: 'Inter', fontSize: 24, fontWeight: 400,
    lineHeight: 1.2, letterSpacing: '0em', align: 'left', color: '#000000',
    uppercase: false,
    ...overrides,
  }
}

function imgEl(overrides: Record<string, unknown> = {}) {
  return {
    id: 'img-1', type: 'image', x: 0, y: 0, width: 500, height: 500,
    rotation: 0, opacity: 1, locked: false,
    src: 'https://example.com/img.png', objectFit: 'cover',
    borderRadius: 0, borderColor: '#000000', borderWidth: 0,
    maintainAspectRatio: true,
    ...overrides,
  }
}

function vidEl(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vid-1', type: 'video', x: 0, y: 0, width: 500, height: 500,
    rotation: 0, opacity: 1, locked: false,
    src: 'https://example.com/vid.mp4', borderRadius: 0,
    borderColor: '#000000', borderWidth: 0,
    maintainAspectRatio: true, muted: true, loop: true,
    startTime: 0, endTime: null,
    ...overrides,
  }
}

function compWith(elements: unknown[]) {
  return { ...validComp, elements }
}

/* ---------- 1. Boundary values ---------- */

describe('Boundary values', () => {
  it('accepts rotation = 0', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ rotation: 0 })])).success).toBe(true)
  })

  it('accepts rotation = 360', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ rotation: 360 })])).success).toBe(true)
  })

  it('rejects rotation = -1', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ rotation: -1 })])).success).toBe(false)
  })

  it('rejects rotation = 361', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ rotation: 361 })])).success).toBe(false)
  })

  it('accepts opacity = 0', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ opacity: 0 })])).success).toBe(true)
  })

  it('accepts opacity = 1', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ opacity: 1 })])).success).toBe(true)
  })

  it('rejects opacity = 1.1', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ opacity: 1.1 })])).success).toBe(false)
  })

  it('rejects opacity = -0.1', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ opacity: -0.1 })])).success).toBe(false)
  })

  it('accepts fontSize = 8', () => {
    expect(CardCompositionSchema.safeParse(compWith([textEl({ fontSize: 8 })])).success).toBe(true)
  })

  it('accepts fontSize = 400', () => {
    expect(CardCompositionSchema.safeParse(compWith([textEl({ fontSize: 400 })])).success).toBe(true)
  })

  it('rejects fontSize = 7', () => {
    expect(CardCompositionSchema.safeParse(compWith([textEl({ fontSize: 7 })])).success).toBe(false)
  })

  it('rejects fontSize = 401', () => {
    expect(CardCompositionSchema.safeParse(compWith([textEl({ fontSize: 401 })])).success).toBe(false)
  })

  it('rejects width = 0 (positive required)', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ width: 0 })])).success).toBe(false)
  })

  it('rejects negative height', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ height: -10 })])).success).toBe(false)
  })

  it('rejects empty id', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ id: '' })])).success).toBe(false)
  })
})

/* ---------- 2. QR dot styles + error correction ---------- */

describe('QR dot styles + error correction', () => {
  for (const style of QR_DOT_STYLES) {
    it(`accepts dotStyle = "${style}"`, () => {
      expect(CardCompositionSchema.safeParse(compWith([qrEl({ dotStyle: style })])).success).toBe(true)
    })
  }

  it('rejects invalid dotStyle', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ dotStyle: 'zigzag' })])).success).toBe(false)
  })

  for (const level of ['L', 'M', 'Q', 'H'] as const) {
    it(`accepts errorCorrection = "${level}"`, () => {
      expect(CardCompositionSchema.safeParse(compWith([qrEl({ errorCorrection: level })])).success).toBe(true)
    })
  }

  it('rejects invalid errorCorrection', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ errorCorrection: 'X' })])).success).toBe(false)
  })
})

/* ---------- 3. QR range constraints ---------- */

describe('QR range constraints', () => {
  it('accepts cornerRadius = 0', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ cornerRadius: 0 })])).success).toBe(true)
  })

  it('accepts cornerRadius = 50', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ cornerRadius: 50 })])).success).toBe(true)
  })

  it('rejects cornerRadius = 51', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ cornerRadius: 51 })])).success).toBe(false)
  })

  it('rejects cornerRadius = -1', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ cornerRadius: -1 })])).success).toBe(false)
  })

  it('accepts padding = 0', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ padding: 0 })])).success).toBe(true)
  })

  it('accepts padding = 40', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ padding: 40 })])).success).toBe(true)
  })

  it('rejects padding = 41', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ padding: 41 })])).success).toBe(false)
  })

  it('accepts logoPadTop = 0', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ logoPadTop: 0 })])).success).toBe(true)
  })

  it('accepts logoPadTop = 60', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ logoPadTop: 60 })])).success).toBe(true)
  })

  it('rejects logoPadTop = 61', () => {
    expect(CardCompositionSchema.safeParse(compWith([qrEl({ logoPadTop: 61 })])).success).toBe(false)
  })
})

/* ---------- 4. Video element schema ---------- */

describe('Video element schema', () => {
  it('accepts a valid video element', () => {
    expect(CardCompositionSchema.safeParse(compWith([vidEl()])).success).toBe(true)
  })

  it('rejects video without src', () => {
    const { src: _, ...noSrc } = vidEl()
    expect(CardCompositionSchema.safeParse(compWith([noSrc])).success).toBe(false)
  })

  it('rejects negative startTime', () => {
    expect(CardCompositionSchema.safeParse(compWith([vidEl({ startTime: -1 })])).success).toBe(false)
  })
})

/* ---------- 5. Missing required fields ---------- */

describe('Missing required fields', () => {
  it('rejects text without content', () => {
    const { content: _, ...noContent } = textEl()
    expect(CardCompositionSchema.safeParse(compWith([noContent])).success).toBe(false)
  })

  it('rejects image without src', () => {
    const { src: _, ...noSrc } = imgEl()
    expect(CardCompositionSchema.safeParse(compWith([noSrc])).success).toBe(false)
  })

  it('rejects video without src', () => {
    const { src: _, ...noSrc } = vidEl()
    expect(CardCompositionSchema.safeParse(compWith([noSrc])).success).toBe(false)
  })

  it('rejects unknown element type', () => {
    expect(CardCompositionSchema.safeParse(compWith([{
      id: 'x-1', type: 'shape', x: 0, y: 0, width: 100, height: 100,
      rotation: 0, opacity: 1, locked: false,
    }])).success).toBe(false)
  })

  it('rejects element without id', () => {
    const { id: _, ...noId } = qrEl()
    expect(CardCompositionSchema.safeParse(compWith([noId])).success).toBe(false)
  })
})

/* ---------- 6. Canvas boundaries ---------- */

describe('Canvas boundaries', () => {
  it('accepts canvas at 200x200', () => {
    const comp = { ...validComp, canvas: { width: 200, height: 200, aspectRatio: 'custom' } }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('accepts canvas at 4096x4096', () => {
    const comp = { ...validComp, canvas: { width: 4096, height: 4096, aspectRatio: 'custom' } }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('rejects height < 200', () => {
    const comp = { ...validComp, canvas: { width: 1080, height: 199, aspectRatio: 'custom' } }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })

  it('rejects height > 4096', () => {
    const comp = { ...validComp, canvas: { width: 1080, height: 4097, aspectRatio: 'custom' } }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })
})

/* ---------- 7. createVideoElement factory ---------- */

describe('createVideoElement factory', () => {
  it('sets type to video', () => {
    const v = createVideoElement('v-1', 'https://example.com/v.mp4', 1080, 1080)
    expect(v.type).toBe('video')
  })

  it('fills canvas without natural dimensions', () => {
    const v = createVideoElement('v-1', 'https://example.com/v.mp4', 1080, 1080)
    expect(v.width).toBe(1080)
    expect(v.height).toBe(1080)
    expect(v.x).toBe(0)
    expect(v.y).toBe(0)
  })

  it('fits landscape video into square canvas', () => {
    const v = createVideoElement('v-1', 'src.mp4', 1080, 1080, 1920, 1080)
    // landscape: vidRatio 16/9 > canvasRatio 1 → w = canvasWidth, h = 1080 / (16/9) = 607.5
    expect(v.width).toBe(1080)
    expect(v.height).toBeCloseTo(607.5, 0)
    expect(v.y).toBeGreaterThan(0)
  })

  it('fits portrait video into square canvas', () => {
    const v = createVideoElement('v-1', 'src.mp4', 1080, 1080, 720, 1280)
    // portrait: vidRatio 720/1280 < canvasRatio 1 → h = canvasHeight, w = 1080 * (720/1280) = 607.5
    expect(v.height).toBe(1080)
    expect(v.width).toBeCloseTo(607.5, 0)
    expect(v.x).toBeGreaterThan(0)
  })

  it('defaults to muted and loop', () => {
    const v = createVideoElement('v-1', 'src.mp4', 1080, 1080)
    expect(v.muted).toBe(true)
    expect(v.loop).toBe(true)
  })

  it('produces schema-compliant output', () => {
    const v = createVideoElement('v-1', 'https://example.com/v.mp4', 1080, 1080)
    expect(CardCompositionSchema.safeParse(compWith([v])).success).toBe(true)
  })
})

/* ---------- 8. createImageElement sizing ---------- */

describe('createImageElement sizing', () => {
  it('fills canvas without natural dimensions', () => {
    const img = createImageElement('i-1', 'https://example.com/a.png', 1080, 1080)
    expect(img.width).toBe(1080)
    expect(img.height).toBe(1080)
    expect(img.x).toBe(0)
    expect(img.y).toBe(0)
  })

  it('fits landscape image into square canvas', () => {
    const img = createImageElement('i-1', 'https://example.com/a.png', 1080, 1080, 1920, 1080)
    expect(img.width).toBe(1080)
    expect(img.height).toBeCloseTo(607.5, 0)
    expect(img.y).toBeGreaterThan(0)
  })

  it('fits portrait image into square canvas', () => {
    const img = createImageElement('i-1', 'https://example.com/a.png', 1080, 1080, 720, 1280)
    expect(img.height).toBe(1080)
    expect(img.width).toBeCloseTo(607.5, 0)
    expect(img.x).toBeGreaterThan(0)
  })
})

/* ---------- 9. createQrElement for non-square canvas ---------- */

describe('createQrElement for non-square canvas', () => {
  it('uses smaller dimension on wide canvas', () => {
    const qr = createQrElement('qr-1', 1920, 1080)
    const expectedSize = 1080 * 0.4 // min(1920, 1080) * 0.4
    expect(qr.width).toBe(expectedSize)
    expect(qr.height).toBe(expectedSize)
  })

  it('uses smaller dimension on tall canvas', () => {
    const qr = createQrElement('qr-1', 350, 960)
    const expectedSize = 350 * 0.4 // min(350, 960) * 0.4
    expect(qr.width).toBe(expectedSize)
    expect(qr.height).toBe(expectedSize)
  })

  it('produces schema-compliant output for all preset sizes', () => {
    for (const preset of ASPECT_RATIO_PRESETS) {
      const qr = createQrElement(`qr-${preset.name}`, preset.width, preset.height)
      const comp = compWith([qr])
      comp.canvas = { width: preset.width, height: preset.height, aspectRatio: preset.name }
      const result = CardCompositionSchema.safeParse(comp)
      expect(result.success, `failed for preset "${preset.name}"`).toBe(true)
    }
  })
})
