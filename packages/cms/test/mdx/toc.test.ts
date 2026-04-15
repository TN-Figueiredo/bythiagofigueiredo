import { describe, it, expect } from 'vitest'
import { extractToc } from '../../src/mdx/toc'

describe('extractToc', () => {
  it('extracts headings with depth, text, slug', () => {
    const source = `# Intro\n\nsome text\n\n## Section A\n\nmore\n\n### Sub A1\n\n## Section B`
    const toc = extractToc(source)
    expect(toc).toEqual([
      { depth: 1, text: 'Intro', slug: 'intro' },
      { depth: 2, text: 'Section A', slug: 'section-a' },
      { depth: 3, text: 'Sub A1', slug: 'sub-a1' },
      { depth: 2, text: 'Section B', slug: 'section-b' },
    ])
  })

  it('ignores code blocks that look like headings', () => {
    const source = '```\n# not a heading\n```\n\n# Real Heading'
    const toc = extractToc(source)
    expect(toc.length).toBe(1)
    expect(toc[0]?.text).toBe('Real Heading')
  })

  it('returns empty for no headings', () => {
    expect(extractToc('just text')).toEqual([])
  })
})
