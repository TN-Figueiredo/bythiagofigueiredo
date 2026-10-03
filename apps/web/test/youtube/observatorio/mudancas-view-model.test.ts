// @vitest-environment node
// apps/web/test/youtube/observatorio/mudancas-view-model.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
const obs = createObservatory(datasetFromOracle(loadOracle()))
const v = buildMudancasView(obs, {}, new Set())
describe('Mudanças view model', () => {
  it('default window 30 d, all types and formats → 18 heroes (matches the tab)', () => expect(v.heroes.length).toBe(18))
  it('ledger closes the account', () => expect(v.ledger.totalCheck).toBe(true))
  it('median only with n ≥ 5; otherwise "pouco para concluir"', () => {
    for (const m of v.ledger.medians) if (m.n < 5) { expect(m.median).toBeNull(); expect(m.text).toMatch(/pouco para concluir/) }
  })
  it('pp are integers with U+2212', () => { for (const h of v.heroes) if (h.effect.pp) expect(h.effect.pp).toMatch(/^[+−]?\d+ pp$/) })
  it('aguardando shows waitText, never numbers', () => {
    for (const h of v.heroes.filter(h => h.effect.status === 'aguardando')) { expect(h.effect.wait).toMatch(/^Aguardando:/); expect(h.effect.numbers).toBeNull() }
  })
  it('?reading= never changes the list', () => {
    expect(buildMudancasView(obs, { reading: 'resumo-trocas-ia-20-10' }, new Set()).heroes.map(h => h.id)).toEqual(v.heroes.map(h => h.id))
  })
  it('empty with a local filter names the filter', () => {
    const e = buildMudancasView(obs, { q: 'zzzz' }, new Set()).empty!
    expect(e.hiddenBy).toBeTruthy(); expect(e.text).not.toMatch(/não mexeram/)
  })
})

describe('Mudanças view model — extra rules', () => {
  it('every hero carries "Não prova causa" and an inconclusive verdict demotes the number', () => {
    for (const h of v.heroes) {
      expect(h.effect.notCause).toBe('Não prova causa')
      expect(h.effect.demoted).toBe(h.effect.status === 'inconclusivo')
    }
  })
  it('ledger groups are disjoint and add up to the pool', () => {
    const g = v.ledger.groups, inc = Object.values(g.inconclusiveByType).reduce((s, n) => s + n, 0)
    const measured = v.ledger.medians.reduce((s, m) => s + m.n, 0)
    expect(g.reverts + g.withCaveat + inc + g.noVerdict + measured).toBe(v.ledger.total)
    expect(v.ledger.total).toBe(18)
  })
  it('n = 0 uses the engine noBaseText verbatim; aguardando uses waitText verbatim', () => {
    for (const h of v.heroes) {
      const e = obs.effect(h.id)!
      if (e.status === 'aguardando') expect(h.effect.wait).toBe(e.waitText)
      if (e.noBaseText) expect(h.effect.noBase).toBe(e.noBaseText)
      else expect(h.effect.noBase).toBeNull()
    }
  })
  it('title heroes give a screen-reader label to every changed segment', () => {
    const t = v.heroes.filter(h => h.type === 'title')
    expect(t.length).toBeGreaterThan(0)
    for (const h of t) for (const s of [...h.title!.before, ...h.title!.after]) if (s.op !== 'keep') expect(['saiu', 'entrou', 'mudou de lugar', 'só maiúsculas/minúsculas']).toContain(s.label)
  })
  it('thumbnails without an archived image say so honestly; before the series start with the canonical text', () => {
    const th = v.heroes.filter(h => h.type === 'thumb')
    expect(th.length).toBeGreaterThan(0)
    for (const h of th) for (const t of h.thumbs!) {
      if (t.src) expect(t.archived).toBe(true)
      else { expect(t.archived).toBe(false); expect(t.missing).toMatch(/imagem/) }
    }
    const pre = th.flatMap(h => h.thumbs!).filter(t => t.preSeries && !t.src)
    expect(pre.length).toBeGreaterThan(0)
    for (const t of pre) expect(t.missing).toBe('trocas antes de ' + obs.SERIES_START_LABEL + ' não têm a imagem antiga')
  })
  it('a thumbnail with a blob shows it', () => {
    const ds = datasetFromOracle(loadOracle())
    for (const vd of ds.videos) for (const t of vd.thumbs) t.blobUrl = 'https://blob.example/' + t.id + '.jpg'
    const v2 = buildMudancasView(createObservatory(ds), {}, new Set())
    const th = v2.heroes.filter(h => h.type === 'thumb').flatMap(h => h.thumbs!)
    expect(th.length).toBeGreaterThan(0)
    for (const t of th) { expect(t.src).toMatch(/^https:\/\/blob\.example\//); expect(t.archived).toBe(true) }
  })
  it('?changes= shows exactly that list (window ignored)', () => {
    const ids = v.heroes.slice(0, 3).map(h => h.id)
    const v3 = buildMudancasView(obs, { changes: ids.join(','), win: '7' }, new Set())
    expect(new Set(v3.heroes.map(h => h.id))).toEqual(new Set(ids))
    expect(v3.filters.changes).toEqual(ids)
  })
  it('swipe file state comes from the saved set', () => {
    const id = v.heroes[0]!.id
    const v4 = buildMudancasView(obs, {}, new Set([id]))
    expect(v4.heroes[0]!.swipe).toMatchObject({ saved: true, label: 'Salvo no swipe file' })
    expect(v.heroes[0]!.swipe).toMatchObject({ saved: false, label: 'Salvar no swipe file' })
    expect(buildMudancasView(obs, { saved: '1' }, new Set([id])).heroes.map(h => h.id)).toEqual([id])
  })
  it('the description diff hides UTM noise behind a toggle', () => {
    const d = v.heroes.filter(h => h.type === 'desc' && h.desc && !h.desc.noText)
    for (const h of d) expect(h.desc!.noiseHidden).toBe(h.desc!.lines.filter(l => l.op === 'utm').length)
  })
  it('without any change in any window it says "não mexeram"', () => {
    const ds = datasetFromOracle(loadOracle())
    // only the first version of every field survives: no change at all, in any window
    for (const vd of ds.videos) { vd.titles = vd.titles.slice(0, 1); vd.thumbs = vd.thumbs.slice(0, 1); vd.descs = vd.descs.slice(0, 1) }
    const e = buildMudancasView(createObservatory(ds), { win: '7' }, new Set()).empty!
    expect(e.hiddenBy).toBeNull()
    expect(e.text).toMatch(/não mexeram/)
    expect(v.empty).toBeNull()
  })
  it('a local filter on an empty window names the window, never "não mexeram"', () => {
    const e = buildMudancasView(obs, { niche: 'viagem', type: 'thumb', fmt: 'short', win: '90' }, new Set()).empty!
    expect(e.hiddenBy).toBe('tipo thumbnail')
    expect(e.text).not.toMatch(/não mexeram/)
    expect(e.actions.map(a => a.label)).toContain('Limpar filtros')
  })
  it('filters parse with defaults and reject junk', () => {
    expect(v.filters).toMatchObject({ win: 30, type: 'all', fmt: 'all', q: '', channel: 'all', changes: null, reading: null })
    expect(buildMudancasView(obs, { win: '13', type: 'x', fmt: 'y' }, new Set()).filters).toMatchObject({ win: 30, type: 'all', fmt: 'all' })
  })
})
