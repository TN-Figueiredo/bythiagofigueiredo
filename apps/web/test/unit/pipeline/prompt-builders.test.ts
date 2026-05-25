import { describe, it, expect } from 'vitest'
import { generatePrompt, summarizeContent, buildPrompt } from '@/lib/pipeline/prompt-builders'
import type { PipelineItemForPrompt, SectionForPrompt } from '@/lib/pipeline/prompt-builders'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseItem: PipelineItemForPrompt = {
  id: 'item-abc-123',
  code: 'tg-42',
  format: 'blog_post',
  stage: 'rascunho',
  priority: 2,
  language: 'pt-br',
  title_pt: 'Título em Português',
  title_en: null,
  hook: 'Um hook interessante',
  synopsis: 'Uma sinopse detalhada',
}

const baseSections: SectionForPrompt[] = [
  { section_type: 'rascunho_pt', language: 'pt', content: 'Conteúdo da seção de rascunho.' },
]

// ---------------------------------------------------------------------------
// generatePrompt
// ---------------------------------------------------------------------------

describe('generatePrompt', () => {
  it('returns text containing item code', () => {
    const { text } = generatePrompt(baseItem, baseSections, 'en')
    expect(text).toContain('tg-42')
  })

  it('returns text containing target locale instructions', () => {
    const { text } = generatePrompt(baseItem, baseSections, 'en')
    expect(text).toContain('English')
  })

  it('returns text containing target locale instructions for pt-br', () => {
    const itemWithEn: PipelineItemForPrompt = {
      ...baseItem,
      language: 'en',
      title_en: 'English Title',
      title_pt: null,
    }
    const { text } = generatePrompt(itemWithEn, baseSections, 'pt-br')
    expect(text).toContain('Português (PT-BR)')
  })

  it('returns text with docs fetch step 0 (items-and-sections)', () => {
    const { text } = generatePrompt(baseItem, baseSections, 'en')
    expect(text).toContain('0. GET /api/pipeline/docs/items-and-sections')
  })

  it('labels docs step with section schemas hint', () => {
    const { text } = generatePrompt(baseItem, baseSections, 'en')
    expect(text).toContain('Section schemas and formatting rules')
  })

  it('GET item detail is step 1 (after docs step 0)', () => {
    const { text } = generatePrompt(baseItem, baseSections, 'en')
    expect(text).toContain(`1. GET /api/pipeline/items/item-abc-123`)
  })

  it('PATCH item detail is step 2', () => {
    const { text } = generatePrompt(baseItem, baseSections, 'en')
    expect(text).toContain(`2. PATCH /api/pipeline/items/item-abc-123`)
  })

  it('returns word count > 0', () => {
    const { wordCount } = generatePrompt(baseItem, baseSections, 'en')
    expect(wordCount).toBeGreaterThan(0)
  })

  it('sets wasTruncated false when all sections are short', () => {
    const { wasTruncated } = generatePrompt(baseItem, baseSections, 'en')
    expect(wasTruncated).toBe(false)
  })

  it('truncates sections longer than 500 chars and sets wasTruncated', () => {
    const longSection: SectionForPrompt = {
      section_type: 'rascunho_pt',
      language: 'pt',
      content: 'A'.repeat(600),
    }
    const { text, wasTruncated } = generatePrompt(baseItem, [longSection], 'en')
    expect(wasTruncated).toBe(true)
    // content is truncated at 500 chars + '...'
    expect(text).toContain('A'.repeat(500) + '...')
    expect(text).not.toContain('A'.repeat(501))
  })

  it('wasTruncated is false when section is exactly 500 chars', () => {
    const exactSection: SectionForPrompt = {
      section_type: 'rascunho_pt',
      language: 'pt',
      content: 'B'.repeat(500),
    }
    const { wasTruncated } = generatePrompt(baseItem, [exactSection], 'en')
    expect(wasTruncated).toBe(false)
  })

  it('includes section type in output', () => {
    const { text } = generatePrompt(baseItem, baseSections, 'en')
    expect(text).toContain('rascunho_pt:')
  })

  it('includes item id in prompt', () => {
    const { text } = generatePrompt(baseItem, baseSections, 'en')
    expect(text).toContain('item-abc-123')
  })

  it('omits hook line when hook is null', () => {
    const noHookItem = { ...baseItem, hook: null }
    const { text } = generatePrompt(noHookItem, baseSections, 'en')
    expect(text).not.toContain('Hook:')
  })

  it('omits synopsis line when synopsis is null', () => {
    const noSynopsisItem = { ...baseItem, synopsis: null }
    const { text } = generatePrompt(noSynopsisItem, baseSections, 'en')
    expect(text).not.toContain('Synopsis:')
  })

  it('handles empty sections array', () => {
    const { text, wordCount } = generatePrompt(baseItem, [], 'en')
    expect(text).toContain('# Seções (0)')
    expect(wordCount).toBeGreaterThan(0)
  })

  it('includes current locale label in content header', () => {
    // item is pt-br, target is en, so current locale shown is PT-BR
    const { text } = generatePrompt(baseItem, baseSections, 'en')
    expect(text).toContain('# Conteúdo Português (PT-BR)')
  })
})

// ---------------------------------------------------------------------------
// summarizeContent
// ---------------------------------------------------------------------------

describe('summarizeContent', () => {
  it('returns "Seção vazia" for null', () => {
    expect(summarizeContent(null)).toBe('Seção vazia')
  })

  it('returns "Seção vazia" for undefined', () => {
    expect(summarizeContent(undefined)).toBe('Seção vazia')
  })

  it('returns "Seção vazia" for empty string', () => {
    expect(summarizeContent('')).toBe('Seção vazia')
  })

  it('returns word count for plain string content', () => {
    const result = summarizeContent('one two three four five')
    expect(result).toContain('5 palavras')
  })

  it('returns word count for single-word string', () => {
    const result = summarizeContent('hello')
    expect(result).toContain('1 palavras')
  })

  it('summarizes JSON content with type:doc — headings and paragraphs', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'My Heading' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph text' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph' }] },
      ],
    }
    const result = summarizeContent(doc)
    expect(result).toContain('1 seções')
    expect(result).toContain('2 parágrafos')
  })

  it('summarizes JSON content word count', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'alpha beta gamma' }] },
      ],
    }
    const result = summarizeContent(doc)
    expect(result).toContain('3 palavras')
  })

  it('returns "Seção vazia" for JSONContent doc with no content property', () => {
    expect(summarizeContent({ type: 'doc' })).toBe('Seção vazia')
  })

  it('counts 0 words for JSONContent doc with empty content array', () => {
    const result = summarizeContent({ type: 'doc', content: [] })
    expect(result).toContain('0 palavras')
  })
})

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------

const baseBuildCtx = {
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

describe('buildPrompt', () => {
  it('returns text containing item code', () => {
    const result = buildPrompt(baseBuildCtx)
    expect(result).toContain('tg-01')
  })

  it('prepends baseUrl to paths when provided', () => {
    const result = buildPrompt({ ...baseBuildCtx, baseUrl: 'https://example.com' })
    expect(result).toContain('https://example.com/api/pipeline/docs/items-and-sections')
    expect(result).toContain('https://example.com/api/pipeline/items/abc-123')
  })

  it('does not prepend anything to paths when baseUrl is not provided', () => {
    const result = buildPrompt(baseBuildCtx)
    expect(result).toContain('/api/pipeline/docs/items-and-sections')
    // no host prefix
    expect(result).not.toContain('http')
  })

  it('includes modified_by in PATCH body', () => {
    const result = buildPrompt(baseBuildCtx)
    expect(result).toContain('"modified_by": "cowork-claude"')
  })

  it('expands citations from references map', () => {
    const refs = new Map<number, string>([[1, 'Some cited passage']])
    const result = buildPrompt({
      ...baseBuildCtx,
      instructions: 'Use [citacao 1] here',
      references: refs,
    })
    expect(result).toContain('[citacao 1: "Some cited passage"]')
  })

  it('leaves unknown citation tags unchanged', () => {
    const refs = new Map<number, string>([[1, 'Known']])
    const result = buildPrompt({
      ...baseBuildCtx,
      instructions: '[citacao 99] unknown',
      references: refs,
    })
    expect(result).toContain('[citacao 99]')
    expect(result).not.toContain('[citacao 99:')
  })

  it('includes docs fetch as step 0', () => {
    const result = buildPrompt(baseBuildCtx)
    expect(result).toContain('0. GET /api/pipeline/docs/items-and-sections')
  })

  it('includes section GET as step 1', () => {
    const result = buildPrompt(baseBuildCtx)
    expect(result).toContain('1. GET /api/pipeline/items/abc-123/sections/draft?lang=pt')
  })

  it('includes section PATCH as step 3', () => {
    const result = buildPrompt(baseBuildCtx)
    expect(result).toContain('3. PATCH /api/pipeline/items/abc-123/sections/draft?lang=pt')
  })

  it('includes X-Pipeline-Key auth instruction', () => {
    const result = buildPrompt(baseBuildCtx)
    expect(result).toContain('X-Pipeline-Key')
    expect(result).toContain('# Auth: include X-Pipeline-Key header in ALL requests.')
  })

  it('includes X-Expected-Version header instruction', () => {
    const result = buildPrompt(baseBuildCtx)
    expect(result).toContain('X-Expected-Version')
  })

  it('includes source cowork in PATCH body instruction', () => {
    const result = buildPrompt(baseBuildCtx)
    expect(result).toContain('"source": "cowork"')
  })

  it('includes rev in PATCH body instruction', () => {
    const result = buildPrompt(baseBuildCtx)
    expect(result).toContain('"rev"')
  })

  it('includes on-409 retry instruction', () => {
    const result = buildPrompt(baseBuildCtx)
    expect(result).toContain('On 409')
  })

  it('includes on-412 retry instruction', () => {
    const result = buildPrompt(baseBuildCtx)
    expect(result).toContain('On 412')
  })

  it('truncates long citation text at 500 chars', () => {
    const refs = new Map<number, string>([[1, 'Z'.repeat(600)]])
    const result = buildPrompt({
      ...baseBuildCtx,
      instructions: '[citacao 1] check',
      references: refs,
    })
    expect(result).toContain('[citacao 1: "' + 'Z'.repeat(500) + '..."]')
    expect(result).not.toContain('Z'.repeat(501))
  })
})
