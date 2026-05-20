import { describe, it, expect } from 'vitest'
import { LinktreeConfigSchema, HighlightSchema, SharedLinkSchema } from '../../src/app/go/linktree/_lib/types'

describe('LinktreeConfigSchema', () => {
  it('accepts a valid full config', () => {
    const config = {
      highlight: { active: true, badge_pt: 'Em breve', badge_en: 'Coming soon', title_pt: 'Curso Next.js', title_en: 'Next.js Course', desc_pt: 'Descrição', desc_en: 'Description', cta_pt: 'Entrar', cta_en: 'Join', url: '/newsletter' },
      tagline_pt: 'dev indie',
      tagline_en: 'indie dev',
      blog_desc_pt: 'Artigos sobre código',
      blog_desc_en: 'Posts on code',
      shared_links: [{ label_pt: 'Sobre', label_en: 'About', url: '/about', icon: 'user' }],
    }
    const result = LinktreeConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('accepts an empty object (all defaults)', () => {
    const result = LinktreeConfigSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.highlight.active).toBe(false)
      expect(result.data.tagline_pt).toBe('')
      expect(result.data.shared_links).toEqual([])
    }
  })

  it('accepts highlight with only active (defaults fill remaining fields)', () => {
    const result = HighlightSchema.safeParse({ active: true })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.badge_pt).toBe('')
      expect(result.data.url).toBe('')
    }
  })

  it('rejects highlight when a string field receives a number', () => {
    const result = HighlightSchema.safeParse({ active: true, badge_pt: 42 })
    expect(result.success).toBe(false)
  })

  it('accepts shared_links with valid icons', () => {
    const result = SharedLinkSchema.safeParse({ label_pt: 'Sobre', label_en: 'About', url: '/about', icon: 'user' })
    expect(result.success).toBe(true)
  })

  it('rejects shared_link without url', () => {
    const result = SharedLinkSchema.safeParse({ label_pt: 'Sobre', label_en: 'About', icon: 'user' })
    expect(result.success).toBe(false)
  })

  it('rejects shared_link without label_pt', () => {
    const result = SharedLinkSchema.safeParse({ label_en: 'About', url: '/about', icon: 'user' })
    expect(result.success).toBe(false)
  })

  it('rejects shared_link without label_en', () => {
    const result = SharedLinkSchema.safeParse({ label_pt: 'Sobre', url: '/about', icon: 'user' })
    expect(result.success).toBe(false)
  })

  it('rejects shared_link without icon', () => {
    const result = SharedLinkSchema.safeParse({ label_pt: 'Sobre', label_en: 'About', url: '/about' })
    expect(result.success).toBe(false)
  })

  it('accepts shared_link with empty strings', () => {
    const result = SharedLinkSchema.safeParse({ label_pt: '', label_en: '', url: '', icon: '' })
    expect(result.success).toBe(true)
  })

  it('accepts config with extra unexpected fields (no .strict())', () => {
    const result = LinktreeConfigSchema.safeParse({ tagline_pt: 'hello', extra_field: 'should be stripped' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('extra_field')
    }
  })
})
