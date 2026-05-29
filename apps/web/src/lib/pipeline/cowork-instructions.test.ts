import { describe, it, expect } from 'vitest'

import { buildCoworkInstruction } from './cowork-instructions'

describe('buildCoworkInstruction', () => {
  const cases: Array<{ template: string; params: Record<string, string>; mustInclude: string[] }> = [
    {
      template: 'pipeline-section',
      params: { section: 'roteiro', code: 'V042' },
      mustInclude: ['roteiro', 'V042'],
    },
    {
      template: 'pipeline-translate',
      params: { code: 'V042', locale: 'en' },
      mustInclude: ['V042', 'en'],
    },
    {
      template: 'pipeline-empty-section',
      params: { section: 'ideia', code: 'V100' },
      mustInclude: ['ideia', 'V100'],
    },
    {
      template: 'youtube-ab-refine',
      params: { testId: 'ab-test-7' },
      mustInclude: ['ab-test-7'],
    },
    {
      template: 'youtube-intelligence',
      params: {},
      mustInclude: ['YouTube'],
    },
    {
      template: 'youtube-video-optimize',
      params: { title: 'My Great Video' },
      mustInclude: ['My Great Video'],
    },
    {
      template: 'playlist-organize',
      params: { name: 'Best Hits' },
      mustInclude: ['Best Hits'],
    },
    {
      template: 'reference-overview',
      params: {},
      mustInclude: ['pipeline'],
    },
    {
      template: 'audio-resolve',
      params: { code: 'V055' },
      mustInclude: ['V055'],
    },
  ]

  it.each(cases)('$template returns a non-empty string', ({ template, params }) => {
    const result = buildCoworkInstruction(template as Parameters<typeof buildCoworkInstruction>[0], params as never)
    expect(result).toBeTruthy()
    expect(result.length).toBeGreaterThan(0)
  })

  it.each(cases)('$template includes expected params', ({ template, params, mustInclude }) => {
    const result = buildCoworkInstruction(template as Parameters<typeof buildCoworkInstruction>[0], params as never)
    for (const value of mustInclude) {
      expect(result).toContain(value)
    }
  })

  it.each(cases)('$template ends with MCP suffix', ({ template, params }) => {
    const result = buildCoworkInstruction(template as Parameters<typeof buildCoworkInstruction>[0], params as never)
    expect(result).toMatch(/Use o MCP bythiagofigueiredo\.$/)
  })

  it.each(cases)('$template produces string under 200 chars with reasonable params', ({ template, params }) => {
    const result = buildCoworkInstruction(template as Parameters<typeof buildCoworkInstruction>[0], params as never)
    expect(result.length).toBeLessThan(200)
  })

  it('no-param templates work with empty object', () => {
    const intel = buildCoworkInstruction('youtube-intelligence', {} as Record<string, never>)
    expect(intel).toContain('YouTube')

    const overview = buildCoworkInstruction('reference-overview', {} as Record<string, never>)
    expect(overview).toContain('pipeline')
  })

  it('throws on unknown template', () => {
    expect(() =>
      buildCoworkInstruction('nonexistent' as Parameters<typeof buildCoworkInstruction>[0], {} as never),
    ).toThrow('Unknown template')
  })

  // --- Edge cases ---

  it('handles special characters in params (quotes, unicode, ampersands)', () => {
    const result = buildCoworkInstruction('pipeline-section', {
      section: "roteiro's \"best\" & más",
      code: 'V042-éção',
    })
    expect(result).toContain("roteiro's \"best\" & más")
    expect(result).toContain('V042-éção')
    expect(result).toMatch(/Use o MCP bythiagofigueiredo\.$/)

    const unicodeTitle = buildCoworkInstruction('youtube-video-optimize', {
      title: '🎬 Vídeo com emojis & <tags>',
    })
    expect(unicodeTitle).toContain('🎬 Vídeo com emojis & <tags>')
  })

  it('handles very long param values (500-char title)', () => {
    const longTitle = 'A'.repeat(500)
    const result = buildCoworkInstruction('youtube-video-optimize', { title: longTitle })
    expect(result).toContain(longTitle)
    expect(result.length).toBeGreaterThan(500)
    expect(result).toMatch(/Use o MCP bythiagofigueiredo\.$/)
  })

  it('handles empty string params', () => {
    const result = buildCoworkInstruction('pipeline-section', {
      section: '',
      code: '',
    } as { section: string; code: string })
    expect(typeof result).toBe('string')
    expect(result).toContain("''")
    expect(result).toMatch(/Use o MCP bythiagofigueiredo\.$/)
  })

  it('every template output ends with MCP suffix', () => {
    const allTemplates: Array<{ t: Parameters<typeof buildCoworkInstruction>[0]; p: Record<string, string> }> = [
      { t: 'pipeline-section', p: { section: 'x', code: 'X1' } },
      { t: 'pipeline-translate', p: { code: 'X1', locale: 'en' } },
      { t: 'pipeline-empty-section', p: { section: 'x', code: 'X1' } },
      { t: 'youtube-ab-refine', p: { testId: 'ab-1' } },
      { t: 'youtube-intelligence', p: {} },
      { t: 'youtube-video-optimize', p: { title: 'T' } },
      { t: 'playlist-organize', p: { name: 'P' } },
      { t: 'reference-overview', p: {} },
      { t: 'audio-resolve', p: { code: 'X1' } },
    ]

    for (const { t, p } of allTemplates) {
      const result = buildCoworkInstruction(t, p as never)
      expect(result.endsWith('Use o MCP bythiagofigueiredo.'), `Template '${t}' must end with MCP suffix`).toBe(true)
    }
  })

  it('template output is deterministic (same input, same output)', () => {
    const a1 = buildCoworkInstruction('pipeline-section', { section: 'roteiro', code: 'V042' })
    const a2 = buildCoworkInstruction('pipeline-section', { section: 'roteiro', code: 'V042' })
    expect(a1).toBe(a2)

    const b1 = buildCoworkInstruction('youtube-intelligence', {} as Record<string, never>)
    const b2 = buildCoworkInstruction('youtube-intelligence', {} as Record<string, never>)
    expect(b1).toBe(b2)

    const c1 = buildCoworkInstruction('reference-overview', {} as Record<string, never>)
    const c2 = buildCoworkInstruction('reference-overview', {} as Record<string, never>)
    expect(c1).toBe(c2)
  })
})
