// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { evidenciaPorRodada, juntarEvidencia, medidaPropagacao } from '@/lib/youtube/teste-youtube/registro/evidencia'
import { rodadasDeTitulo } from '@/lib/youtube/teste-youtube/rodadas'
import { detectarTesteYoutube } from '@/lib/youtube/teste-youtube/detectar'
import { EVIDENCIA_TETO } from '@/lib/youtube/teste-youtube/registro/constantes'
import type { EvidenciaRodada } from '@/lib/youtube/teste-youtube/registro/tipos'
import type { EscritaConhecida } from '@/lib/youtube/teste-youtube/tipos'
import { carregarQIg9 } from '../../../fixtures/teste-youtube/qIg9a7vqcNo/carregar'
import { rodadas } from '../sintetico'

const H = 3_600_000
const MIN = 60_000
const t0 = Date.parse('2026-10-10T10:00:00.000Z')
const iso = (ms: number): string => new Date(ms).toISOString()
const textos = { A: 'Titulo A', B: 'Titulo B', C: 'Outro texto' }
const esc = (ms: number): EscritaConhecida => ({ em: iso(ms), campo: 'titulo' })

describe('evidenciaPorRodada', () => {
  const { leituras } = carregarQIg9()
  const v = detectarTesteYoutube(leituras)
  if (v.estado !== 'provavel_teste') throw new Error('fixture')
  const variantes = v.variantes.titulo
  const rs = rodadasDeTitulo(leituras)

  it('C-1 (parte pura): qIg9 dá 20 entradas, 13 mistas, votos pelos índices da variante', () => {
    const e = evidenciaPorRodada(rs, variantes, [], 0)
    expect(e).toHaveLength(20)
    expect(e.filter(x => x.mista)).toHaveLength(13)
    const soma: Record<string, number> = {}
    for (const x of e) for (const [k, n] of Object.entries(x.votos)) soma[k] = (soma[k] ?? 0) + n
    expect(soma).toEqual({ '0': 29, '1': 31 })
    expect(e.every(x => x.ms_desde_escrita === null)).toBe(true)
  })

  it('desdeMs corta as rodadas anteriores', () => {
    const meio = Date.parse(rs[10]!.de)
    expect(evidenciaPorRodada(rs, variantes, [], meio)).toHaveLength(10)
  })
})

describe('evidencia: votos e escrita', () => {
  it('texto fora das variantes vira "x"; ms_desde_escrita só até 6 h', () => {
    const ls = rodadas({ inicio: iso(t0 + 2 * H), intervaloMs: 8 * H, padroes: ['ABC', 'AB'], textos })
    const rs = rodadasDeTitulo(ls)
    const e = evidenciaPorRodada(rs, ['Titulo A', 'Titulo B'], [esc(t0)], 0)
    expect(e[0]!.votos).toEqual({ '0': 1, '1': 1, x: 1 })
    expect(e[0]!.ms_desde_escrita).toBe(2 * H)
    expect(e[1]!.ms_desde_escrita).toBeNull() // 10 h depois da escrita
  })
  it('escrita depois da rodada não conta', () => {
    const ls = rodadas({ inicio: iso(t0), intervaloMs: 8 * H, padroes: ['AB'], textos })
    const e = evidenciaPorRodada(rodadasDeTitulo(ls), ['Titulo A', 'Titulo B'], [esc(t0 + H)], 0)
    expect(e[0]!.ms_desde_escrita).toBeNull()
  })
})

describe('juntarEvidencia', () => {
  const mk = (i: number, votos: Record<string, number> = { '0': 1 }): EvidenciaRodada => ({
    rodada: `r${String(i).padStart(5, '0')}`, de: iso(t0 + i * H), ate: iso(t0 + i * H + 1000), votos, mista: false, ms_desde_escrita: null,
  })
  it('C-2 (parte pura): idempotente; a nova vence na mesma rodada', () => {
    const e = [mk(1), mk(2)]
    expect(juntarEvidencia(e, e)).toEqual({ evidencia: e, cortada: false })
    const r = juntarEvidencia([mk(1)], [mk(1, { '1': 5 })])
    expect(r.evidencia).toEqual([mk(1, { '1': 5 })])
  })
  it('teto: 1.005 entradas viram as 1.000 mais recentes e cortada true', () => {
    const r = juntarEvidencia(Array.from({ length: 1005 }, (_, i) => mk(i)), [])
    expect(r.evidencia).toHaveLength(EVIDENCIA_TETO)
    expect(r.cortada).toBe(true)
    expect(r.evidencia[0]!.rodada).toBe('r00005')
    expect(r.evidencia.at(-1)!.rodada).toBe('r01004')
  })
  it('ordena por de', () => {
    const r = juntarEvidencia([mk(3)], [mk(1), mk(2)])
    expect(r.evidencia.map(x => x.rodada)).toEqual(['r00001', 'r00002', 'r00003'])
  })
})

describe('medidaPropagacao', () => {
  const Q = 60 * MIN
  const um = (inicioMs: number) => rodadasDeTitulo(rodadas({ inicio: iso(inicioMs), intervaloMs: 8 * H, padroes: ['AB'], textos }))
  it('a 30 min da escrita: dentro da quarentena', () => {
    expect(medidaPropagacao(um(t0 + 30 * MIN), [esc(t0)], Q)).toEqual({ mistas48ForaQuarentena: 0, minDesdeEscrita: [30] })
  })
  it('a 70 min da escrita: vazou', () => {
    expect(medidaPropagacao(um(t0 + 70 * MIN), [esc(t0)], Q)).toEqual({ mistas48ForaQuarentena: 1, minDesdeEscrita: [70] })
  })
  it('sem escrita de título: null e 0', () => {
    expect(medidaPropagacao(um(t0 + 70 * MIN), [], Q)).toEqual({ mistas48ForaQuarentena: 0, minDesdeEscrita: null })
  })
  it('escrita a mais de 6 h não entra na lista', () => {
    expect(medidaPropagacao(um(t0 + 7 * H), [esc(t0)], Q)).toEqual({ mistas48ForaQuarentena: 0, minDesdeEscrita: [] })
  })
  it('rodada sem mistura não entra; lista sai ordenada', () => {
    const ls = [
      ...rodadas({ inicio: iso(t0 + 4 * H), intervaloMs: 8 * H, padroes: ['AB'], textos }),
      ...rodadas({ inicio: iso(t0 + 70 * MIN), intervaloMs: 8 * H, padroes: ['AB'], textos }).map(l => ({ ...l, rodadaId: 'z' + l.rodadaId })),
      ...rodadas({ inicio: iso(t0 + 2 * H), intervaloMs: 8 * H, padroes: ['AA'], textos }).map(l => ({ ...l, rodadaId: 'y' + l.rodadaId })),
    ]
    const r = medidaPropagacao(rodadasDeTitulo(ls), [esc(t0)], Q)
    expect(r.minDesdeEscrita).toEqual([70, 240])
    expect(r.mistas48ForaQuarentena).toBe(2)
  })
})
