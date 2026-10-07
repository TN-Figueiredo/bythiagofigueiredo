// @vitest-environment node
// apps/web/test/youtube/observatorio/effect-parity.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
const O = loadOracle(), P = createObservatory(datasetFromOracle(loadOracle()))
const plain = (x: unknown) => JSON.parse(JSON.stringify(x)) as Record<string, unknown>
const without = (x: Record<string, unknown>, keys: string[]) => Object.fromEntries(Object.entries(x).filter(([k]) => !keys.includes(k)))

/**
 * Where production deliberately leaves the mockup engine (the oracle is frozen). Each entry names the ruling, the fields
 * that differ and the value production must give. Every other field of these changes still has to match the oracle.
 */
type Deviation = { drop: string[]; expect: Record<string, unknown> }
export const DEVIATIONS: Record<string, Deviation & { ruling: string; at14?: Deviation }> = {
  'matt-opus55/title/1': { ruling: 'R115: matt-opus55/thumb/1 changes the same video 2 days later',
    drop: ['status', 'label', 'reason', 'neutralWhy', 'inconclusiveKind'], expect: { status: 'inconclusivo', label: 'inconclusivo', inconclusiveKind: 'troca-seguinte' },
    // at snapshot 14 the reading is still waiting (6 of 7 days) and already knows about the neighbour of 13/10: it warns early
    at14: { drop: ['waitText', 'willBeInconclusive', 'willBeInconclusiveShort'], expect: { status: 'aguardando', willBeInconclusiveShort: 'o vídeo foi trocado de novo dentro dos 7 dias depois' } } },
  'matt-opus55/thumb/3': { ruling: 'R116: matt-opus55/desc/1 changed the same video 3 days earlier, so the days before are 3, not 7',
    drop: ['beforeDays', 'daily'], expect: { beforeDays: 3, status: 'aguardando' } },
}

describe('effect parity with dados.js', () => {
  it.each(O.changes.map((c: { id: string }) => [c.id]))('%s', id => {
    const p = plain(P.effect(id)), o = plain(O.effect(id)), d = DEVIATIONS[id]
    if (!d) return expect(p).toEqual(o)
    expect(without(p, d.drop)).toEqual(without(o, d.drop))
    expect(p).toMatchObject(d.expect)
    expect(p).not.toEqual(o)
  })
  it.each(O.changes.slice(0, 20).map((c: { id: string }) => [c.id]))('effectAt(%s, 14) matches', id => {
    const p = plain(P.effectAt(id, 14)), o = plain(O.effectAt(id, 14)), dev = DEVIATIONS[id], d = dev?.at14 ?? dev
    if (!d || JSON.stringify(p) === JSON.stringify(o)) return expect(p).toEqual(o)
    expect(without(p, d.drop)).toEqual(without(o, d.drop))
    expect(p).toMatchObject(d.expect)
  })
  it('every deviation names a change that exists and a ruling', () => {
    const ids = new Set(O.changes.map((c: { id: string }) => c.id))
    for (const [id, d] of Object.entries(DEVIATIONS)) { expect(ids.has(id)).toBe(true); expect(d.ruling).toMatch(/^R\d+: .{20,}/) }
  })
})
