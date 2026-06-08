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
    expect(rows[1]).toMatchObject({ name: 'Só uma linha'.length ? 'Desenvolvimento' : '', anchor: 'Só uma linha' })
    expect(rows[1].cues).toEqual([])
  })

  it('carries beat target duration for the #N · dur display', () => {
    const rows = handoffBeatRows(beats)
    expect(rows.map((r) => r.duration)).toEqual([90, 120])
  })
})
