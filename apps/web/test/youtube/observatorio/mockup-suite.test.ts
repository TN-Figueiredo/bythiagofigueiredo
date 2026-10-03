// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle, runMockupSuite } from './oracle'
import { PENDING_SECTIONS, NOT_PORTED, NOT_PORTED_TESTS } from './suite-pending'
import { createObservatory } from '@/lib/youtube/observatorio'

const oracle = loadOracle()
const onOracle = runMockupSuite(oracle)
const onProd = runMockupSuite(createObservatory(datasetFromOracle(loadOracle())))

describe('mockup suite (dados-teste.html) — oracle sanity', () => {
  it('the oracle passes everything except the browser-only tests', () => {
    const fails = onOracle.filter(r => !r.ok).map(r => r.name)
    expect(fails.sort()).toEqual([...NOT_PORTED_TESTS].sort())
  })
})
describe('mockup suite (dados-teste.html) — production engine, verbatim', () => {
  const ported = onProd.filter(r => !PENDING_SECTIONS.has(r.section) && !NOT_PORTED.has(r.section) && !NOT_PORTED_TESTS.has(r.name))
  if (ported.length) {
    it.each(ported.map(r => [r.section + ' › ' + r.name, r] as const))('%s', (_n, r) => {
      expect(r.ok, r.detail).toBe(true)
    })
  }
  it('every section is either ported, pending or explicitly not ported', () => {
    const known = new Set([...PENDING_SECTIONS, ...NOT_PORTED.keys(), ...new Set(onProd.map(r => r.section))])
    expect(onProd.every(r => known.has(r.section))).toBe(true)
  })
})
