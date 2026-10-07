// @vitest-environment node
// Dense lanes (plan 2026-10-07-observatorio-historico-muitas-versoes, Task 5): no marker leaves the instant of its change,
// no period is drawn wider than its duration, close ones become ONE target.
import { describe, it, expect } from 'vitest'
import { loadFase4, VID } from './fase4-world'
import { createObservatory } from '@/lib/youtube/observatorio'
import { buildHistoricoView, type LaneView, type MarkerView, type VersionView } from '@/app/cms/(authed)/youtube/competitors/_historico/view-model'
import { layoutLane, fitLetters, fitCount, MINPX, MINPX_COARSE, type LaneItem } from '@/app/cms/(authed)/youtube/competitors/_historico/lane-layout'

const { ds } = loadFase4(), obs = createObservatory(ds)
/** 1 px per hour: a position in px is the hour itself. */
const x1 = (h: number) => h
const ver = (label: string, fromH: number, toH: number, o: Partial<VersionView> = {}): VersionView => ({ label, fromH, toH, inRange: true, edge: { from: 'de' + fromH, to: 'ate' + toH }, ...o } as VersionView)
const mk = (idx: number, h: number, o: Partial<MarkerView> = {}): MarkerView => ({ idx, h, changeId: 'c' + idx, inRange: true, edge: { from: 'em' + h, to: 'em' + h }, ...o } as MarkerView)
const lane = (versions: VersionView[], markers: MarkerView[], type: LaneView['type'] = 'thumb'): LaneView =>
  ({ type, versions, markers, unit: type === 'thumb' ? ['período', 'períodos'] : ['título', 'títulos'], changeWord: type === 'thumb' ? 'thumbnail' : 'título' } as LaneView)
const kinds = (items: LaneItem[]) => items.map(i => (i.kind === 'clip' ? (i.small ? 's' : 'c') : i.kind === 'pgroup' ? 'P' + i.members.length : i.kind === 'mk' ? 'm' : 'M' + i.n)).join(' ')

describe('marcadores', () => {
  it('30 marcadores a 5 px um do outro: UM contador, e nenhum traço sai do horário da troca (deslocamento 0 px)', () => {
    const items = layoutLane(lane([ver('A', 0, 1000)], Array.from({ length: 30 }, (_, i) => mk(i + 1, 100 + i * 5))), x1, MINPX)
    const g = items.find(i => i.kind === 'mgroup')
    expect(kinds(items)).toBe('c M30')
    if (g?.kind !== 'mgroup') throw new Error('sem grupo')
    expect(g.members.map(m => m.px)).toEqual(Array.from({ length: 30 }, (_, i) => 100 + i * 5))
    expect([g.left, g.width, g.name]).toEqual([100, 145, '30 trocas de thumbnail entre em100 e em245'])
  })
  it('marcador sozinho fica exatamente no horário (o spread() antigo empurrava 16 px para cada lado)', () => {
    const items = layoutLane(lane([ver('A', 0, 1000)], [mk(1, 100), mk(2, 132), mk(3, 400)]), x1, MINPX)
    expect(items.filter(i => i.kind === 'mk').map(i => i.kind === 'mk' && i.px)).toEqual([100, 132, 400])
  })
  it('31 px de distância agrupa, 32 px não', () => {
    expect(kinds(layoutLane(lane([ver('A', 0, 1000)], [mk(1, 100), mk(2, 131)]), x1, MINPX))).toBe('c M2')
    expect(kinds(layoutLane(lane([ver('A', 0, 1000)], [mk(1, 100), mk(2, 132)]), x1, MINPX))).toBe('c m m')
  })
  it('contadores que ficariam um em cima do outro se juntam; sem espaço para "N trocas" o rótulo abrevia', () => {
    const near = layoutLane(lane([ver('A', 0, 1000)], [mk(1, 100), mk(2, 110), mk(3, 150), mk(4, 160)]), x1, MINPX)
    expect(kinds(near)).toBe('c M4')
    const two = layoutLane(lane([ver('A', 0, 1000)], [mk(1, 100), mk(2, 110), mk(3, 180), mk(4, 190), mk(5, 600), mk(6, 610)]), x1, MINPX)
    expect(two.filter(i => i.kind === 'mgroup').map(i => i.kind === 'mgroup' && [i.n, i.abbr])).toEqual([[2, true], [2, true], [2, false]])
  })
})

describe('períodos', () => {
  it('período estreito sozinho: largura real, nunca os 32 px de antes; o vizinho não é coberto', () => {
    const items = layoutLane(lane([ver('A', 0, 400), ver('B', 400, 410), ver('C', 410, 900)], []), x1, MINPX)
    expect(kinds(items)).toBe('c s c')
    const [a, b, c] = items as Array<Extract<LaneItem, { kind: 'clip' }>>
    expect([b!.left, b!.width]).toEqual([400.5, 9])
    expect(a!.left + a!.width).toBeLessThanOrEqual(b!.left)
    expect(b!.left + b!.width).toBeLessThanOrEqual(c!.left)
  })
  it('estreitos vizinhos viram um alvo só, na extensão real do grupo, com as letras em ordem', () => {
    const items = layoutLane(lane([ver('A', 0, 400), ver('B', 400, 410), ver('A', 410, 425), ver('C', 425, 440), ver('A', 440, 900)], []), x1, MINPX)
    const g = items[1]!
    if (g.kind !== 'pgroup') throw new Error('sem grupo')
    expect(kinds(items)).toBe('c P3 c')
    expect([g.left, g.width, g.unit, g.seq, g.letters, g.from, g.to]).toEqual([400, 40, '3 períodos', 'B → A → C', 'B A C', 'de400', 'ate440'])
    expect(g.name).toBe('3 períodos de thumbnail, de de400 até ate440: B, A, C')
    expect(g.members.map(m => [m.i, m.left, m.width])).toEqual([[1, 0, 10], [2, 10, 15], [3, 25, 15]])
  })
  it('nenhum item passa do vizinho, nos vídeos do mockup, em três larguras', () => {
    for (const id of [VID.many, VID.dense, VID.open]) for (const [w, minpx] of [[1100, MINPX], [760, MINPX_COARSE], [390, MINPX_COARSE]] as const) {
      const v = buildHistoricoView(obs, id, {}), H = v.chart!.H, x = (h: number) => 92 + (h / H) * (w - 106)
      for (const l of v.lanes) {
        const items = layoutLane(l, x, minpx), per = items.filter(i => i.kind === 'clip' || i.kind === 'pgroup')
        for (let k = 1; k < per.length; k++) expect(per[k - 1]!.left + per[k - 1]!.width, id + l.type + w).toBeLessThanOrEqual(per[k]!.left + 1.5)
        for (const it of items) {
          if (it.kind === 'mk') expect(it.px).toBe(x(it.m.h))
          if (it.kind === 'mgroup') for (const m of it.members) expect(m.px).toBe(x(m.m.h))
          if (it.kind === 'clip' && it.small) expect(it.width).toBeLessThanOrEqual(Math.max(3, x(it.v.toH) - x(it.v.fromH)))
        }
        expect(per.reduce((s, p) => s + (p.kind === 'pgroup' ? p.members.length : 1), 0)).toBe(l.versions.length)
        expect(items.reduce((s, p) => s + (p.kind === 'mk' ? 1 : p.kind === 'mgroup' ? p.n : 0), 0)).toBe(l.markers.length)
      }
    }
  })
  it('estado 2 em 760 px: a faixa de thumbnail vira dois grupos com as letras em ordem', () => {
    const v = buildHistoricoView(obs, VID.many, {}), H = v.chart!.H
    const items = layoutLane(v.lanes[1]!, h => 92 + (h / H) * (620 - 106), MINPX_COARSE).filter(i => i.kind === 'pgroup')
    expect(items.map(i => i.kind === 'pgroup' && [i.letters, i.count])).toEqual([['A B A C A B C D A D B D', '12 períodos'], ['E C E B E D E C E D E', '11 períodos']])
  })
  it('faixa de título: o grupo diz "N títulos" e não tem linha de letras', () => {
    const items = layoutLane(lane([ver('T1', 0, 10), ver('T2', 10, 20), ver('T3', 20, 900)], [], 'title'), x1, MINPX)
    const g = items[0]!
    if (g.kind !== 'pgroup') throw new Error('sem grupo')
    expect([g.unit, g.letters, g.name]).toEqual(['2 títulos', '', '2 títulos, de de0 até ate20: T1, T2'])
  })
})

describe('ordem e filtro', () => {
  it('ordem de tempo; no empate, a troca vem antes do período que ela cria', () => {
    const items = layoutLane(lane([ver('A', 0, 400), ver('B', 400, 900)], [mk(1, 400)]), x1, MINPX)
    expect(kinds(items)).toBe('c m c')
    expect(items.map(i => i.x)).toEqual([0, 400, 400])
  })
  it('o que está fora do período mostrado não entra', () => {
    const items = layoutLane(lane([ver('A', 0, 400, { inRange: false }), ver('B', 400, 900)], [mk(1, 400, { inRange: false })]), x1, MINPX)
    expect(kinds(items)).toBe('c')
  })
  it('o dado não existe: faixa sem versão e sem troca devolve lista vazia', () => {
    expect(layoutLane(lane([], []), x1, MINPX)).toEqual([])
  })
})

describe('o que cabe dentro de um grupo', () => {
  it('letras: todas, ou as primeiras e quantas faltam, ou nada', () => {
    expect(fitLetters(['A', 'B', 'A'], 60)).toBe('A B A')
    expect(fitLetters(['A', 'B', 'A', 'C', 'A', 'B'], 60)).toBe('A B A +3')
    expect(fitLetters(['A', 'B', 'A'], 10)).toBe('')
  })
  it('contagem: o texto inteiro, só o número, ou nada; nunca mais largo que o grupo', () => {
    expect(fitCount('3 períodos', '3', 80)).toBe('3 períodos')
    expect(fitCount('3 períodos', '3', 35)).toBe('3')
    expect(fitCount('3 períodos', '3', 8)).toBe('')
  })
})
