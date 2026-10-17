// A5 E5a, Tarefa 14b: pontosDoVideo (as dez idades de M2 de um vídeo; sem o pedido P5).
import { describe, expect, it } from 'vitest'
import { pontosDoVideo } from '@/lib/youtube/observatorio/medidas-telas/pontos-por-idade'
import { curvaDoCanal } from '@/lib/youtube/observatorio/medidas/curva'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import type { Leitura, MarcaLida } from '@/lib/youtube/observatorio/medidas/m1'

const D = 864e5, H = 36e5
const base = Date.UTC(2026, 6, 1)
const agoraMs = base + 100 * D
const leituras = (): Leitura[] => Array.from({ length: 101 }, (_, k) => ({ t: base + k * D, views: 100 * k + 50, likes: null, comments: null }))
const marca = (idade: number, views: number): MarcaLida => ({ views, likes: null, comments: null, likesHidden: null, readBeforeAt: base + idade * D - H, readAfterAt: base + idade * D + H, ageBaseAt: base })
const marcas = { marcas: { 1: marca(1, 150), 7: marca(7, 750), 30: marca(30, 3050) }, faltas: {} }

describe('E5a T14b: pontos por idade', () => {
  it('são as dez idades de M2, na ordem', () => {
    expect(pontosDoVideo({ baseMs: base }, leituras(), marcas, agoraMs).map((p) => p.idadeDias)).toEqual([...MEASURE_RULES.curve.ages])
  })
  it('1, 7 e 30 saem das marcas; as outras da série', () => {
    const p = pontosDoVideo({ baseMs: base }, leituras(), marcas, agoraMs)
    const v = (i: number) => { const x = p.find((q) => q.idadeDias === i)!.ponto; return x.estado === 'medido' ? x.valor : null }
    expect([v(1), v(7), v(30)]).toEqual([150, 750, 3050])
    expect(v(14)).toBe(1450)
    expect(v(90)).toBe(9050)
  })
  it('é a mesma conta de curvaDoCanal (mesmo valor com 3 vídeos iguais)', () => {
    const um = { formato: 'long' as const, publicadoEm: base, baseMs: base, wasLive: false, agendadoOuNoAr: false, marcas: marcas.marcas, faltas: {}, leituras: leituras() }
    const curva = curvaDoCanal([um, um, um], { formato: 'long', agoraMs })
    const meus = pontosDoVideo({ baseMs: base }, leituras(), marcas, agoraMs)
    if (curva.estado !== 'medido') throw new Error('curva não medida')
    for (const c of curva.valor) {
      const m = meus.find((q) => q.idadeDias === c.idadeDias)!.ponto
      expect(m.estado === 'medido' ? m.valor : null).toBe(c.ponto.estado === 'medido' ? c.ponto.valor : null)
    }
  })
  it('sem série: as idades fora das marcas dizem serie_nao_pedida, nunca zero', () => {
    const p = pontosDoVideo({ baseMs: base }, undefined, marcas, agoraMs).find((q) => q.idadeDias === 14)!.ponto
    expect(p).toMatchObject({ estado: 'nao_medido', motivo: 'serie_nao_pedida' })
  })
  it('idade que ainda não chegou: fecha_em com a data', () => {
    const p = pontosDoVideo({ baseMs: base }, leituras(), marcas, base + 20 * D).find((q) => q.idadeDias === 60)!.ponto
    expect(p).toMatchObject({ estado: 'nao_medido', motivo: 'fecha_em', fechaEm: '2026-08-29' })
  })
  it('sem leitura perto da idade: o motivo vem da falta, não de um zero', () => {
    const so = leituras().filter((l) => l.t < base + 10 * D)
    const p = pontosDoVideo({ baseMs: base }, so, marcas, agoraMs).find((q) => q.idadeDias === 21)!.ponto
    expect(p).toMatchObject({ estado: 'nao_medido', motivo: 'leitura_parou_antes' })
  })
  it('sem data de publicação: sem_publicacao', () => {
    expect(pontosDoVideo({ baseMs: null }, leituras(), marcas, agoraMs)[0]!.ponto).toMatchObject({ motivo: 'sem_publicacao' })
  })
})
