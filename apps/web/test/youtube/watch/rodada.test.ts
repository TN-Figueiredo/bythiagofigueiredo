// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  RODADA, DEMANDA_RODADAS_DIA, periodoMin, proximaRodada, faixaMenosCheia, kAgora, estenderColeta,
} from '@/lib/youtube/watch/rodada'

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const MIN = 60_000
const DIA0 = Date.UTC(2026, 9, 1)

function simular(horaBase: number, porDia: 1 | 4, dias: number, rng: () => number): number[] {
  const ts: number[] = []
  let agora = DIA0
  const fim = DIA0 + dias * 86_400_000
  while (agora < fim) {
    agora = proximaRodada(agora, horaBase, porDia, rng)
    ts.push(agora)
  }
  return ts
}

describe('proximaRodada', () => {
  it('4/dia: distancia minima >= 160 min, maxima <= periodo + 40 min e sorteio em +-20 min', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 145; i++) {
      const hb = Math.floor(rng() * 1440)
      const ts = simular(hb, 4, 30, rng)
      for (let k = 1; k < ts.length; k++) {
        const d = (ts[k]! - ts[k - 1]!) / MIN
        expect(d).toBeGreaterThanOrEqual(160)
        expect(d).toBeLessThanOrEqual(360 + 40)
      }
      const base = hb % 360
      for (const t of ts) {
        const rel = ((t - DIA0) / MIN - base) % 360
        const desvio = Math.min(rel, 360 - rel)
        expect(desvio).toBeLessThanOrEqual(20.0001)
      }
    }
  })
  it('1/dia: distancia entre 1 dia - 40 min e 1 dia + 40 min', () => {
    const rng = mulberry32(11)
    for (let hb = 0; hb < 1440; hb += 37) {
      const ts = simular(hb, 1, 20, rng)
      for (let k = 1; k < ts.length; k++) {
        const d = (ts[k]! - ts[k - 1]!) / MIN
        expect(d).toBeGreaterThanOrEqual(1440 - 40)
        expect(d).toBeLessThanOrEqual(1440 + 40)
      }
    }
  })
  it('distancia maxima para horaBase 0..1439 (4/dia)', () => {
    const rng = mulberry32(3)
    for (let hb = 0; hb < 1440; hb += 13) {
      const ts = simular(hb, 4, 5, rng)
      for (let k = 1; k < ts.length; k++) {
        expect((ts[k]! - ts[k - 1]!) / MIN).toBeLessThanOrEqual(360 + 40)
      }
    }
  })
  it('periodoMin', () => {
    expect(periodoMin(4)).toBe(360)
    expect(periodoMin(1)).toBe(1440)
  })
})

describe('faixaMenosCheia', () => {
  for (const n of [145, 177]) {
    it(`carga por disparo <= 1,5x a media com ${n} ids`, () => {
      const horas: number[] = []
      for (let i = 0; i < n; i++) horas.push(faixaMenosCheia(horas, `id-${i}`))
      const cont = new Array<number>(18).fill(0)
      for (const h of horas) {
        expect(h).toBeGreaterThanOrEqual(0)
        expect(h).toBeLessThan(360)
        cont[Math.floor(h / 20)]!++
      }
      expect(Math.max(...cont)).toBeLessThanOrEqual(1.5 * (n / 18))
    })
  }
  it('usa hora_base mod 360 e empate pela menor faixa', () => {
    expect(Math.floor(faixaMenosCheia([], 'x') / 20)).toBe(0)
    const cheias = Array.from({ length: 17 }, (_, i) => i * 20 + 360)
    expect(Math.floor(faixaMenosCheia(cheias, 'x') / 20)).toBe(17)
  })
})

describe('kAgora', () => {
  it('tabela', () => {
    const r = [5, 20, 45, 50, 55, 60, 65, 70].map((s) => kAgora(s * 1000, 99))
    expect(r).toEqual([16, 16, 16, 14, 10, 5, 1, 0])
  })
  it('0,9 s por video', () => {
    expect(kAgora(52_000, 99, 0.9)).toBe(16)
    expect(kAgora(56_000, 99, 0.9)).toBe(12)
  })
  it('capacidade', () => {
    expect(72 * kAgora(RODADA.inicioLeveP90S * 1000, 99)).toBeGreaterThanOrEqual(1.5 * DEMANDA_RODADAS_DIA)
  })
  it('16 devidos com a leve comecando em 45 s', () => {
    expect(kAgora(45_000, 16)).toBe(16)
  })
  it('limitado pelos devidos', () => {
    expect(kAgora(5000, 3)).toBe(3)
  })
})

describe('estenderColeta', () => {
  const agora = Date.UTC(2026, 9, 18)
  const h = (n: number) => new Date(agora + n * 3_600_000).toISOString()
  const d = (n: number) => new Date(agora + n * 86_400_000).toISOString()
  it('null sem sinal', () => {
    expect(estenderColeta({ coletaAte: h(24), extensoesCurtas: 0 }, { provavel: false, rodadasMistasTitulo: 0, ultimaVista: d(-1) }, agora)).toBeNull()
  })
  it('provavel: +30 d da ultima vista e reterAte +180 d, nunca diminui', () => {
    const uv = d(-1)
    const r = estenderColeta({ coletaAte: h(24), extensoesCurtas: 0 }, { provavel: true, rodadasMistasTitulo: 0, ultimaVista: uv }, agora)!
    expect(r.motivoAte).toBe('extensao')
    expect(r.coletaAte).toBe(new Date(Date.parse(uv) + 30 * 86_400_000).toISOString())
    expect(r.reterAte).toBe(new Date(Date.parse(uv) + 180 * 86_400_000).toISOString())
    const longa = d(100)
    const r2 = estenderColeta({ coletaAte: longa, extensoesCurtas: 0 }, { provavel: true, rodadasMistasTitulo: 0, ultimaVista: uv }, agora)!
    expect(r2.coletaAte).toBe(longa)
  })
  it('curta: +3 d, no maximo 2 vezes, so a < 48 h do corte', () => {
    const v = { provavel: false, rodadasMistasTitulo: 1, ultimaVista: null }
    const r1 = estenderColeta({ coletaAte: h(24), extensoesCurtas: 0 }, v, agora)!
    expect(r1.motivoAte).toBe('extensao_curta')
    expect(r1.extensoesCurtas).toBe(1)
    expect(Date.parse(r1.coletaAte)).toBe(Date.parse(h(24)) + 3 * 86_400_000)
    expect(r1.reterAte).toBeNull()
    const r2 = estenderColeta({ coletaAte: r1.coletaAte, extensoesCurtas: 1 }, v, Date.parse(r1.coletaAte) - 3_600_000)!
    expect(r2.extensoesCurtas).toBe(2)
    expect(estenderColeta({ coletaAte: r2.coletaAte, extensoesCurtas: 2 }, v, Date.parse(r2.coletaAte) - 3_600_000)).toBeNull()
    expect(estenderColeta({ coletaAte: h(72), extensoesCurtas: 0 }, v, agora)).toBeNull()
  })
})
