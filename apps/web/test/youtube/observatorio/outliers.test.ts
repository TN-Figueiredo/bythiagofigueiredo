// @vitest-environment node
// apps/web/test/youtube/observatorio/outliers.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
const P = createObservatory(datasetFromOracle(loadOracle()))

describe('outliers', () => {
  it('tab counts Todos 14/18/11 · Viagem 8/8/5 · IA 6/10/6 (CONVENCOES)', () => {
    expect(P.tabCounts('todos')).toEqual({ canais: 14, mud: 18, out: 11 })
    expect(P.tabCounts('viagem')).toEqual({ canais: 8, mud: 8, out: 5 })
    expect(P.tabCounts('ia')).toEqual({ canais: 6, mud: 10, out: 6 })
  })
  it('TAB_COUNTS derives from tabCounts', () => {
    expect(P.TAB_COUNTS.todos).toEqual(P.tabCounts('todos'))
    expect(P.TAB_COUNTS.viagem).toEqual(P.tabCounts('viagem'))
    expect(P.TAB_COUNTS.ia).toEqual(P.tabCounts('ia'))
  })
  it('outlier = ≥ 2×; weak base (n < 3) never counts', () => {
    const r = P.outliers({ ages: 'all', includeWeak: true })
    for (const it of r.items) expect(it.mult.value!).toBeGreaterThanOrEqual(2)
    expect(r.count).toBe(r.items.filter(i => !i.weak).length)
  })
  it('a lagging/erroring channel never shows "estourando agora"', () => {
    const lag = P.channels.filter(c => c.sync.state === 'atrasado' || c.sync.state === 'erro').map(c => c.id)
    for (const it of P.outliers({ ages: 'all' }).items) if (lag.includes(it.video.ch)) expect(it.phase.id).toBe('sem-ritmo')
  })
  it('edge of a band says the age at the reading ("este tinha 30 dias")', () => {
    const edge = P.videos.find(v => v.mult?.readNote)
    if (edge) expect(edge.mult!.label).toMatch(/este tinha \d+ dias?; n = \d+\)/)
  })
  it('a video is never in its own base', () => {
    for (const v of P.videos) if (v.mult && v.mult.n > 0) expect(v.mult.n).toBeLessThan(P.videos.filter(u => u.ch === v.ch && u.fmt === v.fmt).length)
  })
  it('any reading is invalid until the reading scope is ported', () => {
    const r = P.outliers({ reading: 'x' })
    expect(r.readingInvalid).toBe(true)
    expect(r.scope).toBeNull()
  })
})
