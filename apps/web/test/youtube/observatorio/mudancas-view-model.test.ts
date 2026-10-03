// @vitest-environment node
// apps/web/test/youtube/observatorio/mudancas-view-model.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle, createTestObservatory } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildMudancasView } from '@/app/cms/(authed)/youtube/competitors/_mudancas/view-model'
import { groupsOf } from '@/app/cms/(authed)/youtube/competitors/_chrome/forja-view-model'
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

describe('Mudanças view model — fix round 1', () => {
  it('measured + search: the filter named is the search, never "ainda não têm efeito medido"', () => {
    const e = buildMudancasView(obs, { measured: '1', q: 'zzzz' }, new Set()).empty!
    expect(e.text).not.toMatch(/ainda não t[eê]m? efeito medido/)
    expect(e.hiddenBy).toContain('a busca “zzzz”')
    expect(e.text).toMatch(/a busca “zzzz” esconde/)
  })
  it('measured alone, when nothing in the window is measured, still explains the waiting verdicts', () => {
    const e = buildMudancasView(obs, { niche: 'ia', type: 'desc', fmt: 'long', win: '7', measured: '1' }, new Set()).empty!
    expect(e.text).toMatch(/ainda não tem efeito medido: 1 aguardando/)
    expect(e.hiddenBy).toBe('“só com efeito medido”')
  })
  it('the 2-fields inconclusive group reads RULES.effect.simultHours', () => {
    const txt = JSON.stringify(v.ledger.out)
    expect(txt).toContain('por 2 campos em < ' + obs.RULES.effect.simultHours)
  })
  it('a null swipe key disables the swipe (never saved)', () => {
    const id = v.heroes[0]!.id
    const h = buildMudancasView(obs, {}, new Set([id]), new Map([[id, null]])).heroes[0]!
    expect(h.swipe).toEqual({ saved: false, label: 'Esta troca antiga não pode ir para o swipe file por aqui', key: null })
  })
  it('?changes= ids older than the 90-day pool say so honestly', () => {
    // the fixture has no change older than 90 days: push one video's title history 100 days back
    const ds = datasetFromOracle(loadOracle()), D = 864e5
    const keep = v.heroes.find(h => h.type === 'title')!, moved = v.heroes.find(h => h.type === 'title' && h.video.id !== keep.video.id)!
    const vd = ds.videos.find(x => x.id === moved.video.id)!
    for (const t of vd.titles) { t.first_seen -= 100 * D; t.last_seen -= 100 * D; if (t.window) t.window = [t.window[0] - 100 * D, t.window[1] - 100 * D] }
    const o2 = createObservatory(ds)
    const oldId = o2.changes.find(c => c.video === vd.id && c.type === 'title' && c.at <= o2.NOW - 90 * D)!.id
    const e = buildMudancasView(o2, { changes: oldId }, new Set()).empty!
    expect(e.title).toBe('1 troca citada fora da janela de 90 dias')
    expect(e.title).not.toMatch(/Nenhuma das 0/)
    const mixed = buildMudancasView(o2, { changes: [oldId, keep.id].join(',') }, new Set())
    expect(mixed.heroes.map(h => h.id)).toEqual([keep.id])
    expect(JSON.stringify(mixed.paging.countLines[0])).toContain('1 troca citada ficou fora da janela de 90 dias.')
  })
})

// Task 35b (fidelity sweep): texts the mockup prints that the screen had dropped (mudancas.html renderDigest, titleHTML)
describe('Mudanças view model — fidelity with mudancas.html', () => {
  const flat = (r: typeof v.summary.digest) => r.map(x => (typeof x === 'string' ? x : 'num' in x ? x.num : x.b)).join('')
  it('the collapsed digest lists with commas and ends with the forja per niche (no request)', () => {
    expect(flat(v.summary.digest)).toBe('Últimos 7 dias: 4 trocas de título, 1 de thumbnail, 1 de descrição. Efeito (30 d): thumbnail 4 trocas, de −20 a +31 pp (pouco para concluir). Forja. IA, resumo de 20/10; Viagem, resumo de 20/10.')
  })
  it('one niche: only that niche in the forja part', () => {
    expect(flat(buildMudancasView(obs, { niche: 'viagem', win: '90', type: 'thumb', fmt: 'short' }, new Set()).summary.digest))
      .toBe('Últimos 7 dias: 1 troca de título. Efeito (90 d): nada com veredito. Forja. Viagem, resumo de 20/10.')
  })
  it('an active request adds its state to the niche, and Todos adds the engine statusText', () => {
    const o = createTestObservatory(datasetFromOracle(loadOracle()))
    o.forja.session.setBase('na fila', { type: 'resumo-trocas' })
    const d = flat(buildMudancasView(o, {}, new Set()).summary.digest)
    const sc = o.forja.session.current('todos', { type: 'resumo-trocas' })
    expect(d).toContain('Forja. IA, resumo de 20/10, na fila · pedido 14:58')
    expect(d.endsWith('. ' + sc.statusText)).toBe(true)
  })
  it('a title change cited by the latest resumo-trocas reading carries its rewrite class; others do not', () => {
    const t = v.heroes.filter(h => h.type === 'title')
    const tagged = t.filter(h => h.title!.rewrite)
    // the two on the first page of the mockup (8 cards); the rest of the 18 follow the same rule
    expect(tagged.slice(0, 2).map(h => h.title!.rewrite!.text)).toEqual(['Reescrita (forja): tirou a 2ª notícia', 'Reescrita (forja): reação no lugar do nome do produto'])
    const cited = new Set((['ia', 'viagem'] as const).flatMap(n => groupsOf(obs.forja.latest('resumo-trocas', n)!).flatMap(g => g.changeIds)))
    for (const h of t) expect(!!h.title!.rewrite).toBe(cited.has(h.id) && !!obs.change(h.id)!.rewriteGroup)
    for (const h of tagged) expect(h.title!.rewrite!.title).toBe('Como a forja classificou esta troca na leitura de 20/10')
    expect(t.length).toBeGreaterThan(tagged.length)
  })
})
