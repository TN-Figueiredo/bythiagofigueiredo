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

describe('citation tag parsing (usedCitations logic)', () => {
  function extractCitationIds(text: string, refs: Map<number, string>): number[] {
    const ids: number[] = []
    const re = /\[citacao (\d+)\]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const id = Number(m[1])
      if (refs.has(id) && !ids.includes(id)) ids.push(id)
    }
    return ids
  }

  it('extracts referenced citation IDs from text', () => {
    const refs = new Map([[1, 'text1'], [2, 'text2']])
    expect(extractCitationIds('[citacao 1] fix this', refs)).toEqual([1])
  })

  it('ignores IDs not present in references map', () => {
    const refs = new Map([[1, 'text1']])
    expect(extractCitationIds('[citacao 99] fix this', refs)).toEqual([])
  })

  it('deduplicates repeated citation IDs', () => {
    const refs = new Map([[1, 'text1']])
    expect(extractCitationIds('[citacao 1] here and [citacao 1] there', refs)).toEqual([1])
  })

  it('returns empty array when no citations present', () => {
    const refs = new Map([[1, 'text1']])
    expect(extractCitationIds('just plain text', refs)).toEqual([])
  })

  it('handles gaps in citation IDs', () => {
    const refs = new Map([[1, 'a'], [3, 'b'], [5, 'c']])
    expect(extractCitationIds('[citacao 3] and [citacao 5]', refs)).toEqual([3, 5])
  })

  it('preserves order of appearance', () => {
    const refs = new Map([[1, 'a'], [3, 'b'], [2, 'c']])
    expect(extractCitationIds('[citacao 3] then [citacao 1] then [citacao 2]', refs)).toEqual([3, 1, 2])
  })
})
