import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/cms/compile-json', () => ({
  compileJsonContent: vi.fn().mockResolvedValue({
    html: '<p>compiled</p>',
    toc: [{ depth: 2, text: 'Heading', slug: 'heading' }],
    readingTimeMin: 3,
  }),
}))

import { extractDraftBody, getDraftForLocale, prepareBlogTranslationPatch } from '@/lib/pipeline/draft-to-blog'

describe('extractDraftBody', () => {
  it('returns mdx for plain string', () => {
    expect(extractDraftBody('# Hello')).toEqual({ json: null, mdx: '# Hello' })
  })

  it('returns null mdx for empty string', () => {
    expect(extractDraftBody('')).toEqual({ json: null, mdx: null })
  })

  it('returns json for JSONContent', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] }
    const result = extractDraftBody(doc)
    expect(result.json).toEqual(doc)
    expect(result.mdx).toBeNull()
  })

  it('extracts body from hybrid { body, seo } object', () => {
    const doc = { type: 'doc', content: [] }
    const hybrid = { body: doc, seo: { title: 'SEO title' } }
    const result = extractDraftBody(hybrid)
    expect(result.json).toEqual(doc)
    expect(result.mdx).toBeNull()
  })

  it('extracts string body from hybrid object', () => {
    const hybrid = { body: '## Draft content', seo: null }
    expect(extractDraftBody(hybrid)).toEqual({ json: null, mdx: '## Draft content' })
  })

  it('returns nulls for null', () => {
    expect(extractDraftBody(null)).toEqual({ json: null, mdx: null })
  })

  it('returns nulls for undefined', () => {
    expect(extractDraftBody(undefined)).toEqual({ json: null, mdx: null })
  })

  it('returns nulls for array', () => {
    expect(extractDraftBody([1, 2, 3])).toEqual({ json: null, mdx: null })
  })
})

describe('getDraftForLocale', () => {
  const sections = {
    draft_pt: { content: '# PT content', rev: 1, source: 'user', edited: true, updated_at: '2026-01-01T00:00:00Z' },
    draft_en: { content: { type: 'doc', content: [] }, rev: 1, source: 'cowork', edited: false, updated_at: '2026-01-01T00:00:00Z' },
    ideia_shared: { content: { premise: 'test' }, rev: 0, source: 'user', edited: true, updated_at: '2026-01-01T00:00:00Z' },
  }

  it('returns draft_pt content for pt-br locale', () => {
    expect(getDraftForLocale(sections, 'pt-br')).toBe('# PT content')
  })

  it('returns draft_pt content for pt locale', () => {
    expect(getDraftForLocale(sections, 'pt')).toBe('# PT content')
  })

  it('returns draft_en content for en locale', () => {
    expect(getDraftForLocale(sections, 'en')).toEqual({ type: 'doc', content: [] })
  })

  it('falls back to draft_pt for non-en locale', () => {
    expect(getDraftForLocale(sections, 'fr')).toBe('# PT content')
  })

  it('returns null for null sections', () => {
    expect(getDraftForLocale(null, 'pt-br')).toBeNull()
  })

  it('returns null for empty sections', () => {
    expect(getDraftForLocale({}, 'en')).toBeNull()
  })

  it('returns null when section has no content field', () => {
    expect(getDraftForLocale({ draft_pt: { rev: 0 } }, 'pt-br')).toBeNull()
  })
})

describe('prepareBlogTranslationPatch', () => {
  it('returns null when no draft section exists', async () => {
    expect(await prepareBlogTranslationPatch({}, 'pt-br')).toBeNull()
  })

  it('returns null for null sections', async () => {
    expect(await prepareBlogTranslationPatch(null, 'en')).toBeNull()
  })

  it('returns JSON patch for JSONContent draft', async () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }] }
    const sections = { draft_pt: { content: doc, rev: 1, source: 'user', edited: true, updated_at: '2026-01-01T00:00:00Z' } }
    const result = await prepareBlogTranslationPatch(sections, 'pt-br')
    expect(result).not.toBeNull()
    expect(result!.content_json).toEqual(doc)
    expect(result!.content_html).toBe('<p>compiled</p>')
    expect(result!.content_mdx).toBeNull()
    expect(result!.content_compiled).toBeNull()
    expect(result!.content_toc).toEqual([{ depth: 2, text: 'Heading', slug: 'heading' }])
    expect(result!.reading_time_min).toBe(3)
  })

  it('returns MDX patch for string draft', async () => {
    const sections = { draft_en: { content: '# Hello world', rev: 1, source: 'user', edited: true, updated_at: '2026-01-01T00:00:00Z' } }
    const result = await prepareBlogTranslationPatch(sections, 'en')
    expect(result).not.toBeNull()
    expect(result!.content_mdx).toBe('# Hello world')
    expect(result!.content_json).toBeNull()
    expect(result!.content_html).toBeNull()
    expect(result!.content_compiled).toBeNull()
  })

  it('handles hybrid { body, seo } content', async () => {
    const doc = { type: 'doc', content: [] }
    const sections = { draft_pt: { content: { body: doc, seo: { title: 'SEO' } }, rev: 1, source: 'cowork', edited: false, updated_at: '2026-01-01T00:00:00Z' } }
    const result = await prepareBlogTranslationPatch(sections, 'pt-br')
    expect(result).not.toBeNull()
    expect(result!.content_json).toEqual(doc)
  })

  it('handles { body } wrapper without seo', async () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'wrapped' }] }] }
    const sections = { draft_en: { content: { body: doc }, rev: 1, source: 'user', edited: true, updated_at: '2026-01-01T00:00:00Z' } }
    const result = await prepareBlogTranslationPatch(sections, 'en')
    expect(result).not.toBeNull()
    expect(result!.content_json).toEqual(doc)
    expect(result!.content_html).toBe('<p>compiled</p>')
  })

  it('returns null gracefully when compileJsonContent throws', async () => {
    const { compileJsonContent } = await import('@/lib/cms/compile-json')
    vi.mocked(compileJsonContent).mockRejectedValueOnce(new Error('compile failed'))
    const doc = { type: 'doc', content: [{ type: 'paragraph' }] }
    const sections = { draft_en: { content: doc, rev: 1, source: 'user', edited: true, updated_at: '2026-01-01T00:00:00Z' } }
    const result = await prepareBlogTranslationPatch(sections, 'en')
    expect(result).toBeNull()
  })
})

describe('expanded blog fields', () => {
  const sections = {
    draft_pt: {
      rev: 3,
      content: {
        body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }] },
        title: 'Meu Post',
        slug: 'meu-post',
        excerpt: 'Um resumo do post',
        key_points: ['ponto 1', 'ponto 2'],
        pull_quote: 'Uma citacao importante',
        notes: ['nota 1'],
        colophon: 'Creditos finais',
        tag_id: '550e8400-e29b-41d4-a716-446655440000',
        cover_image_url: 'https://example.com/cover.jpg',
      },
      source: 'user',
      edited: true,
      updated_at: new Date().toISOString(),
    },
    seo_pt: {
      rev: 2,
      content: {
        meta_title: 'SEO Title',
        meta_description: 'SEO Description',
      },
      source: 'user',
      edited: true,
      updated_at: new Date().toISOString(),
    },
  }

  it('extracts title from draft section', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.title).toBe('Meu Post')
  })

  it('extracts slug from draft section', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.slug).toBe('meu-post')
  })

  it('extracts excerpt from draft section', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.excerpt).toBe('Um resumo do post')
  })

  it('extracts SEO fields from seo section', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.meta_title).toBe('SEO Title')
    expect(result?.meta_description).toBe('SEO Description')
  })

  it('extracts structured fields', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.key_points).toEqual(['ponto 1', 'ponto 2'])
    expect(result?.pull_quote).toBe('Uma citacao importante')
    expect(result?.notes).toEqual(['nota 1'])
    expect(result?.colophon).toBe('Creditos finais')
  })

  it('extracts tag_id from draft section', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.tag_id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('does not extract cover_image_url from draft (sourced from pipeline item)', async () => {
    const result = await prepareBlogTranslationPatch(sections, 'pt')
    expect(result?.cover_image_url).toBeNull()
  })
})
