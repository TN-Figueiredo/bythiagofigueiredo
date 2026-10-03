// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle, runMockupSuite, createTestObservatory } from './oracle'
import { PENDING_SECTIONS, PORTED_SECTIONS, NOT_PORTED, NOT_PORTED_TESTS, BROWSER_ONLY_TESTS } from './suite-pending'

const oracle = loadOracle()
const onOracle = runMockupSuite(oracle)
const onProd = runMockupSuite(createTestObservatory(datasetFromOracle(loadOracle())))

describe('mockup suite (dados-teste.html) — oracle sanity', () => {
  it('the oracle passes everything except the browser-only tests', () => {
    const fails = onOracle.filter(r => !r.ok).map(r => r.name)
    expect(fails.sort()).toEqual([...BROWSER_ONLY_TESTS].sort())
  })
  it('every not-ported test exists in the suite and says why', () => {
    const names = new Set(onOracle.map(r => r.name))
    expect([...NOT_PORTED_TESTS.keys()].filter(n => !names.has(n))).toEqual([])
    expect([...NOT_PORTED_TESTS.values()].every(r => r.length > 20)).toBe(true)
  })
})
describe('touch net', () => {
  const mini = (body: string) => `<script id="tests">(function (root) { const O = root.OBS, R = [];
    const test = (name, fn) => { let ok = false, detail = ''; try { ok = fn() === true; } catch (e) { detail = String(e); } R.push({ name, ok, detail });
    };
    /* ---------- nada depois de NOW ---------- */
    ${body}
    root.__OBS_TEST = { results: R };
  })(globalThis);</script>`
  const html = mini(`test('truthy', () => !!O.missing && typeof O.missing.fn === 'function')
    test('iter', () => { const bad = O.missing.list.filter(x => x); return bad.length === 0 })`)
  it('fails a ported test that reaches a missing member only via truthiness or empty iteration', () => {
    const r = runMockupSuite({ NOW: 1 }, html)
    expect(r.map(x => [x.ok, x.detail])).toEqual([[false, 'touched missing facade member'], [false, 'touched missing facade member']])
  })
  it('passes the same tests when the member exists', () => {
    const r = runMockupSuite({ missing: { fn() {}, list: [] } }, html)
    expect(r.map(x => x.ok)).toEqual([true, true])
  })
})
describe('mockup suite (dados-teste.html) — production engine, verbatim', () => {
  const ported = onProd.filter(r => !PENDING_SECTIONS.has(r.section) && !NOT_PORTED.has(r.section) && !NOT_PORTED_TESTS.has(r.name))
  if (ported.length) {
    it.each(ported.map(r => [r.section + ' › ' + r.name, r] as const))('%s', (_n, r) => {
      expect(r.ok, r.detail).toBe(true)
    })
  }
  it('nothing left pending', () => expect([...PENDING_SECTIONS]).toEqual([]))
  it('every section is either ported, pending or explicitly not ported', () => {
    const known = new Set([...PENDING_SECTIONS, ...NOT_PORTED.keys(), ...PORTED_SECTIONS])
    expect([...new Set(onProd.map(r => r.section))].filter(x => !known.has(x))).toEqual([])
  })
  it('PORTED_SECTIONS and PENDING_SECTIONS are disjoint, and every ported section ran', () => {
    expect([...PORTED_SECTIONS].filter(x => PENDING_SECTIONS.has(x))).toEqual([])
    const ran = new Set(onProd.map(r => r.section))
    expect([...PORTED_SECTIONS].filter(x => !ran.has(x))).toEqual([])
  })
})
