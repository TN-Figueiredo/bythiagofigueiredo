// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  nextStatus,
  ensureBeatIds,
  normalizeBeatText,
  beatContentHash,
  type RecStatus,
} from '@/lib/pipeline/video-recording'
import type { RoteiroBeatV3, RoteiroContentV3 } from '@/lib/pipeline/roteiro-schemas'

const beat = (
  name: string,
  script: RoteiroBeatV3['script'] = [],
  extra: Partial<RoteiroBeatV3> = {},
): RoteiroBeatV3 => ({ idx: 0, name, status: 'PENDING', script, ...extra })

const content = (beats: RoteiroBeatV3[]): RoteiroContentV3 => ({ version: 3, meta: {}, beats })

describe('nextStatus — 3-state cycle', () => {
  it('cycles pendente → gravada → refazer → pendente', () => {
    expect(nextStatus('pendente')).toBe('gravada')
    expect(nextStatus('gravada')).toBe('refazer')
    expect(nextStatus('refazer')).toBe('pendente')
  })
  it('is total over the union (round-trips in 3 steps)', () => {
    const states: RecStatus[] = ['pendente', 'gravada', 'refazer']
    for (const s of states) {
      expect(nextStatus(nextStatus(nextStatus(s)))).toBe(s)
    }
  })
})

describe('ensureBeatIds — stable id stamping', () => {
  it('assigns ids to beats missing one and flags changed', () => {
    const input = content([beat('HOOK'), beat('FECHO')])
    const { content: out, changed } = ensureBeatIds(input)
    expect(changed).toBe(true)
    expect(out.beats.every((b) => typeof b.id === 'string' && b.id.length > 0)).toBe(true)
    // unique ids
    expect(new Set(out.beats.map((b) => b.id)).size).toBe(2)
  })
  it('does not mutate the input', () => {
    const input = content([beat('HOOK')])
    const before = JSON.stringify(input)
    ensureBeatIds(input)
    expect(JSON.stringify(input)).toBe(before)
    expect(input.beats[0]!.id).toBeUndefined()
  })
  it('preserves existing ids and reports changed=false when all present', () => {
    const input = content([beat('HOOK', [], { id: 'fixed-1' }), beat('FECHO', [], { id: 'fixed-2' })])
    const { content: out, changed } = ensureBeatIds(input)
    expect(changed).toBe(false)
    expect(out.beats.map((b) => b.id)).toEqual(['fixed-1', 'fixed-2'])
  })
  it('only stamps the missing ids in a mixed content (changed=true)', () => {
    const input = content([beat('HOOK', [], { id: 'fixed-1' }), beat('FECHO')])
    const { content: out, changed } = ensureBeatIds(input)
    expect(changed).toBe(true)
    expect(out.beats[0]!.id).toBe('fixed-1')
    expect(out.beats[1]!.id).toBeTruthy()
  })
})

describe('normalizeBeatText — change detection text', () => {
  it('concatenates spoken line and action texts', () => {
    const b = beat('HOOK', [
      { type: 'line', text: 'Olha isso' },
      { type: 'action', text: 'aponta pra tela' },
    ])
    expect(normalizeBeatText(b)).toBe('Olha isso aponta pra tela')
  })
  it('strips ** emphasis markers and collapses whitespace', () => {
    const b = beat('HOOK', [{ type: 'line', text: '  **Isso**   é    importante  ' }])
    expect(normalizeBeatText(b)).toBe('Isso é importante')
  })
  it('ignores dir/vis/ed/pause items', () => {
    const b = beat('HOOK', [
      { type: 'line', text: 'fala' },
      { type: 'pause', duration: 1 },
      { type: 'dir', text: 'tom calmo' },
      { type: 'vis', text: 'b-roll' },
      { type: 'ed', text: 'corta aqui' },
    ])
    expect(normalizeBeatText(b)).toBe('fala')
  })
  it('returns empty string for an empty beat', () => {
    expect(normalizeBeatText(beat('EMPTY'))).toBe('')
  })
})

describe('beatContentHash — stable sync hash', () => {
  it('is deterministic for the same text', () => {
    const b = beat('HOOK', [{ type: 'line', text: 'Olha isso' }])
    expect(beatContentHash(b)).toBe(beatContentHash(b))
  })
  it('differs on a one-char change', () => {
    const a = beat('HOOK', [{ type: 'line', text: 'Olha isso' }])
    const c = beat('HOOK', [{ type: 'line', text: 'Olha issa' }])
    expect(beatContentHash(a)).not.toBe(beatContentHash(c))
  })
  it('is stable across ** markers and whitespace (hashes the normalized text)', () => {
    const a = beat('HOOK', [{ type: 'line', text: '**Olha**  isso' }])
    const c = beat('HOOK', [{ type: 'line', text: 'Olha isso' }])
    expect(beatContentHash(a)).toBe(beatContentHash(c))
  })
})
