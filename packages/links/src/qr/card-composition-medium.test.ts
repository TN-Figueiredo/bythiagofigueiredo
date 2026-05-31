import { describe, it, expect } from 'vitest'
import {
  BG_PALETTE,
  ASPECT_RATIO_PRESETS,
  PRESET_HINTS,
  AVAILABLE_FONTS,
  FONT_CATEGORIES,
  CardCompositionSchema,
  createDefaultComposition,
  createQrElement,
  createTextElement,
  createImageElement,
  createVideoElement,
  migrateLegacyQrConfig,
} from './card-composition.js'
import type { FontCategory } from './card-composition.js'

// ---------------------------------------------------------------------------
// 1. BG_PALETTE
// ---------------------------------------------------------------------------
describe('BG_PALETTE', () => {
  it('has exactly 6 colors', () => {
    expect(BG_PALETTE).toHaveLength(6)
  })

  it('every entry is a valid hex color', () => {
    for (const color of BG_PALETTE) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('all colors are unique', () => {
    const unique = new Set(BG_PALETTE.map(c => c.toLowerCase()))
    expect(unique.size).toBe(BG_PALETTE.length)
  })
})

// ---------------------------------------------------------------------------
// 2. ASPECT_RATIO_PRESETS
// ---------------------------------------------------------------------------
describe('ASPECT_RATIO_PRESETS', () => {
  it('all widths are within canvas bounds [200, 4096]', () => {
    for (const p of ASPECT_RATIO_PRESETS) {
      expect(p.width).toBeGreaterThanOrEqual(200)
      expect(p.width).toBeLessThanOrEqual(4096)
    }
  })

  it('all heights are within canvas bounds [200, 4096]', () => {
    for (const p of ASPECT_RATIO_PRESETS) {
      expect(p.height).toBeGreaterThanOrEqual(200)
      expect(p.height).toBeLessThanOrEqual(4096)
    }
  })

  it('includes a Horizontal preset', () => {
    expect(ASPECT_RATIO_PRESETS.some(p => p.label === 'Horizontal')).toBe(true)
  })

  it('includes a Personalizado preset', () => {
    expect(ASPECT_RATIO_PRESETS.some(p => p.label === 'Personalizado')).toBe(true)
  })

  it('createDefaultComposition is schema-valid for every preset', () => {
    for (const preset of ASPECT_RATIO_PRESETS) {
      const comp = createDefaultComposition(preset)
      const result = CardCompositionSchema.safeParse(comp)
      expect(result.success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// 3. PRESET_HINTS
// ---------------------------------------------------------------------------
describe('PRESET_HINTS', () => {
  it('has a key for every preset name', () => {
    for (const preset of ASPECT_RATIO_PRESETS) {
      expect(PRESET_HINTS).toHaveProperty(preset.name)
    }
  })

  it('custom hint is empty string', () => {
    expect(PRESET_HINTS['custom']).toBe('')
  })

  it('non-custom hints are non-empty', () => {
    for (const preset of ASPECT_RATIO_PRESETS) {
      if (preset.name !== 'custom') {
        expect(PRESET_HINTS[preset.name]!.length).toBeGreaterThan(0)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// 4. FONT_CATEGORIES <-> AVAILABLE_FONTS bidirectional consistency
// ---------------------------------------------------------------------------
describe('FONT_CATEGORIES <-> AVAILABLE_FONTS', () => {
  const allCategoryFonts = (Object.values(FONT_CATEGORIES) as readonly string[][]).flat()

  it('every font in FONT_CATEGORIES exists in AVAILABLE_FONTS', () => {
    for (const font of allCategoryFonts) {
      expect(AVAILABLE_FONTS).toContain(font)
    }
  })

  it('every AVAILABLE_FONTS entry appears in exactly one category', () => {
    for (const font of AVAILABLE_FONTS) {
      const matches = (Object.entries(FONT_CATEGORIES) as [FontCategory, readonly string[]][])
        .filter(([, fonts]) => fonts.includes(font))
      expect(matches).toHaveLength(1)
    }
  })

  it('total fonts in categories equals AVAILABLE_FONTS length', () => {
    expect(allCategoryFonts.length).toBe(AVAILABLE_FONTS.length)
  })

  it('no duplicate fonts within any single category', () => {
    for (const [cat, fonts] of Object.entries(FONT_CATEGORIES)) {
      const unique = new Set(fonts)
      expect(unique.size).toBe(fonts.length)
    }
  })
})

// ---------------------------------------------------------------------------
// 5. All factory outputs produce schema-valid compositions
// ---------------------------------------------------------------------------
describe('factory outputs are schema-valid', () => {
  it('createDefaultComposition()', () => {
    const comp = createDefaultComposition()
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('createDefaultComposition + createQrElement', () => {
    const comp = createDefaultComposition()
    comp.elements = [createQrElement('qr-1', 1080, 1080, 'QR Code')]
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('createDefaultComposition + createTextElement', () => {
    const comp = createDefaultComposition()
    comp.elements = [createTextElement('txt-1', 1080, 1080, 'Texto')]
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('createDefaultComposition + createImageElement', () => {
    const comp = createDefaultComposition()
    comp.elements = [createImageElement('img-1', 'https://example.com/img.jpg', 1080, 1080)]
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('createDefaultComposition + createImageElement with natural dimensions', () => {
    const comp = createDefaultComposition()
    comp.elements = [createImageElement('img-2', 'https://example.com/wide.jpg', 1080, 1080, 1920, 1080)]
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('createDefaultComposition + createVideoElement', () => {
    const comp = createDefaultComposition()
    comp.elements = [createVideoElement('vid-1', 'https://example.com/vid.mp4', 1080, 1080)]
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('createDefaultComposition + createVideoElement with natural dimensions', () => {
    const comp = createDefaultComposition()
    comp.elements = [createVideoElement('vid-2', 'https://example.com/tall.mp4', 1080, 1080, 720, 1280)]
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('migrateLegacyQrConfig produces valid composition', () => {
    const comp = migrateLegacyQrConfig({
      foreground: '#FF0000',
      background: '#00FF00',
      error_correction: 'H',
      size: 512,
    })
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('migrateLegacyQrConfig with empty config produces valid composition', () => {
    const comp = migrateLegacyQrConfig({})
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('composition with max 20 elements is valid', () => {
    const comp = createDefaultComposition()
    for (let i = 0; i < 20; i++) {
      comp.elements.push(createTextElement(`el-${i}`, 1080, 1080))
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(true)
  })

  it('composition with 21 elements is rejected', () => {
    const comp = createDefaultComposition()
    for (let i = 0; i < 21; i++) {
      comp.elements.push(createTextElement(`el-${i}`, 1080, 1080))
    }
    expect(CardCompositionSchema.safeParse(comp).success).toBe(false)
  })
})
