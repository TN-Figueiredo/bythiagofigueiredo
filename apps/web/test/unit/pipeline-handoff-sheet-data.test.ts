import { describe, it, expect } from 'vitest'
import { handoffBeatRows } from '@/lib/pipeline/handoff-sheet-data'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'

const beats: RoteiroBeatV3[] = [
  {
    idx: 0,
    name: 'Abertura',
    status: 'PENDING',
    duration: 90,
    script: [
      { type: 'line', text: 'Linha normal' },
      { type: 'line', text: 'Linha âncora', key: true },
      { type: 'vis', text: 'B-roll cidade' },
      { type: 'vis', text: 'B-roll closeup' },
    ],
  },
  {
    idx: 1,
    name: 'Desenvolvimento',
    status: 'PENDING',
    duration: 120,
    script: [{ type: 'line', text: 'Só uma linha' }],
  },
]

describe('handoffBeatRows', () => {
  it('1-indexes display numbers (#{i+1}, fixes prototype off-by-one)', () => {
    const rows = handoffBeatRows(beats)
    expect(rows.map((r) => r.displayNum)).toEqual([1, 2])
  })

  it('derives anchor from the key line (fallback first line) and all vis cues', () => {
    const rows = handoffBeatRows(beats)
    expect(rows[0]).toMatchObject({ name: 'Abertura', anchor: 'Linha âncora' })
    expect(rows[0].cues).toEqual(['B-roll cidade', 'B-roll closeup'])
    expect(rows[1]).toMatchObject({ name: 'Desenvolvimento', anchor: 'Só uma linha' })
    expect(rows[1].cues).toEqual([])
  })

  it('carries beat target duration for the #N · dur display', () => {
    const rows = handoffBeatRows(beats)
    expect(rows.map((r) => r.duration)).toEqual([90, 120])
  })

  it('drops non-spoken, cue-less beats (KIT/MUST-GET/TIMELINE/PLAYBOOK) so it reads as a brief, not a roteiro dump', () => {
    const withNonSpoken: RoteiroBeatV3[] = [
      { idx: 0, name: 'KIT', status: 'PENDING', duration: 0, script: [] },
      ...beats,
      { idx: 3, name: 'PLAYBOOK', status: 'PENDING', script: [] },
    ]
    const rows = handoffBeatRows(withNonSpoken)
    // Only the two spoken beats survive.
    expect(rows.map((r) => r.name)).toEqual(['Abertura', 'Desenvolvimento'])
  })

  it('numbers contiguously over the FILTERED list (no gaps from dropped beats)', () => {
    const withNonSpoken: RoteiroBeatV3[] = [
      { idx: 0, name: 'KIT', status: 'PENDING', script: [] }, // dropped → does NOT consume #1
      beats[0],
      { idx: 2, name: 'TIMELINE', status: 'PENDING', script: [] }, // dropped between two spoken beats
      beats[1],
    ]
    const rows = handoffBeatRows(withNonSpoken)
    expect(rows.map((r) => r.displayNum)).toEqual([1, 2])
    expect(rows.map((r) => r.name)).toEqual(['Abertura', 'Desenvolvimento'])
  })

  it('keeps a b-roll-only beat (cues but no spoken anchor)', () => {
    const brollOnly: RoteiroBeatV3[] = [
      { idx: 0, name: 'Montagem', status: 'PENDING', script: [{ type: 'vis', text: 'B-roll drone' }] },
    ]
    const rows = handoffBeatRows(brollOnly)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ displayNum: 1, name: 'Montagem', anchor: '' })
    expect(rows[0].cues).toEqual(['B-roll drone'])
  })

  describe('source identity for the Pós cards (one numbering everywhere)', () => {
    it('carries the RAW beat index + override key alongside the contiguous displayNum', () => {
      const withNonSpoken: RoteiroBeatV3[] = [
        { idx: 0, name: 'KIT', status: 'PENDING', script: [] }, // dropped
        ...beats,
      ]
      const rows = handoffBeatRows(withNonSpoken)
      // displayNum is contiguous over the projection; beatIndex/overrideKey keep the RAW source
      expect(rows[0]).toMatchObject({ displayNum: 1, beatIndex: 1, overrideKey: 'i1', name: 'Abertura' })
      expect(rows[1]).toMatchObject({ displayNum: 2, beatIndex: 2, overrideKey: 'i2', name: 'Desenvolvimento' })
    })

    it('uses the durable beat id as the overrideKey when present', () => {
      const withIds: RoteiroBeatV3[] = beats.map((b, i) => ({ ...b, id: `beat-${i}` }))
      const rows = handoffBeatRows(withIds)
      expect(rows.map((r) => r.overrideKey)).toEqual(['beat-0', 'beat-1'])
    })

    it('exposes the momento cue (override.cue ?? first vis) and the ov shadow flags', () => {
      const derived = handoffBeatRows(beats)
      expect(derived[0].cue).toBe('B-roll cidade')
      expect(derived[0].ov).toEqual({ line: false, cue: false, broll: false })
      const rows = handoffBeatRows(beats, { i0: { cue: 'Cue editado' } })
      expect(rows[0].cue).toBe('Cue editado')
      expect(rows[0].cues).toEqual(['B-roll cidade', 'B-roll closeup']) // broll stays derived
      expect(rows[0].ov).toEqual({ line: false, cue: true, broll: false })
    })
  })

  describe('PosBrief per-beat overrides (printed sheet = Pós screen)', () => {
    it('an override shadows the derived anchor and b-roll for its beat only', () => {
      const rows = handoffBeatRows(beats, {
        i0: { line: 'Âncora editada na Pós', broll: ['B-roll novo'] },
      })
      expect(rows[0]).toMatchObject({ name: 'Abertura', anchor: 'Âncora editada na Pós' })
      expect(rows[0].cues).toEqual(['B-roll novo'])
      // the other beat stays fully derived
      expect(rows[1]).toMatchObject({ name: 'Desenvolvimento', anchor: 'Só uma linha' })
      expect(rows[1].cues).toEqual([])
    })

    it('a partial override leaves the other field derived', () => {
      const rows = handoffBeatRows(beats, { i0: { line: 'Só a frase mudou' } })
      expect(rows[0].anchor).toBe('Só a frase mudou')
      expect(rows[0].cues).toEqual(['B-roll cidade', 'B-roll closeup']) // derived intact
    })

    it('absent override key (cleared) falls back to the derivation', () => {
      const withOv = handoffBeatRows(beats, { i0: { line: 'edit' } })
      const cleared = handoffBeatRows(beats, {})
      expect(withOv[0].anchor).toBe('edit')
      expect(cleared[0].anchor).toBe('Linha âncora')
      expect(handoffBeatRows(beats)).toEqual(cleared) // no-arg ≡ empty overrides
    })

    it('matches overrides by the beat durable id when present', () => {
      const withIds: RoteiroBeatV3[] = beats.map((b, i) => ({ ...b, id: `beat-${i}` }))
      const rows = handoffBeatRows(withIds, { 'beat-1': { line: 'Por id, não por índice' } })
      expect(rows[1].anchor).toBe('Por id, não por índice')
      // a positional key does NOT match an id-stamped beat
      const miss = handoffBeatRows(withIds, { i1: { line: 'não casa' } })
      expect(miss[1].anchor).toBe('Só uma linha')
    })
  })
})
