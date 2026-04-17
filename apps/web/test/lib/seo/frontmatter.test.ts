import { describe, it, expect } from 'vitest'
import { parseMdxFrontmatter, SeoExtrasValidationError } from '@/lib/seo/frontmatter'

describe('parseMdxFrontmatter', () => {
  it('strips frontmatter and returns content body', () => {
    const src = `---\ntitle: Hello\n---\n\n# Body\n\ntext.\n`
    const r = parseMdxFrontmatter(src)
    expect(r.content.trim()).toBe('# Body\n\ntext.')
    expect(r.raw.title).toBe('Hello')
    expect(r.seoExtras).toBeNull()
  })

  it('validates and returns seo_extras when present', () => {
    const src = `---\ntitle: T\nseo_extras:\n  faq:\n    - q: Question?\n      a: Answer.\n---\nbody\n`
    const r = parseMdxFrontmatter(src)
    expect(r.seoExtras).toEqual({ faq: [{ q: 'Question?', a: 'Answer.' }] })
  })

  it('throws SeoExtrasValidationError for invalid extras', () => {
    const src = `---\nseo_extras:\n  faq: []\n---\nbody\n`
    expect(() => parseMdxFrontmatter(src)).toThrow(SeoExtrasValidationError)
  })

  it('returns null seoExtras when no extras key in frontmatter', () => {
    const src = `---\ntitle: T\n---\nbody\n`
    const r = parseMdxFrontmatter(src)
    expect(r.seoExtras).toBeNull()
  })

  it('handles MDX with no frontmatter', () => {
    const src = `# Just content\n\nno frontmatter.\n`
    const r = parseMdxFrontmatter(src)
    expect(r.content).toBe(src)
    expect(r.raw).toEqual({})
    expect(r.seoExtras).toBeNull()
  })
})
