import { describe, it, expect } from 'vitest'
import { roteiroToTipTap, tipTapToRoteiro } from '@/lib/pipeline/script-serializer'
import type { RoteiroBeat, ScriptLine } from '@/lib/pipeline/roteiro-schemas'

describe('roteiroToTipTap', () => {
  it('converts spoken lines to plain paragraphs (no forced italic)', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'Hook', status: 'PENDING',
      script: [{ type: 'line', text: 'I lived in Canada.' }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.type).toBe('doc')
    expect(doc.content).toHaveLength(1)
    expect(doc.content![0]!.type).toBe('paragraph')
    expect(doc.content![0]!.content![0]!.text).toBe('I lived in Canada.')
    expect(doc.content![0]!.content![0]!.marks).toBeUndefined()
  })

  it('converts pause to scriptPause node', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'X', status: 'PENDING',
      script: [{ type: 'pause', duration: 0.5 }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.content![0]!.type).toBe('scriptPause')
    expect(doc.content![0]!.attrs?.duration).toBe(0.5)
  })

  it('converts note to scriptTag node', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'X', status: 'PENDING',
      script: [{ type: 'note', tag: 'VISUAL', text: 'talking head' }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.content![0]!.type).toBe('scriptTag')
    expect(doc.content![0]!.attrs?.tag).toBe('VISUAL')
  })

  it('converts ref to blockquote', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'X', status: 'PENDING',
      script: [{ type: 'ref', text: 'see other document' }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.content![0]!.type).toBe('blockquote')
  })

  it('returns empty doc with paragraph for empty script', () => {
    const beat: RoteiroBeat = { idx: 0, name: 'X', status: 'PENDING', script: [] }
    const doc = roteiroToTipTap(beat)
    expect(doc.content).toHaveLength(1)
    expect(doc.content![0]!.type).toBe('paragraph')
  })
})

describe('tipTapToRoteiro', () => {
  it('converts italic paragraph to line', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello world', marks: [{ type: 'italic' }] }],
      }],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toEqual([{ type: 'line', text: 'Hello world', accent: undefined }])
  })

  it('converts scriptPause to pause', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'scriptPause', attrs: { duration: 1.5 } }],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toEqual([{ type: 'pause', duration: 1.5 }])
  })

  it('converts scriptTag to note', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'scriptTag',
        attrs: { tag: 'DIRECTION' },
        content: [{ type: 'text', text: 'calm delivery' }],
      }],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toEqual([{ type: 'note', tag: 'DIRECTION', text: 'calm delivery' }])
  })

  it('converts blockquote to ref, stripping REF prefix', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'REF ', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'see other doc' },
          ],
        }],
      }],
    }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toEqual([{ type: 'ref', text: 'see other doc' }])
  })

  it('skips empty paragraphs', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph' }] }
    const lines = tipTapToRoteiro(doc)
    expect(lines).toEqual([])
  })
})

describe('roundtrip', () => {
  it('preserves data through roteiroToTipTap -> tipTapToRoteiro', () => {
    const script: ScriptLine[] = [
      { type: 'note', tag: 'VISUAL', text: '3s montage' },
      { type: 'note', tag: 'DIRECTION', text: 'calm, no drama' },
      { type: 'line', text: 'I lived in Canada for four years.' },
      { type: 'pause', duration: 0.5 },
      { type: 'line', text: 'I chose to move back.' },
      { type: 'ref', text: 'Double promise + plan for Asia' },
    ]
    const beat: RoteiroBeat = { idx: 0, name: 'Hook', status: 'PENDING', script }
    const doc = roteiroToTipTap(beat)
    const result = tipTapToRoteiro(doc)
    // Types and texts should match (accent may differ)
    expect(result.map(l => l.type)).toEqual(script.map(l => l.type))
    for (let i = 0; i < script.length; i++) {
      if ('text' in script[i]! && 'text' in result[i]!) {
        expect((result[i] as { text: string }).text).toBe((script[i] as { text: string }).text)
      }
    }
  })

  it('full roundtrip produces identical script lines', () => {
    const script: ScriptLine[] = [
      { type: 'line', text: 'Opening statement.' },
      { type: 'note', tag: 'NARRACAO', text: 'voiceover tone' },
      { type: 'pause', duration: 2 },
      { type: 'ref', text: 'research doc link' },
      { type: 'line', text: 'Closing remark.', accent: '#ff0000' },
    ]
    const beat: RoteiroBeat = { idx: 1, name: 'Intro', status: 'DONE', script }
    const doc = roteiroToTipTap(beat)
    const result = tipTapToRoteiro(doc)
    expect(result).toEqual(script)
  })

  it('empty beat roundtrips to empty array', () => {
    const beat: RoteiroBeat = { idx: 0, name: 'Empty', status: 'PENDING', script: [] }
    const doc = roteiroToTipTap(beat)
    // Empty script should produce a doc with one empty paragraph
    expect(doc).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    // Converting that empty doc back should yield no script lines
    const result = tipTapToRoteiro(doc)
    expect(result).toEqual([])
  })

  it('pause with duration 0 serializes correctly', () => {
    const script: ScriptLine[] = [{ type: 'pause', duration: 0 }]
    const beat: RoteiroBeat = { idx: 0, name: 'P', status: 'PENDING', script }
    const doc = roteiroToTipTap(beat)
    expect(doc.content![0]).toEqual({ type: 'scriptPause', attrs: { duration: 0 } })
    const result = tipTapToRoteiro(doc)
    expect(result).toEqual([{ type: 'pause', duration: 0 }])
  })

  it('ref whose text starts with "REF " does not double-strip', () => {
    const script: ScriptLine[] = [{ type: 'ref', text: 'REF internal note' }]
    const beat: RoteiroBeat = { idx: 0, name: 'R', status: 'PENDING', script }
    const doc = roteiroToTipTap(beat)
    // TipTap doc should have: bold "REF " + "REF internal note"
    const bq = doc.content![0]!
    expect(bq.type).toBe('blockquote')
    const paraContent = bq.content![0]!.content!
    expect(paraContent[0]!.text).toBe('REF ')
    expect(paraContent[1]!.text).toBe('REF internal note')
    // tipTapToRoteiro extracts "REF REF internal note", strips first "REF " -> "REF internal note"
    const result = tipTapToRoteiro(doc)
    expect(result).toEqual([{ type: 'ref', text: 'REF internal note' }])
  })

  it('mixed content order [note, line, pause, line, ref] preserves order', () => {
    const script: ScriptLine[] = [
      { type: 'note', tag: 'VISUAL', text: 'wide shot' },
      { type: 'line', text: 'First sentence.' },
      { type: 'pause', duration: 1.5 },
      { type: 'line', text: 'Second sentence.' },
      { type: 'ref', text: 'source document' },
    ]
    const beat: RoteiroBeat = { idx: 0, name: 'Mix', status: 'PENDING', script }
    const doc = roteiroToTipTap(beat)
    const result = tipTapToRoteiro(doc)
    expect(result).toEqual(script)
  })
})

describe('edge cases', () => {
  it('line with accent but no text content is skipped on deserialization', () => {
    // roteiroToTipTap would not normally produce this (line requires text),
    // but TipTap editor could yield an empty paragraph with a highlight mark
    const doc = {
      type: 'doc' as const,
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: '', marks: [{ type: 'highlight', attrs: { color: '#00ff00' } }] }],
      }],
    }
    const result = tipTapToRoteiro(doc)
    // extractText returns '' for the empty text node, so paragraph is skipped
    expect(result).toEqual([])
  })

  it('scriptTag with missing tag attribute falls back to VISUAL', () => {
    const doc = {
      type: 'doc' as const,
      content: [{
        type: 'scriptTag',
        attrs: {},
        content: [{ type: 'text', text: 'some direction' }],
      }],
    }
    const result = tipTapToRoteiro(doc)
    expect(result).toEqual([{ type: 'note', tag: 'VISUAL', text: 'some direction' }])
  })

  it('scriptTag with undefined attrs falls back to VISUAL', () => {
    const doc = {
      type: 'doc' as const,
      content: [{
        type: 'scriptTag',
        content: [{ type: 'text', text: 'no attrs at all' }],
      }],
    }
    const result = tipTapToRoteiro(doc)
    expect(result).toEqual([{ type: 'note', tag: 'VISUAL', text: 'no attrs at all' }])
  })
})
