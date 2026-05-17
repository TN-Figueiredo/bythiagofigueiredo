import { describe, it, expect } from 'vitest'
import { parseTemplateTokens, resolveTemplates } from '@/lib/youtube/ab-templates'

describe('parseTemplateTokens', () => {
  it('extracts unique template names from text', () => {
    const text = '📩 Newsletter: {{link:newsletter}}\n🎓 Curso: {{link:curso}}'
    const result = parseTemplateTokens(text)
    expect(result).toEqual(['newsletter', 'curso'])
  })

  it('returns empty array for text without templates', () => {
    expect(parseTemplateTokens('plain text')).toEqual([])
  })

  it('deduplicates repeated template names', () => {
    const text = '{{link:news}} and {{link:news}} again'
    expect(parseTemplateTokens(text)).toEqual(['news'])
  })

  it('handles edge cases: empty string, only whitespace', () => {
    expect(parseTemplateTokens('')).toEqual([])
    expect(parseTemplateTokens('   ')).toEqual([])
  })

  it('ignores malformed templates', () => {
    const text = '{{link:}} and {{link}} and {{ link:foo }}'
    expect(parseTemplateTokens(text)).toEqual([])
  })
})

describe('resolveTemplates', () => {
  it('replaces template tokens with resolved URLs', () => {
    const text = '📩 Newsletter: {{link:newsletter}}\n🎓 Curso: {{link:curso}}'
    const linkMap = {
      newsletter: 'go.bythiagofigueiredo.com/news-b',
      curso: 'go.bythiagofigueiredo.com/curso-b',
    }
    const result = resolveTemplates(text, linkMap)
    expect(result).toBe('📩 Newsletter: go.bythiagofigueiredo.com/news-b\n🎓 Curso: go.bythiagofigueiredo.com/curso-b')
  })

  it('leaves unresolved templates as-is', () => {
    const text = '{{link:known}} and {{link:unknown}}'
    const linkMap = { known: 'go.example.com/abc' }
    const result = resolveTemplates(text, linkMap)
    expect(result).toBe('go.example.com/abc and {{link:unknown}}')
  })

  it('returns original text when linkMap is empty', () => {
    const text = 'No links here'
    expect(resolveTemplates(text, {})).toBe('No links here')
  })
})
