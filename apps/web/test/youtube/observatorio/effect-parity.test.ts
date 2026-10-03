// @vitest-environment node
// apps/web/test/youtube/observatorio/effect-parity.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
const O = loadOracle(), P = createObservatory(datasetFromOracle(loadOracle()))
describe('effect parity with dados.js', () => {
  it.each(O.changes.map((c: { id: string }) => [c.id]))('%s', id => {
    expect(JSON.parse(JSON.stringify(P.effect(id)))).toEqual(JSON.parse(JSON.stringify(O.effect(id))))
  })
  it.each(O.changes.slice(0, 20).map((c: { id: string }) => [c.id]))('effectAt(%s, 14) matches', id => {
    expect(JSON.parse(JSON.stringify(P.effectAt(id, 14)))).toEqual(JSON.parse(JSON.stringify(O.effectAt(id, 14))))
  })
})
