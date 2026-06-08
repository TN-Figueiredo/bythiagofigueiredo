import { describe, it, expect } from 'vitest'
import { keyLineText, visNotes, deriveMomentos, deriveBroll } from '@/lib/pipeline/video-pos-derive'
import type { RoteiroBeatV3 } from '@/lib/pipeline/video-schemas'

const beatA: RoteiroBeatV3 = {
  idx: 0, name: 'Abertura', status: 'PENDING',
  script: [
    { type: 'line', text: 'Linha comum' },
    { type: 'line', text: 'Linha **chave**', key: true },
    { type: 'vis', text: 'B-roll: drone sobre a praia' },
    { type: 'pause', duration: 0.5 },
    { type: 'vis', text: 'B-roll: close no mapa' },
    { type: 'ed', text: 'Editor: corta o silêncio' },
  ],
}
const beatB: RoteiroBeatV3 = {
  idx: 1, name: 'Sem key', status: 'PENDING',
  script: [{ type: 'line', text: 'Primeira fala' }, { type: 'line', text: 'Segunda fala' }],
}
const beatEmpty: RoteiroBeatV3 = { idx: 2, name: 'Vazio', status: 'PENDING', script: [] }

describe('keyLineText', () => {
  it('returns the first key line text', () => {
    expect(keyLineText(beatA)).toBe('Linha **chave**')
  })
  it('falls back to the first line when no key line', () => {
    expect(keyLineText(beatB)).toBe('Primeira fala')
  })
  it('returns empty string when no line items', () => {
    expect(keyLineText(beatEmpty)).toBe('')
  })
})

describe('visNotes', () => {
  it('collects all vis item texts in order, never ed/line', () => {
    expect(visNotes(beatA)).toEqual(['B-roll: drone sobre a praia', 'B-roll: close no mapa'])
  })
  it('returns empty array when no vis items', () => {
    expect(visNotes(beatB)).toEqual([])
  })
})

describe('deriveMomentos (#1-indexed)', () => {
  it('maps beats to {n, beatName, text}, 1-indexed, skipping empty key text', () => {
    expect(deriveMomentos([beatA, beatB])).toEqual([
      { n: 1, beatName: 'Abertura', text: 'Linha **chave**' },
      { n: 2, beatName: 'Sem key', text: 'Primeira fala' },
    ])
  })
})

describe('deriveBroll (#1-indexed)', () => {
  it('maps beats to {n, beatName, notes}, 1-indexed, only beats with vis', () => {
    expect(deriveBroll([beatA, beatB])).toEqual([
      { n: 1, beatName: 'Abertura', notes: ['B-roll: drone sobre a praia', 'B-roll: close no mapa'] },
    ])
  })
})
