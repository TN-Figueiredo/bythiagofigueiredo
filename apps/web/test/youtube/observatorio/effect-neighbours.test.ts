// @vitest-environment node
// apps/web/test/youtube/observatorio/effect-neighbours.test.ts
import { describe, it, expect } from 'vitest'
import { loadOracle, datasetFromOracle } from './oracle'
import { createObservatory } from '@/lib/youtube/observatorio'
import type { Dataset, ObsVideo } from '@/lib/youtube/observatorio/types'
import { DAY } from '@/lib/youtube/observatorio/time'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'

const BASE = createObservatory(datasetFromOracle(loadOracle()))
const DECIDED = ['ganhou', 'perdeu', 'neutro']
/** A decided change whose video has no other change at all: the clean subject every case below mutates. */
const subject = BASE.changes.find(c => DECIDED.includes(BASE.effect(c.id)!.status) && BASE.changes.filter(o => o.video === c.video).length === 1)!
const K = BASE.date.snapIdxAtOrAfter(subject.at)

/** Clone of the oracle dataset with one extra version appended to a field of the subject's video, first seen at snapshot k + offset − 12 h. */
function withNeighbour(field: 'titles' | 'descs', kOffset: number): Dataset {
  const ds = datasetFromOracle(loadOracle())
  const v = ds.videos.find(x => x.id === subject.video)! as ObsVideo
  const at = BASE.date.snapTime(K + kOffset) - 12 * 36e5
  const arr = v[field] as Array<{ id: string; first_seen: number; last_seen: number; current: boolean; prec: string; window: [number, number] | null }>
  const last = arr[arr.length - 1]!
  last.last_seen = at; last.current = false
  const extra = field === 'titles' ? { text: 'TÍTULO VIZINHO DE TESTE' } : { lines: ['linha vizinha de teste'], hasText: true }
  arr.push({ ...structuredClone(last), id: v.id + '/' + field + '/vizinha', first_seen: at, last_seen: ds.now, current: true, prec: 'min', window: null, ...extra })
  return ds
}
const otherField = (): 'titles' | 'descs' => (subject.type === 'title' ? 'descs' : 'titles')

describe('R115: outra troca do mesmo vídeo dentro dos 7 dias depois', () => {
  it('o caso-base existe: troca decidida num vídeo sem nenhuma outra troca', () => {
    expect(subject).toBeTruthy()
    expect(BASE.effect(subject.id)!.afterDays).toBe(7)
  })
  it('vizinha em k+2 → inconclusivo troca-seguinte, com o motivo dizendo o campo', () => {
    const e = createObservatory(withNeighbour(otherField(), 2)).effect(subject.id)!
    expect(e.status).toBe('inconclusivo')
    expect(e.inconclusiveKind).toBe('troca-seguinte')
    expect(e.reason).toMatch(/^O vídeo foi trocado de novo dentro dos 7 dias depois \((Título|Descrição) mudou .+\): a leitura mistura duas versões\.$/)
  })
  it('vizinha em k+7 ainda contamina (o dia da troca dela é o último dia do depois)', () => {
    expect(createObservatory(withNeighbour(otherField(), 7)).effect(subject.id)!.inconclusiveKind).toBe('troca-seguinte')
  })
  it('vizinha em k+8 não muda nada: mesmo veredito e mesmos números', () => {
    const e = createObservatory(withNeighbour(otherField(), 8)).effect(subject.id)!, b = BASE.effect(subject.id)!
    expect(e.status).toBe(b.status); expect(e.numbers).toBe(b.numbers); expect(e.inconclusiveKind).toBeUndefined()
  })
  it('sem vizinha: resultado idêntico ao de hoje', () => {
    const e = createObservatory(datasetFromOracle(loadOracle())).effect(subject.id)!
    expect(JSON.parse(JSON.stringify(e))).toEqual(JSON.parse(JSON.stringify(BASE.effect(subject.id))))
  })
  it('vizinha com horário impreciso conta pelo começo da janela', () => {
    const ds = withNeighbour(otherField(), 9)
    const v = ds.videos.find(x => x.id === subject.video)!, arr = v[otherField()] as Array<{ first_seen: number; prec: string; window: [number, number] | null }>
    const n = arr[arr.length - 1]!
    // seen at k+9, but the change happened somewhere in a 2-day window that starts inside the 7 days after
    n.prec = '1d'; n.window = [n.first_seen - 2 * DAY, n.first_seen]
    expect(createObservatory(ds).effect(subject.id)!.inconclusiveKind).toBe('troca-seguinte')
  })
  it('leitura congelada: uma vizinha depois do corte Lcap não muda o resultado daquele corte', () => {
    const cap = K + 1
    const withN = createObservatory(withNeighbour(otherField(), 2)).effectAt(subject.id, cap)!
    const without = BASE.effectAt(subject.id, cap)!
    expect(withN.status).toBe(without.status); expect(withN.waitText).toBe(without.waitText)
  })
  it('leitura congelada: vizinha imprecisa VISTA depois do corte não vaza, mesmo com a janela começando antes dele', () => {
    const ds = withNeighbour(otherField(), 5) // first seen between K+4 and K+5
    const v = ds.videos.find(x => x.id === subject.video)!, arr = v[otherField()] as Array<{ first_seen: number; prec: string; window: [number, number] | null }>
    const n = arr[arr.length - 1]!
    n.prec = '1d'; n.window = [n.first_seen - 2 * DAY, n.first_seen] // the window starts between K+2 and K+3, before the cap
    const frozen = createObservatory(ds).effectAt(subject.id, K + 3)!, without = BASE.effectAt(subject.id, K + 3)!
    expect(frozen.waitText).toBe(without.waitText); expect(frozen.willBeInconclusive ?? null).toBe(without.willBeInconclusive ?? null)
    // and the live reading, which has seen it, does count it
    expect(createObservatory(ds).effect(subject.id)!.inconclusiveKind).toBe('troca-seguinte')
  })
  it('aguardando avisa cedo que vai sair inconclusivo', () => {
    const e = createObservatory(withNeighbour(otherField(), 2)).effectAt(subject.id, K + 3)!
    expect(e.status).toBe('aguardando')
    expect(e.willBeInconclusiveShort).toBe('o vídeo foi trocado de novo dentro dos 7 dias depois')
    expect(e.waitText).toMatch(/Vai sair inconclusivo: o vídeo foi trocado de novo dentro dos 7 dias depois\.$/)
  })
  it('nenhuma troca decidida do oráculo tem outra troca do mesmo vídeo dentro dos 7 dias depois', () => {
    for (const c of BASE.changes) {
      if (!DECIDED.includes(BASE.effect(c.id)!.status)) continue
      const k = BASE.date.snapIdxAtOrAfter(c.at)
      const late = BASE.changes.filter(o => o.video === c.video && o !== c && o.at > c.at && BASE.date.snapIdxAtOrAfter(o.window ? o.window[0] : o.at) <= k + 7)
      expect([c.id, late.map(o => o.id)]).toEqual([c.id, []])
    }
  })
})

/** Clone with one extra version INSERTED before the subject's change: first seen at snapshot k − offset − 12 h. */
function withEarlier(field: 'titles' | 'descs', kBack: number): Dataset {
  const ds = datasetFromOracle(loadOracle())
  const v = ds.videos.find(x => x.id === subject.video)! as ObsVideo
  const at = BASE.date.snapTime(K - kBack) - 12 * 36e5
  const arr = v[field] as Array<{ id: string; first_seen: number; last_seen: number; current: boolean; prec: string; window: [number, number] | null }>
  const first = arr[0]!
  const extra = field === 'titles' ? { text: 'TÍTULO ANTERIOR DE TESTE' } : { lines: ['linha anterior de teste'], hasText: true }
  arr.unshift({ ...structuredClone(first), id: v.id + '/' + field + '/anterior', last_seen: at, current: false, ...extra })
  first.first_seen = at; first.prec = 'min'; first.window = null
  return ds
}

describe('R116: o antes começa na troca anterior do mesmo vídeo', () => {
  it('troca anterior 4 dias antes → mede com 4 dias de antes (e os pares também)', () => {
    const e = createObservatory(withEarlier(otherField(), 5)).effect(subject.id)!
    expect(e.beforeDays).toBe(4)
    expect(e.daily!.before.length).toBe(4)
    expect(e.beforeCutBy).toBe('troca-anterior')
    expect(['ganhou', 'perdeu', 'neutro', 'inconclusivo']).toContain(e.status)
    // with fewer before-days fewer peers qualify: the only inconclusive this case may give is "poucos vídeos" (outro)
    expect([undefined, 'outro']).toContain(e.inconclusiveKind)
  })
  it('troca anterior 2 dias antes → inconclusivo antes-curto, com o motivo dizendo o campo', () => {
    const e = createObservatory(withEarlier(otherField(), 3)).effect(subject.id)!
    expect(e.status).toBe('inconclusivo'); expect(e.inconclusiveKind).toBe('antes-curto')
    expect(e.reason).toMatch(/^Dias entre a troca anterior do vídeo \((Título|Descrição)\) e esta: 2\. Pouco para comparar\.$/)
    // the reading reports the clean days it has and gives no number measured across the previous change
    expect(e.beforeDays).toBe(2); expect(e.daily!.before.length).toBe(2); expect(e.beforeCutBy).toBe('troca-anterior')
    expect(e.numbers).toBeUndefined(); expect(e.observed).toBeUndefined(); expect(e.effectPp).toBeUndefined()
  })
  it('aguardando avisa cedo quando a troca anterior deixa 2 dias ou menos', () => {
    const e = createObservatory(withEarlier(otherField(), 3)).effectAt(subject.id, K + 3)!
    expect(e.status).toBe('aguardando')
    expect(e.willBeInconclusiveShort).toBe('outra troca do vídeo poucos dias antes desta')
    expect(e.willBeInconclusive).toMatch(/^Dias entre a troca anterior do vídeo/)
  })
  it('troca anterior de outro campo a menos de 48 h continua janela-dupla (a simultânea ganha), nunca sem-antes', () => {
    const e = createObservatory(withEarlier(otherField(), 1)).effect(subject.id)!
    expect(e.status).toBe('inconclusivo'); expect(e.inconclusiveKind).toBe('janela-dupla')
  })
  it('troca anterior mais velha que o antes de hoje não muda nada', () => {
    const b = BASE.effect(subject.id)!
    const e = createObservatory(withEarlier(otherField(), b.beforeDays! + 2)).effect(subject.id)!
    expect(e.beforeDays).toBe(b.beforeDays); expect(e.status).toBe(b.status); expect(e.numbers).toBe(b.numbers)
  })
  it('nenhuma troca decidida do oráculo mede um antes que atravessa outra troca do mesmo vídeo', () => {
    for (const c of BASE.changes) {
      const e = BASE.effect(c.id)!
      if (!DECIDED.includes(e.status)) continue
      const k = BASE.date.snapIdxAtOrAfter(c.at)
      const prev = BASE.changes.filter(o => o.video === c.video && o !== c && o.at < c.at).sort((a, b) => b.at - a.at)[0]
      if (prev) expect([c.id, e.beforeDays! <= (k - 1) - BASE.date.snapIdxAtOrAfter(prev.at)]).toEqual([c.id, true])
    }
  })
})

describe('[F5] M-d, the part R115 does not contradict (the mockup test itself is in NOT_PORTED_TESTS)', () => {
  it('every before-bin of every effect is at least 24 h long', () => {
    const es = BASE.changes.map(c => BASE.effect(c.id)!).filter(e => e.daily && e.daily.before.length)
    expect(es.length).toBeGreaterThan(0)
    for (const e of es) for (const d of e.daily!.before) expect(d.to - d.from).toBeGreaterThanOrEqual(24 * 36e5 - 1)
  })
  it('[F8] inconclusiveKind exists only on inconclusivo, and always there', () => {
    for (const c of BASE.changes) { const e = BASE.effect(c.id)!; expect([c.id, e.inconclusiveKind != null]).toEqual([c.id, e.status === 'inconclusivo']) }
  })
  it('the showcase change still measures 3 days before; the fast video still has no before', () => {
    expect(BASE.effect('matt-opus55/title/1')!.beforeDays).toBe(3)
    expect(BASE.effect('matt-fast-cheap/title/1')!.status).toBe('sem-antes')
  })
})

describe('R116 on the Canais drawer: a shorter "antes" names its real cause', () => {
  it('cut by the previous change → "desde a troca anterior do mesmo vídeo" (another change of the channel may still, rightly, cite the series start)', () => {
    const obs = createObservatory(withEarlier(otherField(), 5))
    const e = obs.effect(subject.id)!
    expect(e.beforeDays).toBe(4)
    const drawers = ['trocas', 'videos', 'outliers'].map(tab => JSON.stringify(buildCanaisView(obs, { niche: 'todos', limit: 75, channel: subject.ch, tab } as never).drawer ?? null))
    expect(drawers.some(j => j.includes('Antes: 4 dias (desde a troca anterior do mesmo vídeo).'))).toBe(true)
  })
})
