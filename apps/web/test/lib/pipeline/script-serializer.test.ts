import { describe, it, expect } from 'vitest'
import { roteiroToTipTap, tipTapToRoteiro } from '@/lib/pipeline/script-serializer'
import type { RoteiroBeat, ScriptLine } from '@/lib/pipeline/roteiro-schemas'

describe('roteiroToTipTap', () => {
  it('converts spoken lines to italic paragraphs', () => {
    const beat: RoteiroBeat = {
      idx: 0, name: 'Hook', status: 'PENDING',
      script: [{ type: 'line', text: 'I lived in Canada.' }],
    }
    const doc = roteiroToTipTap(beat)
    expect(doc.type).toBe('doc')
    expect(doc.content).toHaveLength(1)
    expect(doc.content![0]!.type).toBe('paragraph')
    expect(doc.content![0]!.content![0]!.text).toBe('I lived in Canada.')
    expect(doc.content![0]!.content![0]!.marks).toContainEqual({ type: 'italic' })
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
})
