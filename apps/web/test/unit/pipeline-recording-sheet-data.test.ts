import { describe, it, expect } from 'vitest'
import {
  recLineKind,
  recBeatLines,
  recSheetMeta,
  clampRsScale,
} from '@/lib/pipeline/recording-sheet-data'
import type { RoteiroBeatV3 } from '@/lib/pipeline/roteiro-schemas'

const beat = (over: Partial<RoteiroBeatV3> = {}): RoteiroBeatV3 => ({
  idx: 0,
  name: 'Abertura',
  status: 'PENDING',
  duration: 90,
  tone: 'Calmo, próximo',
  script: [
    { type: 'line', text: 'Olá **pessoal**', key: true },
    { type: 'pause', duration: 0.5 },
    { type: 'vis', text: 'B-roll da cidade' },
    { type: 'ed', text: 'Corte seco aqui' },
    { type: 'dir', text: 'NÃO deve aparecer' },
  ],
  ...over,
})

describe('recLineKind', () => {
  it('classifies line/pause/vis/ed and drops dir (renders nowhere on sheet)', () => {
    expect(recLineKind({ type: 'line', text: 'x' })).toBe('line')
    expect(recLineKind({ type: 'pause', duration: 1 })).toBe('pause')
    expect(recLineKind({ type: 'vis', text: 'x' })).toBe('vis')
    expect(recLineKind({ type: 'ed', text: 'x' })).toBe('ed')
    expect(recLineKind({ type: 'dir', text: 'x' })).toBe('skip')
  })
})

describe('recBeatLines', () => {
  it('with showEd=false keeps line+pause, hides vis/ed, never emits dir', () => {
    const lines = recBeatLines(beat(), false)
    expect(lines.map((l) => l.kind)).toEqual(['line', 'pause'])
  })

  it('with showEd=true reveals vis/ed, still never emits dir', () => {
    const lines = recBeatLines(beat(), true)
    expect(lines.map((l) => l.kind)).toEqual(['line', 'pause', 'vis', 'ed'])
    expect(lines.some((l) => l.kind === 'skip')).toBe(false)
  })

  it('carries key flag onto the line item', () => {
    const lines = recBeatLines(beat(), false)
    expect(lines[0]).toMatchObject({ kind: 'line', key: true })
  })
})

describe('recSheetMeta', () => {
  it('builds the meta row including tone presence and ~de fala via /2.1', () => {
    const meta = recSheetMeta([beat({ duration: 90 })])
    expect(meta.beatsCount).toBe(1)
    // "Olá pessoal" = 2 words → max(1, round(2/2.1)) = 1s; videoBeatRead ceil(2/2.1 + 0.5) = ceil(1.452) = 2
    expect(meta.readSeconds).toBe(2)
  })
})

describe('clampRsScale', () => {
  it('clamps to [0.85, 1.4] and rounds to 2 decimals', () => {
    expect(clampRsScale(1, 0.05)).toBe(1.05)
    expect(clampRsScale(1.4, 0.05)).toBe(1.4)
    expect(clampRsScale(0.85, -0.05)).toBe(0.85)
    expect(clampRsScale(1.123, 0)).toBe(1.12)
  })
})
