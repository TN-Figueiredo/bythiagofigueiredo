import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createTemplateSchema,
  updateTemplateSchema,
  aspectRatioSchema,
  ASPECT_RATIOS,
  CANONICAL_SIZES,
  type SocialTemplate,
} from '@/lib/social/template-schemas'
import { CardCompositionSchema } from '@tn-figueiredo/links/qr'

// ---------------------------------------------------------------------------
// Zod schema unit tests (no DB, no mocking)
// ---------------------------------------------------------------------------

const VALID_COMPOSITION = {
  version: 1 as const,
  canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
  background: { type: 'solid' as const, color: '#0a0a0a' },
  elements: [
    {
      id: 'title-1',
      type: 'text' as const,
      x: 80,
      y: 800,
      width: 920,
      height: 200,
      rotation: 0,
      opacity: 1,
      locked: false,
      content: '{{title}}',
      fontFamily: 'Inter',
      fontSize: 48,
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '0em',
      align: 'center' as const,
      color: '#ffffff',
      backgroundColor: null,
      backgroundPadding: 8,
      backgroundRadius: 4,
      uppercase: false,
    },
  ],
}

describe('template-schemas', () => {
  describe('aspectRatioSchema', () => {
    it('accepts valid aspect ratios', () => {
      for (const ratio of ASPECT_RATIOS) {
        expect(aspectRatioSchema.safeParse(ratio).success).toBe(true)
      }
    })

    it('rejects invalid aspect ratios', () => {
      expect(aspectRatioSchema.safeParse('4:3').success).toBe(false)
      expect(aspectRatioSchema.safeParse('').success).toBe(false)
    })
  })

  describe('CANONICAL_SIZES', () => {
    it('maps every aspect ratio to a size', () => {
      for (const ratio of ASPECT_RATIOS) {
        const size = CANONICAL_SIZES[ratio]
        expect(size.width).toBeGreaterThan(0)
        expect(size.height).toBeGreaterThan(0)
      }
    })

    it('9:16 is 1080x1920', () => {
      expect(CANONICAL_SIZES['9:16']).toEqual({ width: 1080, height: 1920 })
    })

    it('1:1 is 1080x1080', () => {
      expect(CANONICAL_SIZES['1:1']).toEqual({ width: 1080, height: 1080 })
    })

    it('16:9 is 1280x720', () => {
      expect(CANONICAL_SIZES['16:9']).toEqual({ width: 1280, height: 720 })
    })
  })

  describe('createTemplateSchema', () => {
    it('accepts valid input', () => {
      const input = {
        name: 'Bold Story',
        aspectRatio: '9:16' as const,
        composition: VALID_COMPOSITION,
      }
      const result = createTemplateSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('rejects empty name', () => {
      const input = {
        name: '',
        aspectRatio: '9:16' as const,
        composition: VALID_COMPOSITION,
      }
      expect(createTemplateSchema.safeParse(input).success).toBe(false)
    })

    it('rejects name over 120 chars', () => {
      const input = {
        name: 'x'.repeat(121),
        aspectRatio: '9:16' as const,
        composition: VALID_COMPOSITION,
      }
      expect(createTemplateSchema.safeParse(input).success).toBe(false)
    })

    it('rejects invalid aspect ratio', () => {
      const input = {
        name: 'Test',
        aspectRatio: '4:3',
        composition: VALID_COMPOSITION,
      }
      expect(createTemplateSchema.safeParse(input).success).toBe(false)
    })

    it('rejects composition with no version', () => {
      const input = {
        name: 'Test',
        aspectRatio: '9:16' as const,
        composition: { ...VALID_COMPOSITION, version: undefined },
      }
      expect(createTemplateSchema.safeParse(input).success).toBe(false)
    })

    it('allows optional thumbnailBase64', () => {
      const input = {
        name: 'Test',
        aspectRatio: '9:16' as const,
        composition: VALID_COMPOSITION,
        thumbnailBase64: 'data:image/png;base64,iVBOR...',
      }
      expect(createTemplateSchema.safeParse(input).success).toBe(true)
    })
  })

  describe('updateTemplateSchema', () => {
    it('accepts partial update with only name', () => {
      const result = updateTemplateSchema.safeParse({ name: 'New Name' })
      expect(result.success).toBe(true)
    })

    it('accepts partial update with only composition', () => {
      const result = updateTemplateSchema.safeParse({ composition: VALID_COMPOSITION })
      expect(result.success).toBe(true)
    })

    it('accepts empty object (no fields)', () => {
      const result = updateTemplateSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('rejects empty name', () => {
      const result = updateTemplateSchema.safeParse({ name: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('CardCompositionSchema integration', () => {
    it('validates a full composition with text + image elements', () => {
      const comp = {
        version: 1 as const,
        canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
        background: {
          type: 'gradient' as const,
          angle: 135,
          stops: [
            { color: '#7c3aed', position: 0 },
            { color: '#2563eb', position: 0.5 },
            { color: '#06b6d4', position: 1 },
          ],
        },
        elements: [
          {
            id: 'bg-img',
            type: 'image' as const,
            x: 0,
            y: 0,
            width: 1080,
            height: 1080,
            rotation: 0,
            opacity: 0.3,
            locked: true,
            src: '{{cover_image}}',
            objectFit: 'cover' as const,
            borderRadius: 0,
            borderColor: '#000000',
            borderWidth: 0,
            maintainAspectRatio: true,
          },
          {
            id: 'title-text',
            type: 'text' as const,
            x: 80,
            y: 400,
            width: 920,
            height: 200,
            rotation: 0,
            opacity: 1,
            locked: false,
            content: '{{title}}',
            fontFamily: 'Bebas Neue',
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '0em',
            align: 'center' as const,
            color: '#ffffff',
            backgroundColor: null,
            backgroundPadding: 8,
            backgroundRadius: 4,
            uppercase: true,
          },
        ],
      }
      const result = CardCompositionSchema.safeParse(comp)
      expect(result.success).toBe(true)
    })

    it('rejects composition with more than 20 elements', () => {
      const elements = Array.from({ length: 21 }, (_, i) => ({
        id: `el-${i}`,
        type: 'text' as const,
        x: 0,
        y: i * 50,
        width: 100,
        height: 40,
        rotation: 0,
        opacity: 1,
        locked: false,
        content: `Element ${i}`,
        fontFamily: 'Inter',
        fontSize: 24,
        fontWeight: 400,
        lineHeight: 1.2,
        letterSpacing: '0em',
        align: 'left' as const,
        color: '#000000',
        backgroundColor: null,
        backgroundPadding: 8,
        backgroundRadius: 4,
        uppercase: false,
      }))
      const comp = {
        version: 1 as const,
        canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
        background: { type: 'solid' as const, color: '#ffffff' },
        elements,
      }
      const result = CardCompositionSchema.safeParse(comp)
      expect(result.success).toBe(false)
    })
  })
})
