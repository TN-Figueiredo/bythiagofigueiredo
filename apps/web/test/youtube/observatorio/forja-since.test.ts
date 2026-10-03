// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadOracle, datasetFromOracle, createTestObservatory } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import { toReading, type ReadingRow } from '@/lib/youtube/observatorio/load'
import type { Dataset, ForjaRequest, FrozenReading, ReadingBase } from '@/lib/youtube/observatorio/types'

const oracle = loadOracle()
const ds = datasetFromOracle(loadOracle())
const obs = createTestObservatory(datasetFromOracle(loadOracle()))
const J = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const ASK = /Peça nova leitura à forja para atualizar/

describe('since — "Desde então"', () => {
  const s = obs.forja.since('padroes-titulo-ia-20-10')!
  it('text starts "Desde então:" (capitalised, a label, never "Desde então."), shortText is one line "desde então: …" with no final period', () => {
    expect(s.text.startsWith('Desde então:')).toBe(true)
    expect(s.text.split('\n')[0]!.split(':')[0]).toBe('Desde então')
    expect(s.shortText.startsWith('desde então: ')).toBe(true)
    expect(s.shortText).not.toMatch(/\n/)
    expect(s.shortText).not.toMatch(/\.$/)
    expect(s.text).toMatch(ASK)
  })
  it('with an active request the screen shows textNoAsk: the same sentence without "Peça nova leitura…"', () => {
    const S = obs.forja.session
    S.reset(); S.ask('ia')
    const sc = S.current('ia')
    expect(sc.anyActive).toBe(true)
    const shown = sc.anyActive ? s.textNoAsk : s.text
    S.reset()
    expect(shown).not.toMatch(ASK)
    expect(shown.endsWith('.')).toBe(true)
    expect(s.text.startsWith(shown.replace(/\.$/, ''))).toBe(true)
    for (const r of obs.forja.readings) { const x = obs.forja.since(r.id)!; expect(x.textNoAsk).not.toMatch(ASK) }
  })
  it('"nada mudou" only when every count is equal (every reading, published and scenario)', () => {
    const all = [...obs.forja.readings, ...Object.values(obs.forja.scenarioReadings!)]
    for (const r of all) {
      const x = obs.forja.since(r.id)!
      if (/nada mudou/i.test(x.shortText + x.text)) {
        expect(x.nowVideos).toBe(x.sentVideos)
        expect(x.newVideos.length + x.leftWindow.length + (x.titleChanged?.length ?? 0) + (x.staleNow?.length ?? 0) + (x.newChanges?.length ?? 0) + (x.newPoints ?? 0) + (x.flipped ?? 0)).toBe(0)
        if (x.nowOutliers != null) expect(x.nowOutliers).toBe(x.sentOutliers)
      }
    }
  })
  it('a reading made from today\'s base: "Nada mudou desde a leitura." — one title changed afterwards: never "nada mudou"', () => {
    const now = obs.patternsNow('ia', 'long').base
    const base: ReadingBase = { fmt: 'long', t: obs.LAST_IDX, asOf: now.asOf, niche: 'ia', windowDays: 182, channels: now.channels, excluded: now.excluded, videos: now.videos.map(v => ({ ...v })) }
    const mk = (id: string, b: ReadingBase): FrozenReading => ({ id, type: 'padroes-titulo', niche: 'ia', seal: '', generatedAt: ds.now, sent: { text: '', asOf: now.asOf, asOfIdx: obs.LAST_IDX }, analysis: {}, text: { lead: '', items: [] }, base: b })
    const changed: ReadingBase = { ...base, videos: base.videos.map((v, i) => i === 0 ? { ...v, title: v.title + ' (antes)' } : v) }
    const o = createObservatory({ ...datasetFromOracle(loadOracle()), readings: [mk('igual', base), mk('mudou', changed)] })
    const same = o.forja.since('igual')!, diff = o.forja.since('mudou')!
    expect(same.text).toBe('Nada mudou desde a leitura.')
    expect(same.shortText).toBe('desde então: nada mudou')
    expect(same.textNoAsk).toBe('Nada mudou desde a leitura.')
    expect(diff.titleChanged).toEqual([base.videos[0]!.id])
    expect(diff.shortText).toBe('desde então: 1 título trocado')
    expect(diff.text).toBe('Desde então: 1 com título trocado. Peça nova leitura à forja para atualizar.')
  })
  it('an unknown reading → null', () => expect(obs.forja.since('nao-existe')).toBeNull())
})

describe('parity with the oracle — every published reading', () => {
  const ids = obs.forja.readings.map(r => r.id)
  it('the readings are the oracle\'s', () => expect(ids).toEqual(oracle.forja.readings.map((r: FrozenReading) => r.id)))
  it.each(ids)('since(%s)', id => expect(J(obs.forja.since(id))).toEqual(J(oracle.forja.since(id))))
  const filters = [undefined, { formula: 'reacao-hiperbole' }, { min: 0 }, { channel: 'matt-wolfe' }, { theme: 'comida-de-rua' }, { channel: 'matt-wolfe', formula: 'reacao-hiperbole' }]
  it.each(ids)('readingScope(%s, …)', id => { for (const f of filters) expect(J(obs.forja.readingScope(id, f))).toEqual(J(oracle.forja.readingScope(id, f))) })
  it.each(ids)('outliers({reading: %s}) — count, scope and items', id => {
    for (const q of [{ reading: id }, { reading: id, min: 0, includeWeak: true }, { reading: id, formula: 'preco' }]) {
      const p = obs.outliers(q), o = oracle.outliers(q)
      expect([p.count, p.countWithWeak, p.readingInvalid, p.items.map(x => x.id)]).toEqual(J([o.count, o.countWithWeak, o.readingInvalid, o.items.map((x: { id: string }) => x.id)]))
      expect(J(p.scope)).toEqual(J(o.scope))
    }
  })
  const types = ['padroes-titulo', 'padroes-titulo-shorts', 'temas', 'resumo-trocas', 'leitura-video']
  it.each(types)('preview(%s, ia|viagem|todos)', t => { for (const n of ['ia', 'viagem', 'todos'] as const) expect(J(obs.forja.preview(t, n))).toEqual(J(oracle.forja.preview(t, n))) })
  it.each(types)('timing(%s, ia|viagem|todos|none, {count: 0})', t => {
    for (const n of ['ia', 'viagem', 'todos', undefined] as const) expect(J(obs.forja.timing(t, n))).toEqual(J(oracle.forja.timing(t, n)))
    expect(J(obs.forja.timing(t, 'ia', { count: 0 }))).toEqual(J(oracle.forja.timing(t, 'ia', { count: 0 })))
  })
  it('readingTypes (labels verbatim, timingText, timingByNiche), readingTypeFor, shortsNote', () => {
    expect(J(obs.forja.readingTypes)).toEqual(J(oracle.forja.readingTypes))
    expect([obs.forja.readingTypeFor('short'), obs.forja.readingTypeFor('long')]).toEqual([oracle.forja.readingTypeFor('short'), oracle.forja.readingTypeFor('long')])
    expect(obs.forja.shortsNote).toBe(oracle.forja.shortsNote)
  })
  it('latest and eligibleChannels', () => {
    for (const t of types) for (const n of ['ia', 'viagem'] as const) expect(obs.forja.latest(t, n)?.id ?? null).toBe(oracle.forja.latest(t, n)?.id ?? null)
    for (const n of ['ia', 'viagem', 'todos'] as const) expect(J(obs.forja.eligibleChannels(n))).toEqual(J(oracle.forja.eligibleChannels(n)))
  })
})

describe('eligible channels, timing, readings by id', () => {
  it('a channel with no sync for more than 24 h is out, with the reason', () => {
    const out = obs.forja.eligibleChannels('ia').out
    expect(out).toContainEqual({ id: 'esq-unltd-daily', reason: 'Esq Unltd Daily fica fora: sem sincronização há 3 dias' })
    expect(obs.forja.eligibleChannels('ia').in).not.toContain('esq-unltd-daily')
  })
  it('a channel never synced successfully (sync.last null, Task 20b) is out with that reason, never "há NaN h"', () => {
    const d = datasetFromOracle(loadOracle())
    d.channels = d.channels.map(c => c.id === 'matt-wolfe' ? { ...c, sync: { ...c.sync, state: 'atrasado' as const, last: null } } : c)
    const e = createObservatory(d).forja.eligibleChannels('ia')
    expect(e.out).toContainEqual({ id: 'matt-wolfe', reason: 'Matt Wolfe fica fora: nunca sincronizado com sucesso' })
    expect(e.in).not.toContain('matt-wolfe')
  })
  it('timing: median only from 5 published readings', () => {
    expect(obs.forja.timing('padroes-titulo', 'ia').text).toBe('tempo deste tipo ainda não medido (2 leituras; mediana a partir de 5)')
    const req = (i: number): ForjaRequest => ({ id: 'r' + i, type: 'temas', niche: 'ia', target: { kind: 'niche', niche: 'ia' }, state: 'publicado', createdAt: ds.now - (i + 1) * 864e5, claimedAt: null, startedAt: null,
      publishedAt: ds.now - (i + 1) * 864e5 + (10 + i) * 6e4, failedAt: null, attempt: 1, refusedReason: null, readingId: null })
    const d: Dataset = { ...datasetFromOracle(loadOracle()), requests: [0, 1, 2, 3, 4].map(req) }
    const t = createObservatory(d).forja.timing('temas', 'ia')
    expect(t).toMatchObject({ n: 5, medianMinutes: 12, text: 'mediana das últimas 5: 12 min' })
  })
  it('the scenario readings of the request-scenario day exist from load (no requestScenario call first)', () => {
    const fresh = createTestObservatory(datasetFromOracle(loadOracle()))
    const sc = Object.values(fresh.forja.byId).filter(r => r.scenario)
    expect(sc.length).toBeGreaterThanOrEqual(9)
    expect(new Set(sc.map(r => fresh.date.dm(r.generatedAt)))).toEqual(new Set([fresh.date.dm(ds.now)]))
  })
  it('production (no test scenarios): byId holds only the published readings and there is no scenarioReadings', () => {
    const prod = createObservatory(datasetFromOracle(loadOracle()))
    expect(Object.keys(prod.forja.byId).sort()).toEqual(ds.readings.map(r => r.id).sort())
    expect(prod.forja.scenarioReadings).toBeUndefined()
    expect(prod.outliers({ reading: 'nao-existe' }).readingInvalid).toBe(true)
    expect(prod.outliers({ reading: 'resumo-trocas-ia-20-10' }).readingInvalid).toBe(true)
  })
  it('no hardcoded series start ("03/10") in the forja engine', () => {
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/lib/youtube/observatorio/forja')
    for (const f of fs.readdirSync(dir)) expect(fs.readFileSync(path.join(dir, f), 'utf8'), f).not.toMatch(/03\/10/)
  })
})

describe('since — a frozen reading that cites data the observatory no longer has (Task 35a fix round 1)', () => {
  it('a cited change was deleted: no throw, the gone change is named and the rest still compares', () => {
    const d = datasetFromOracle(loadOracle())
    const v = d.videos.find(x => x.id === 'matt-opus55')!
    v.titles = v.titles.slice(0, 2)   // 'matt-opus55/title/2' no longer exists
    const o = createObservatory(d)
    expect(o.change('matt-opus55/title/2')).toBeUndefined()
    const s = o.forja.since('resumo-trocas-ia-20-10')!
    expect(s.gone).toEqual({ changes: ['matt-opus55/title/2'], videos: [] })
    expect(s.text).toMatch(/1 troca citada não está mais no observatório/)
    expect(s.shortText).toMatch(/1 troca citada fora$/)
    expect(s.textNoAsk).not.toMatch(ASK)
  })
  it('a cited video was deleted: no throw, the gone video is named', () => {
    const d = datasetFromOracle(loadOracle())
    const P = d.readings.find(r => r.id === 'padroes-titulo-viagem-20-10')!
    const gone = P.base!.videos[0]!.id
    d.videos = d.videos.filter(x => x.id !== gone)
    const s = createObservatory(d).forja.since(P.id)!
    expect(s.gone!.videos).toEqual([gone])
    expect(s.text).toMatch(/1 vídeo da leitura não está mais no observatório/)
  })
  it('the video of a video reading is gone: honest sentence, no comparison', () => {
    const d = datasetFromOracle(loadOracle())
    d.videos = d.videos.filter(x => x.id !== 'matt-opus55')
    const s = createObservatory(d).forja.since('leitura-video-matt-opus55-20-10')!
    expect(s.text).toBe('Não dá para comparar esta leitura com os dados de hoje: o vídeo não está mais no observatório.')
    expect(s.gone!.videos).toEqual(['matt-opus55'])
  })
  it('a reading stored without its frozen base: said, never a crash', () => {
    const d = datasetFromOracle(loadOracle())
    const P = d.readings.find(r => r.id === 'padroes-titulo-ia-20-10')!
    delete P.base
    expect(createObservatory(d).forja.since(P.id)!.text).toBe('Não dá para comparar esta leitura com os dados de hoje: os dados enviados à forja não ficaram registrados com ela.')
  })
})

// Task 35b: a reading published in PRODUCTION carries only `sent` (the frozen SentPack, copied from the task). The
// data since() compares with must travel inside it, or every "Desde então" says "sem os dados enviados à forja".
describe('since over a reading the production way (sent = buildSent, mapped back by the loader)', () => {
  const cases: Array<[string, { niche?: 'ia' | 'viagem'; videoId?: string; fmt?: 'long' | 'short' }]> = [
    ['padroes-titulo', { niche: 'ia' }], ['padroes-titulo-shorts', { niche: 'viagem', fmt: 'short' }], ['temas', { niche: 'viagem' }],
    ['resumo-trocas', { niche: 'ia' }], ['leitura-video', { videoId: 'matt-opus55' }],
  ]
  it.each(cases)('%s: frozen now → "nada mudou", never "sem os dados enviados"', (type, target) => {
    const sent = J(obs.forja.buildSent(type, target))
    expect(sent).not.toHaveProperty('asOfIdx')
    const r = toReading({ id: 'prod-' + type, task_type: type, niche: target.niche ?? 'ia', video_id: target.videoId ?? null, fmt: target.fmt ?? null, model: 'Gemma 12B',
      generated_at: new Date(ds.now).toISOString(), sent, analysis: {}, text: { lead: 'x', items: [] }, evidence: [] } as ReadingRow)!
    const o = createObservatory({ ...datasetFromOracle(loadOracle()), readings: [r] })
    const s = o.forja.since(r.id)!
    expect(s.shortText).not.toMatch(/sem os dados enviados/)
    expect(s.shortText).toBe('desde então: nada mudou')
  })
  it('an older row without the frozen data still says so honestly', () => {
    const r = toReading({ id: 'velha', task_type: 'padroes-titulo', niche: 'ia', video_id: null, fmt: null, model: 'Gemma 12B', generated_at: new Date(ds.now).toISOString(),
      sent: { text: 'x', asOf: ds.now }, analysis: {}, text: { lead: 'x', items: [] }, evidence: [] } as ReadingRow)!
    const o = createObservatory({ ...datasetFromOracle(loadOracle()), readings: [r] })
    expect(o.forja.since('velha')!.shortText).toBe('desde então: sem os dados enviados à forja para comparar')
  })
})
