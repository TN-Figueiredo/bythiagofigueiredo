// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { beatKind, splitBeats, markableIdxs, beatSections } from '@/lib/pipeline/video-perform'
import { videoLineKeys } from '@/lib/pipeline/video-read-math'
import type { RoteiroBeatV3, RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'

const beat = (name: string, script: RoteiroBeatV3['script'] = [], kind?: RoteiroBeatV3['kind']): RoteiroBeatV3 => ({
  idx: 0, name, status: 'PENDING', script, ...(kind ? { kind } : {}),
})

describe('beatKind — heuristic classifier (legacy, no explicit kind)', () => {
  it('classifies shoot-day logistics as prep', () => {
    expect(beatKind(beat('KIT (resolver hoje à noite)'))).toBe('prep')
    expect(beatKind(beat('TIMELINE DE CAPTURA'))).toBe('prep')
    expect(beatKind(beat('6 MUST-GET'))).toBe('prep')
  })
  it('classifies coverage lists as editor', () => {
    expect(beatKind(beat('B-ROLL SHOT LIST (por seção)'))).toBe('editor')
    expect(beatKind(beat('Imagens de apoio (cutaways)'))).toBe('editor')
  })
  it('does NOT mis-file spoken beats whose names share a generic word', () => {
    expect(beatKind(beat('Minha Abordagem Contrarian'))).toBe('fala')
    expect(beatKind(beat('O Setup Mental Pra Aprender'))).toBe('fala')
    expect(beatKind(beat('As Perguntas Que Todo Mundo Faz'))).toBe('fala')
  })
  it('classifies interview/capture beats as acao', () => {
    expect(beatKind(beat('ENTRADAS + PERGUNTAS (estilo The Game)'))).toBe('acao')
    expect(beatKind(beat('Verticais (Shorts)'))).toBe('acao')
  })
  it('defaults to fala for spoken beats', () => {
    expect(beatKind(beat('HOOK'))).toBe('fala')
    expect(beatKind(beat('POR QUE SEGUIR #1'))).toBe('fala')
    expect(beatKind(beat('Abertura'))).toBe('fala')
  })
  it('explicit kind always wins over the heuristic', () => {
    expect(beatKind(beat('B-ROLL SHOT LIST', [], 'fala'))).toBe('fala')
    expect(beatKind(beat('HOOK', [], 'prep'))).toBe('prep')
  })
  it('classifies common ENGLISH beat names (multi-lang system)', () => {
    // prep — logistics
    expect(beatKind(beat('Gear checklist'))).toBe('prep')
    expect(beatKind(beat('Shoot timeline'))).toBe('prep')
    expect(beatKind(beat('Packing list'))).toBe('prep')
    expect(beatKind(beat('Must-get shots'))).toBe('prep')
    // editor — coverage
    expect(beatKind(beat('B-roll shot list'))).toBe('editor')
    expect(beatKind(beat('Broll coverage'))).toBe('editor')
    expect(beatKind(beat('Cutaway overlay'))).toBe('editor')
    // acao — on-camera actions
    expect(beatKind(beat('Interview questions'))).toBe('acao')
    expect(beatKind(beat('B-roll capture'))).toBe('editor') // 'b-roll' is editor-first
    expect(beatKind(beat('Street approach'))).toBe('acao')
    expect(beatKind(beat('Verticals (Shorts)'))).toBe('acao')
  })
  it('does NOT mis-file ENGLISH spoken beats as prep/editor/acao', () => {
    expect(beatKind(beat('Why I moved'))).toBe('fala')
    expect(beatKind(beat('The mindset shift'))).toBe('fala')
    expect(beatKind(beat('What nobody tells you'))).toBe('fala')
  })
})

describe('splitBeats — three lanes', () => {
  const content: RoteiroContentV3 = {
    version: 3, meta: {},
    beats: [
      beat('KIT'),
      beat('HOOK', [{ type: 'line', text: 'Olha isso.' }]),
      beat('ENTRADAS + PERGUNTAS', [{ type: 'action', text: 'Pergunta 1' }]),
      beat('B-ROLL SHOT LIST'),
      beat('FECHO', [{ type: 'line', text: 'Se inscreve.' }]),
    ],
  }
  it('routes beats to performer / prep / editor by kind', () => {
    const { performer, prep, editor } = splitBeats(content)
    expect(performer.map((b) => b.beat.name)).toEqual(['HOOK', 'ENTRADAS + PERGUNTAS', 'FECHO'])
    expect(prep.map((b) => b.beat.name)).toEqual(['KIT'])
    expect(editor.map((b) => b.beat.name)).toEqual(['B-ROLL SHOT LIST'])
  })
  it('preserves the original beat index for stable keys/anchors', () => {
    const { performer } = splitBeats(content)
    expect(performer.map((b) => b.idx)).toEqual([1, 2, 4])
  })
})

describe('videoLineKeys — reading clock counts only fala spoken lines', () => {
  it('excludes prep, editor, and acao beats from the cursor index', () => {
    const content: RoteiroContentV3 = {
      version: 3, meta: {},
      beats: [
        beat('KIT', [{ type: 'line', text: 'Mic + power bank' }]),               // prep — excluded
        beat('HOOK', [{ type: 'line', text: 'A' }, { type: 'line', text: 'B' }]), // fala — 2 keys
        beat('ENTRADAS + PERGUNTAS', [{ type: 'line', text: 'Prompt' }]),          // acao — excluded
        beat('B-ROLL', [{ type: 'line', text: 'orla vazia' }]),                   // editor — excluded
      ],
    }
    expect(videoLineKeys(content)).toEqual(['1-0', '1-1'])
  })
})

describe('markableIdxs — what each beat tracks', () => {
  it('fala beat tracks line items', () => {
    const b = beat('HOOK', [{ type: 'line', text: 'x' }, { type: 'pause', duration: 0.5 }, { type: 'line', text: 'y' }])
    expect(markableIdxs(b, 'fala')).toEqual([0, 2])
  })
  it('acao beat tracks action AND legacy line items', () => {
    const b = beat('ENTRADAS', [{ type: 'action', text: 'a' }, { type: 'line', text: 'legacy prompt' }, { type: 'dir', text: 'tom' }])
    expect(markableIdxs(b, 'acao')).toEqual([0, 1])
  })
})

describe('beatSections — derived print sub-sections', () => {
  it('groups consecutive line items into one section', () => {
    const b = beat('HOOK', [
      { type: 'line', text: 'A' },
      { type: 'line', text: 'B' },
      { type: 'line', text: 'C' },
    ])
    const secs = beatSections(b, 0)
    expect(secs).toEqual([{ id: '0-s0', beatIdx: 0, lineIdxs: [0, 1, 2] }])
  })
  it('a pause does NOT flush the section (stays inside)', () => {
    const b = beat('HOOK', [
      { type: 'line', text: 'A' },
      { type: 'pause', duration: 1 },
      { type: 'line', text: 'B' },
    ])
    const secs = beatSections(b, 0)
    expect(secs).toEqual([{ id: '0-s0', beatIdx: 0, lineIdxs: [0, 2] }])
  })
  it('flushes a section at action/dir/vis/ed items', () => {
    const b = beat('HOOK', [
      { type: 'line', text: 'A' },
      { type: 'line', text: 'B' },
      { type: 'dir', text: 'tom' },
      { type: 'line', text: 'C' },
      { type: 'vis', text: 'b-roll' },
      { type: 'line', text: 'D' },
    ])
    const secs = beatSections(b, 2)
    expect(secs).toEqual([
      { id: '2-s0', beatIdx: 2, lineIdxs: [0, 1] },
      { id: '2-s3', beatIdx: 2, lineIdxs: [3] },
      { id: '2-s5', beatIdx: 2, lineIdxs: [5] },
    ])
  })
  it('produces no section for empty runs / no line items', () => {
    expect(beatSections(beat('EMPTY'), 0)).toEqual([])
    expect(beatSections(beat('A', [{ type: 'action', text: 'x' }, { type: 'dir', text: 't' }]), 0)).toEqual([])
  })
  it('ids anchor on the first line script index of each section', () => {
    const b = beat('HOOK', [
      { type: 'action', text: 'x' },
      { type: 'line', text: 'A' },
      { type: 'line', text: 'B' },
    ])
    expect(beatSections(b, 1)).toEqual([{ id: '1-s1', beatIdx: 1, lineIdxs: [1, 2] }])
  })
})
