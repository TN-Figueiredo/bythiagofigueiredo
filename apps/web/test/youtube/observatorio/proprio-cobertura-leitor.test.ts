// @vitest-environment node
// A5 · E6 · Tarefa 5: a cobertura devolve os zeros que a dieta apagou do diário (função pura, sem banco).
import { describe, it, expect } from 'vitest'
import { materializarZeros } from '@/lib/youtube/observatorio/proprio/cobertura-leitor'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { DiarioLinha } from '@/lib/youtube/observatorio/proprio/tipos'

const BASE = '2026-09-01'
const d = (n: number) => addDays(BASE, n)
const linha = (ytId: string, dia: string, views: number | null, pct: number | null = null, dur: number | null = null): DiarioLinha =>
  ({ ytId, dia, views, pctAssistido: pct, duracaoMediaSeg: dur })
const zero = (ytId: string, dia: string): DiarioLinha => linha(ytId, dia, 0)
const JANELA = { desde: d(0), ate: d(9) }

describe('materializarZeros', () => {
  it('dia coberto sem linha vira views: 0 com os dois nulos (item 44)', () => {
    const r = materializarZeros([linha('v1', d(0), 5)], [{ ytId: 'v1', de: d(0), ate: d(2) }], JANELA)
    expect(r).toEqual([linha('v1', d(0), 5), zero('v1', d(1)), zero('v1', d(2))])
    expect(r[1]).toStrictEqual({ ytId: 'v1', dia: d(1), views: 0, pctAssistido: null, duracaoMediaSeg: null })
  })
  it('dia fora da cobertura não vira linha (item 44)', () => {
    const r = materializarZeros([linha('v1', d(0), 5)], [{ ytId: 'v1', de: d(0), ate: d(1) }], JANELA)
    expect(r.map(l => l.dia)).toEqual([d(0), d(1)])
    expect(r.some(l => l.dia === d(2))).toBe(false)
  })
  it('linha existente com views nulo não é trocada por zero', () => {
    const r = materializarZeros([linha('v1', d(1), null)], [{ ytId: 'v1', de: d(0), ate: d(2) }], JANELA)
    expect(r.find(l => l.dia === d(1))).toEqual(linha('v1', d(1), null))
    expect(r.filter(l => l.dia === d(1))).toHaveLength(1)
  })
  it('linha existente com médias medidas não é trocada', () => {
    const r = materializarZeros([linha('v1', d(1), 9, 51.5, 212.25)], [{ ytId: 'v1', de: d(0), ate: d(2) }], JANELA)
    expect(r.find(l => l.dia === d(1))).toEqual(linha('v1', d(1), 9, 51.5, 212.25))
  })
  it('intervalo maior que a janela é cortado nas duas pontas', () => {
    const r = materializarZeros([], [{ ytId: 'v1', de: d(-5), ate: d(30) }], { desde: d(2), ate: d(4) })
    expect(r.map(l => l.dia)).toEqual([d(2), d(3), d(4)])
  })
  it('dois intervalos do mesmo vídeo com buraco: o dia do buraco não aparece', () => {
    const r = materializarZeros([], [{ ytId: 'v1', de: d(0), ate: d(2) }, { ytId: 'v1', de: d(4), ate: d(5) }], JANELA)
    expect(r.map(l => l.dia)).toEqual([d(0), d(1), d(2), d(4), d(5)])
  })
  it('intervalos que se tocam ou se sobrepõem não duplicam o dia', () => {
    const r = materializarZeros([], [{ ytId: 'v1', de: d(0), ate: d(3) }, { ytId: 'v1', de: d(2), ate: d(5) }], JANELA)
    expect(r.map(l => l.dia)).toEqual([d(0), d(1), d(2), d(3), d(4), d(5)])
  })
  it('sem intervalos devolve as mesmas linhas, na mesma ordem', () => {
    const entrada = [linha('v2', d(0), 1), linha('v1', d(1), 0), linha('v1', d(3), null)]
    const r = materializarZeros(entrada, [], JANELA)
    expect(r).toEqual(entrada)
    expect(r).not.toBe(entrada)
  })
  it('ordem: dia, depois vídeo', () => {
    const r = materializarZeros([linha('vb', d(1), 3)], [{ ytId: 'vb', de: d(0), ate: d(2) }, { ytId: 'va', de: d(0), ate: d(2) }], JANELA)
    expect(r.map(l => `${l.dia}/${l.ytId}`)).toEqual([
      `${d(0)}/va`, `${d(0)}/vb`, `${d(1)}/va`, `${d(1)}/vb`, `${d(2)}/va`, `${d(2)}/vb`,
    ])
  })
  it('a linha de outro vídeo no mesmo dia não conta como "já existe"', () => {
    const r = materializarZeros([linha('v2', d(1), 4)], [{ ytId: 'v1', de: d(1), ate: d(1) }], JANELA)
    expect(r).toEqual([zero('v1', d(1)), linha('v2', d(1), 4)])
  })
  it('intervalo todo fora da janela não gera nada', () => {
    expect(materializarZeros([], [{ ytId: 'v1', de: d(20), ate: d(25) }], JANELA)).toEqual([])
    expect(materializarZeros([], [{ ytId: 'v1', de: d(-9), ate: d(-1) }], JANELA)).toEqual([])
  })
  it('teto de sanidade: mais de 50 vídeos x 60 dias lança', () => {
    const intervalos = Array.from({ length: 51 }, (_, k) => ({ ytId: 'v' + k, de: d(0), ate: d(59) }))
    expect(() => materializarZeros([], intervalos, { desde: d(0), ate: d(59) })).toThrow()
  })
  it('no teto exato (50 x 60) não lança', () => {
    const intervalos = Array.from({ length: 50 }, (_, k) => ({ ytId: 'v' + k, de: d(0), ate: d(59) }))
    expect(materializarZeros([], intervalos, { desde: d(0), ate: d(59) })).toHaveLength(3000)
  })
  it('intervalo invertido (de depois de ate) não gera nada', () => {
    expect(materializarZeros([], [{ ytId: 'v1', de: d(5), ate: d(2) }], JANELA)).toEqual([])
  })
})
