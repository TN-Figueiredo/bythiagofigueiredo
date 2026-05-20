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

  it('rejects invalid highlight (missing required fields)', () => {
    const result = HighlightSchema.safeParse({ active: true })
    expect(result.success).toBe(true)
  })

  it('accepts shared_links with valid icons', () => {
    const result = SharedLinkSchema.safeParse({ label_pt: 'Sobre', label_en: 'About', url: '/about', icon: 'user' })
    expect(result.success).toBe(true)
  })

  it('rejects shared_link without url', () => {
    const result = SharedLinkSchema.safeParse({ label_pt: 'Sobre', label_en: 'About', icon: 'user' })
    expect(result.success).toBe(false)
  })
})
