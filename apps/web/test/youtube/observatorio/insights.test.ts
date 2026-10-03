// @vitest-environment node
// apps/web/test/youtube/observatorio/insights.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { attribution, analyzePatterns } from '@/lib/youtube/observatorio/insights'
import { FORMULA, FORMULAS, formulasOf } from '@/lib/youtube/observatorio/insights'
import { REWRITE_GROUPS } from '@/lib/youtube/observatorio/changes'
import type { EngineCtx } from '@/lib/youtube/observatorio/series'
import type { Dataset } from '@/lib/youtube/observatorio/types'

const fresh = (): Dataset => datasetFromOracle(loadOracle())
const P = createObservatory(fresh())

describe('formulasOf', () => {
  it('KFC title carries preco and nome-do-lugar', () => {
    const f = formulasOf('Trying a $2.70 Pakistan\'s version of KFC')
    expect(f).toContain('preco'); expect(f).toContain('nome-do-lugar')
  })
  it('catalogue ids are unique and the facade exposes it', () => {
    expect(new Set(FORMULAS.map(f => f.id)).size).toBe(FORMULAS.length)
    expect(P.formulas).toBe(FORMULAS); expect(P.formula('preco')).toBe(FORMULA['preco'])
    expect(P.theme('comida-de-rua')?.label).toBe('Comida de rua barata'); expect(P.themes.length).toBe(12)
  })
  it('changes.ts rewrite groups use the catalogue regexes (R12)', () => {
    const g = REWRITE_GROUPS.find(x => x.id === 'primeira-pessoa')!
    expect(g.test({ before: 'The Strangest Hotel', after: 'I Slept in the Strangest Hotel', revertTo: null } as never)).toBe(true)
  })
})

describe('heatmap in São Paulo', () => {
  it('23:30 SP on Friday is sex, block 11 — not Saturday', () => {
    const ds = fresh()
    const v = ds.videos.find(x => x.tracked && x.fmt === 'long' && x.ageDays <= 60 && ds.channels.find(c => c.id === x.ch)!.niche === 'viagem' && !ds.channels.find(c => c.id === x.ch)!.own && x.series.length)!
    v.pub = Date.parse('2026-10-23T23:30:00-03:00'); v.ageDays = 1
    const O = createObservatory(ds), h = O.heatmap('viagem', 'long')
    expect(h.days[4]).toBe('sex')
    expect(h.cells[4]![11]!.ids).toContain(v.id)
    expect(h.cells[5]!.flatMap(c => c.ids)).not.toContain(v.id)
  })
  it('an empty dataset gives n = 0 and does not throw', () => {
    const ds = fresh(); ds.videos = []
    const O = createObservatory(ds), h = O.heatmap('todos', 'long')
    expect(h.n).toBe(0); expect(h.peak).toBeNull(); expect(h.bestMult).toBeNull()
    expect(h.thin.length).toBe(84)
    expect(O.themeTrend('todos', 'long')).toHaveLength(0); expect(O.ownCoverage('long').n).toBe(0)
    expect(() => O.patternsNow('ia', 'long')).not.toThrow(); expect(() => O.nicheStats('todos', 'long')).not.toThrow()
  })
})

describe('attribution', () => {
  const ctx = { CH: new Map([['a', { name: 'Alfa', gender: 'm' }], ['b', { name: 'Beta', gender: 'f' }], ['c', { name: 'Gama', gender: 'n' }], ['d', { name: 'Delta', gender: 'n' }], ['e', { name: 'Eta', gender: 'n' }]]) } as unknown as EngineCtx
  const rep = (id: string, n: number) => Array.from({ length: n }, () => id)
  const noun = { one: 'outlier', many: 'outliers' }
  it('solo above 60%: gendered phrase', () => {
    expect(attribution(ctx, [...rep('a', 12), 'b'], noun)!.text).toBe('Alfa sozinho assina 12 dos 13 outliers')
    expect(attribution(ctx, [...rep('b', 4), 'a'], noun)!.text).toBe('Beta sozinha assina 4 dos 5 outliers')
    expect(attribution(ctx, [...rep('c', 4), 'a'], noun)!.text).toBe('só Gama assina 4 dos 5 outliers')
  })
  it('names the 2nd channel only with >= 20%', () => {
    expect(attribution(ctx, [...rep('a', 4), ...rep('b', 3), ...rep('c', 1)], noun)!.kind).toBe('dois')
    const low = attribution(ctx, [...rep('a', 6), ...rep('b', 2), 'c', 'd', 'e'], noun)!
    expect(low.kind).toBe('varios'); expect(low.text).toBe('espalhado por 5 canais')
  })
  it('a tie between 2nd and 3rd is spread', () => {
    const t = attribution(ctx, [...rep('a', 3), ...rep('b', 2), ...rep('c', 2)], noun)!
    expect(t.kind).toBe('varios'); expect(t.tie).toBe(true)
  })
  it('n = 1 is unico, empty is vazio; textMid/textStart', () => {
    const u = attribution(ctx, ['a'], noun)!
    expect(u.kind).toBe('unico'); expect(u.text).toBe('1 outlier: Alfa'); expect(u.textStart).toBe('1 outlier: Alfa')
    expect(attribution(ctx, [], noun)).toMatchObject({ kind: 'vazio', text: 'nenhum vídeo' })
    const s = attribution(ctx, [...rep('a', 12), 'b'], noun)!
    expect(s.textMid).toBe(s.text); expect(s.textStart).toBe('Alfa sozinho assina 12 dos 13 outliers')
  })
  it('accepts video-like objects', () => {
    expect(attribution(ctx, [{ ch: 'a' }], noun)!.text).toBe('1 outlier: Alfa')
  })
})

describe('nicheStats.own', () => {
  it('both zero is bothZero with verdict ≈', () => {
    const x = P.nicheStats('viagem', 'short').own.pctOutliers
    expect(x.bothZero).toBe(true); expect(x.verdict).toBe('≈'); expect(x.verdictText).toBe('igual à mediana do nicho (as duas em 0%)')
  })
})

describe('themes null (production before any temas reading)', () => {
  const ds = fresh(); for (const v of ds.videos) v.theme = null
  const O = createObservatory(ds)
  it('themeTrend is empty but still carries excluded/channelsCompared', () => {
    for (const n of ['todos', 'viagem', 'ia'] as const) for (const f of ['long', 'short'] as const) {
      const t = O.themeTrend(n, f)
      expect(t).toHaveLength(0); expect(Array.isArray(t.excluded)).toBe(true); expect(Array.isArray(t.channelsCompared)).toBe(true)
    }
  })
  it('patternsNow and ownCoverage do not throw', () => {
    for (const n of ['todos', 'viagem', 'ia'] as const) for (const f of ['long', 'short'] as const) {
      const p = O.patternsNow(n, f) as { dominantTheme: { theme: string | null } }
      expect(p.dominantTheme.theme).toBeNull(); expect(() => O.ownCoverage(f)).not.toThrow()
    }
  })
  it('analyzePatterns handles themed outliers without a catalogue entry', () => {
    const ctx = { CH: new Map([['a', { name: 'Alfa', gender: 'm' }]]), fmt: P.fmt } as unknown as EngineCtx
    const v = (i: number) => ({ id: 'v' + i, ch: 'a', theme: 'tema-livre', formulas: [], mult: 3, weak: false, method: null, n: 5 })
    const r = analyzePatterns(ctx, { niche: 'ia', videos: [v(1), v(2), v(3)] }) as { dominantTheme: { theme: string; text: string } }
    expect(r.dominantTheme.theme).toBe('tema-livre')
  })
})
