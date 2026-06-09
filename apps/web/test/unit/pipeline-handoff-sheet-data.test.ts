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
})
