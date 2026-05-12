import { describe, it, expect } from 'vitest'
import { buildPrompt, summarizeContent } from '@/app/cms/(authed)/pipeline/_components/detail/cowork-request-panel'

describe('summarizeContent', () => {
  it('returns "Seção vazia" for null/undefined', () => {
    expect(summarizeContent(null)).toBe('Seção vazia')
    expect(summarizeContent(undefined)).toBe('Seção vazia')
  })

  it('counts words in plain text', () => {
    expect(summarizeContent('one two three')).toBe('3 palavras | 1 parágrafos')
  })

  it('counts headings and paragraphs separately', () => {
    const text = '# Heading\n\nParagraph one.\n\nParagraph two.'
    const result = summarizeContent(text)
    expect(result).toContain('1 seções')
    expect(result).toContain('2 parágrafos')
  })

  it('extracts body from JSON blob', () => {
    const content = { body: 'word1 word2 word3 word4 word5' }
    expect(summarizeContent(content)).toContain('5 palavras')
  })

  it('handles empty string', () => {
    expect(summarizeContent('')).toBe('Seção vazia')
  })
})

describe('buildPrompt', () => {
  const base = {
    itemCode: 'tg-01',
    itemTitle: 'Test Item',
    format: 'blog_post',
    stage: 'rascunho',
    tags: ['ai', 'test'],
    hook: 'A test hook',
    synopsis: 'A test synopsis',
    sectionLabel: 'Rascunho',
    sectionKey: 'draft_pt',
    lang: 'pt',
    rev: 3,
    contentSummary: '500 palavras | 2 seções',
    instructions: 'Rewrite the intro',
    itemId: 'abc-123',
    sectionBase: 'draft',
    references: new Map<number, string>(),
  }

  it('includes item context in header', () => {
    const result = buildPrompt(base)
    expect(result).toContain('tg-01 — "Test Item"')
    expect(result).toContain('Format: blog_post')
    expect(result).toContain('Stage: rascunho')
    expect(result).toContain('Language: PT')
  })

  it('includes tags', () => {
    const result = buildPrompt(base)
    expect(result).toContain('Tags: ai, test')
  })

  it('omits tags line when empty', () => {
    const result = buildPrompt({ ...base, tags: [] })
    expect(result).not.toContain('Tags:')
  })

  it('includes hook and synopsis', () => {
    const result = buildPrompt(base)
    expect(result).toContain('Hook: A test hook')
    expect(result).toContain('Synopsis: A test synopsis')
  })

  it('omits hook/synopsis when null', () => {
    const result = buildPrompt({ ...base, hook: null, synopsis: null })
    expect(result).not.toContain('Hook:')
    expect(result).not.toContain('Synopsis:')
  })

  it('includes section metadata', () => {
    const result = buildPrompt(base)
    expect(result).toContain('Section: Rascunho (draft_pt) — rev.3')
    expect(result).toContain('Current content: 500 palavras | 2 seções')
  })

  it('includes user instructions', () => {
    const result = buildPrompt(base)
    expect(result).toContain('Instructions:\nRewrite the intro')
  })

  it('includes correct API endpoints', () => {
    const result = buildPrompt(base)
    expect(result).toContain('GET /api/pipeline/items/abc-123/sections/draft?lang=pt')
    expect(result).toContain('PATCH /api/pipeline/items/abc-123/sections/draft?lang=pt')
  })

  it('includes X-Expected-Version header instruction', () => {
    const result = buildPrompt(base)
    expect(result).toContain('X-Expected-Version')
  })

  it('includes rev and source in PATCH body instruction', () => {
    const result = buildPrompt(base)
    expect(result).toContain('"rev"')
    expect(result).toContain('"source": "cowork"')
  })

  it('includes referenced passages when citations exist in instructions', () => {
    const refs = new Map<number, string>()
    refs.set(1, 'Some cited text here')
    const result = buildPrompt({ ...base, references: refs, instructions: '[citacao 1] fix this' })
    expect(result).toContain('[citacao 1: "Some cited text here"]')
  })

  it('leaves unknown citation tags unchanged', () => {
    const refs = new Map<number, string>()
    refs.set(1, 'Known text')
    const result = buildPrompt({ ...base, references: refs, instructions: '[citacao 99] fix this' })
    expect(result).toContain('[citacao 99]')
    expect(result).not.toContain('[citacao 99:')
  })

  it('truncates long citation text at 500 chars', () => {
    const refs = new Map<number, string>()
    const longText = 'A'.repeat(600)
    refs.set(1, longText)
    const result = buildPrompt({ ...base, references: refs, instructions: '[citacao 1] fix this' })
    expect(result).toContain('[citacao 1: "' + 'A'.repeat(500) + '..."]')
    expect(result).not.toContain('A'.repeat(501))
  })

  it('handles instructions with no citations', () => {
    const refs = new Map<number, string>()
    refs.set(1, 'Some text')
    const result = buildPrompt({ ...base, references: refs, instructions: 'Just rewrite the intro' })
    expect(result).toContain('Instructions:\nJust rewrite the intro')
    expect(result).not.toContain('[citacao')
  })

  it('handles multiple citations', () => {
    const refs = new Map<number, string>()
    refs.set(1, 'First passage')
    refs.set(3, 'Third passage')
    const result = buildPrompt({ ...base, references: refs, instructions: 'Compare [citacao 1] with [citacao 3]' })
    expect(result).toContain('[citacao 1: "First passage"]')
    expect(result).toContain('[citacao 3: "Third passage"]')
  })
})
