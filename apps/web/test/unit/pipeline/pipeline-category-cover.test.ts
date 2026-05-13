import { describe, it, expect } from 'vitest'
import { PipelineItemUpdateSchema, BLOG_CATEGORIES } from '@/lib/pipeline/schemas'

describe('BLOG_CATEGORIES', () => {
  it('contains exactly 4 categories', () => {
    expect(BLOG_CATEGORIES).toEqual(['stories', 'building', 'money', 'bts'])
  })
})

describe('PipelineItemUpdateSchema — category', () => {
  it('accepts valid category', () => {
    const result = PipelineItemUpdateSchema.safeParse({ category: 'stories' })
    expect(result.success).toBe(true)
  })

  it('accepts all category values', () => {
    for (const cat of BLOG_CATEGORIES) {
      const result = PipelineItemUpdateSchema.safeParse({ category: cat })
      expect(result.success).toBe(true)
    }
  })

  it('accepts null category', () => {
    const result = PipelineItemUpdateSchema.safeParse({ category: null })
    expect(result.success).toBe(true)
  })

  it('rejects invalid category', () => {
    const result = PipelineItemUpdateSchema.safeParse({ category: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('is optional', () => {
    const result = PipelineItemUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('PipelineItemUpdateSchema — cover_image_url', () => {
  it('accepts valid URL', () => {
    const result = PipelineItemUpdateSchema.safeParse({ cover_image_url: 'https://example.com/image.jpg' })
    expect(result.success).toBe(true)
  })

  it('accepts null', () => {
    const result = PipelineItemUpdateSchema.safeParse({ cover_image_url: null })
    expect(result.success).toBe(true)
  })

  it('rejects non-URL string', () => {
    const result = PipelineItemUpdateSchema.safeParse({ cover_image_url: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('rejects URL over 2000 chars', () => {
    const result = PipelineItemUpdateSchema.safeParse({ cover_image_url: 'https://example.com/' + 'a'.repeat(2000) })
    expect(result.success).toBe(false)
  })

  it('is optional', () => {
    const result = PipelineItemUpdateSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('PipelineItemUpdateSchema — combined fields', () => {
  it('accepts category and cover_image_url together with other fields', () => {
    const result = PipelineItemUpdateSchema.safeParse({
      title_pt: 'Test Post',
      category: 'money',
      cover_image_url: 'https://example.com/cover.jpg',
      priority: 3,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBe('money')
      expect(result.data.cover_image_url).toBe('https://example.com/cover.jpg')
      expect(result.data.title_pt).toBe('Test Post')
      expect(result.data.priority).toBe(3)
    }
  })
})
