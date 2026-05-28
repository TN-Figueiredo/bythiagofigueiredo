import { describe, it, expect } from 'vitest'
import {
  VariantMetadataSchema,
  VariantPayloadSchema,
  BatchVariantUpsertSchema,
} from '@/lib/youtube/ab-schemas'

describe('VariantMetadataSchema', () => {
  it('accepts valid metadata with all fields', () => {
    const result = VariantMetadataSchema.safeParse({
      thumbnail_tags: ['closeup', 'warm'],
      title_pattern: 'curiosity-gap',
      emotional_triggers: ['surprise', 'fomo'],
      visual_description: 'Close-up reaction shot with warm orange tones',
      ai_image_prompt: 'youtuber surprised face, Bangkok mall, warm tones',
      creative_direction: 'Warm tones, close-up reaction shot',
      rationale: 'Contrarian hook + curiosity gap',
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty object (all fields optional)', () => {
    const result = VariantMetadataSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects thumbnail_tags with strings over 50 chars', () => {
    const result = VariantMetadataSchema.safeParse({
      thumbnail_tags: ['A'.repeat(51)],
    })
    expect(result.success).toBe(false)
  })

  it('rejects thumbnail_tags with more than 10 items', () => {
    const result = VariantMetadataSchema.safeParse({
      thumbnail_tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    })
    expect(result.success).toBe(false)
  })

  it('rejects ai_image_prompt over 1000 chars', () => {
    const result = VariantMetadataSchema.safeParse({
      ai_image_prompt: 'A'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects rationale over 1000 chars', () => {
    const result = VariantMetadataSchema.safeParse({
      rationale: 'A'.repeat(1001),
    })
    expect(result.success).toBe(false)
  })
})

describe('VariantPayloadSchema', () => {
  it('accepts valid payload with label B', () => {
    const result = VariantPayloadSchema.safeParse({
      label: 'B',
      title_text: 'Why MBK Center Is NOT What You Think',
      metadata: { rationale: 'Contrarian hook' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid label A', () => {
    const result = VariantPayloadSchema.safeParse({
      label: 'A',
      title_text: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects label E', () => {
    const result = VariantPayloadSchema.safeParse({
      label: 'E',
      title_text: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null title_text and description_text', () => {
    const result = VariantPayloadSchema.safeParse({
      label: 'C',
      title_text: null,
      description_text: null,
      metadata: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects title_text over 200 chars', () => {
    const result = VariantPayloadSchema.safeParse({
      label: 'B',
      title_text: 'A'.repeat(201),
    })
    expect(result.success).toBe(false)
  })

  it('rejects description_text over 5000 chars', () => {
    const result = VariantPayloadSchema.safeParse({
      label: 'D',
      description_text: 'A'.repeat(5001),
    })
    expect(result.success).toBe(false)
  })
})

describe('BatchVariantUpsertSchema', () => {
  it('accepts 1-3 variants', () => {
    const result = BatchVariantUpsertSchema.safeParse({
      variants: [
        { label: 'B', title_text: 'Title B' },
        { label: 'C', title_text: 'Title C' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty variants array', () => {
    const result = BatchVariantUpsertSchema.safeParse({ variants: [] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 3 variants', () => {
    const result = BatchVariantUpsertSchema.safeParse({
      variants: [
        { label: 'B', title_text: 'B' },
        { label: 'C', title_text: 'C' },
        { label: 'D', title_text: 'D' },
        { label: 'B', title_text: 'B2' },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('accepts single variant', () => {
    const result = BatchVariantUpsertSchema.safeParse({
      variants: [{ label: 'D', description_text: 'New description' }],
    })
    expect(result.success).toBe(true)
  })
})
