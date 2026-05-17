import { describe, it, expect } from 'vitest'
import { parseScriptTags, type ScriptSegment } from '@/app/cms/(authed)/pipeline/_components/detail/renderers/parse-script-tags'

describe('parseScriptTags', () => {
  it('parses [VISUAL: ...] tag', () => {
    const segments = parseScriptTags('[VISUAL: talking head + fotos]')
    expect(segments).toEqual([{ type: 'tag', tag: 'VISUAL', content: 'talking head + fotos' }])
  })

  it('parses [TOM: ...] tag', () => {
    const segments = parseScriptTags('[TOM: calmo, confiante]')
    expect(segments).toEqual([{ type: 'tag', tag: 'TOM', content: 'calmo, confiante' }])
  })

  it('parses [B-ROLL: ...] tag', () => {
    const segments = parseScriptTags('[B-ROLL: fotos do Canada]')
    expect(segments).toEqual([{ type: 'tag', tag: 'B-ROLL', content: 'fotos do Canada' }])
  })

  it('parses [CORTE: ...] tag', () => {
    const segments = parseScriptTags('[CORTE: intercalar talking head]')
    expect(segments).toEqual([{ type: 'tag', tag: 'CORTE', content: 'intercalar talking head' }])
  })

  it('parses [PAUSE 0.5s]', () => {
    const segments = parseScriptTags('[PAUSE 0.5s]')
    expect(segments).toEqual([{ type: 'pause', duration: '0.5s' }])
  })

  it('promotes VISUAL to OVERLAY when content starts with "Text overlay"', () => {
    const segments = parseScriptTags('[VISUAL: Text overlay (large, center): "Am I here"]')
    expect(segments[0]).toEqual({ type: 'tag', tag: 'OVERLAY', content: 'Text overlay (large, center): "Am I here"' })
  })

  it('promotes VISUAL to OVERLAY when content starts with "Lower third"', () => {
    const segments = parseScriptTags('[VISUAL: Lower third with channel name]')
    expect(segments[0]).toEqual({ type: 'tag', tag: 'OVERLAY', content: 'Lower third with channel name' })
  })

  it('extracts quoted narration', () => {
    const segments = parseScriptTags('"I lived in Canada for four years."')
    expect(segments).toEqual([{ type: 'narration', content: 'I lived in Canada for four years.' }])
  })

  it('parses TRANSITION: as section', () => {
    const segments = parseScriptTags('TRANSITION: "And that realization..."')
    expect(segments[0]).toEqual({ type: 'section', label: 'TRANSITION', content: '"And that realization..."' })
  })

  it('parses MINI-HOOK: as section', () => {
    const segments = parseScriptTags('MINI-HOOK: "Let me take you back"')
    expect(segments[0]).toEqual({ type: 'section', label: 'MINI-HOOK', content: '"Let me take you back"' })
  })

  it('parses TALKING POINTS: as section', () => {
    const segments = parseScriptTags('TALKING POINTS: • The arrival')
    expect(segments[0]).toEqual({ type: 'section', label: 'TALKING POINTS', content: '• The arrival' })
  })

  it('parses Promessa: as meta', () => {
    const segments = parseScriptTags('Promessa: Why each move → the plan')
    expect(segments).toEqual([{ type: 'meta', key: 'Promessa', value: 'Why each move → the plan' }])
  })

  it('parses Credencial: as meta', () => {
    const segments = parseScriptTags('Credencial: Implícita — experiência real')
    expect(segments).toEqual([{ type: 'meta', key: 'Credencial', value: 'Implícita — experiência real' }])
  })

  it('handles a complex beat with mixed content', () => {
    const text = '[VISUAL: 3s — montage] [TOM: calmo, NÃO dramático] "I lived in Canada" [PAUSE 0.5s] "I chose to move back"'
    const segments = parseScriptTags(text)

    expect(segments[0]).toMatchObject({ type: 'tag', tag: 'VISUAL' })
    expect(segments[1]).toMatchObject({ type: 'tag', tag: 'TOM' })
    expect(segments[2]).toMatchObject({ type: 'narration', content: 'I lived in Canada' })
    expect(segments[3]).toMatchObject({ type: 'pause', duration: '0.5s' })
    expect(segments[4]).toMatchObject({ type: 'narration', content: 'I chose to move back' })
  })

  it('returns plain text as a single text segment when no tags found', () => {
    const segments = parseScriptTags('Just some plain text without any tags')
    expect(segments).toEqual([{ type: 'text', content: 'Just some plain text without any tags' }])
  })

  it('handles empty string', () => {
    expect(parseScriptTags('')).toEqual([])
  })

  it('converts ═══ separator lines to separator segments', () => {
    const text = 'Some text\n═══════════════════════════════════════════\n[VISUAL: next section]'
    const segments = parseScriptTags(text)
    expect(segments.some(s => s.type === 'separator')).toBe(true)
  })

  it('converts --- separator lines to separator segments', () => {
    const segments = parseScriptTags('Before\n---\nAfter')
    expect(segments.some(s => s.type === 'separator')).toBe(true)
  })
})
