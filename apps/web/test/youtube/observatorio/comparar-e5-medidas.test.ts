// A5 E5a T7: as medidas novas no par (estado do lado, direção, primeiros dias, acerto, reação). Puro, sem rede.
import { describe, expect, it } from 'vitest'
import { buildMedidasDoPar } from '@/app/cms/(authed)/youtube/competitors/_comparar/medidas-do-par'
import type { MedidasDoCanalPack, MedidasPlanas } from '@/app/cms/(authed)/youtube/competitors/_comparar/medidas-do-lado'
import { canalDe, pacoteDe } from './par-helpers'

const J = { de: '2026-07-01', ate: '2026-09-30', dias: 90 }
const med = <T,>(valor: T, n = 10, notas: never[] = []) => ({ estado: 'medido' as const, valor, n, janela: J, notas })
const nao = (motivo: string, extra: Record<string, unknown> = {}) => ({ estado: 'nao_medido' as const, motivo, notas: [], ...extra })

function planas(o: Partial<MedidasPlanas> = {}): MedidasPlanas {
  return {
    m3a: med({ variacao: 0.3, direcao: 'subindo', ganhoRecente: 130_000, ganhoAnterior: 100_000 }),
    m3b: med({ variacao: 0.2, direcao: 'subindo', medianaRecente: 12_000, medianaAnterior: 10_000 }),
    m3c: med({ variacao: -0.2, direcao: 'descendo', medianaRecente: 8_000, medianaAnterior: 10_000 }),
    m1: { 1: med(1000), 7: med(5000), 30: med(9000) },
    m4: med({ acertos: 3, fracassos: 2, total: 12, pctAcerto: 0.25, pctFracasso: 0.17 }),
    m7: med(0.04),
    m8: { estado: med('ativo'), parado: nao('poucos_videos'), queda: nao('poucos_videos') },
    ...o,
  } as unknown as MedidasPlanas
}
const pack = (m: MedidasPlanas | null, extra: Partial<MedidasDoCanalPack> = {}): MedidasDoCanalPack => ({
  fonte: m ? { tipo: 'medidas', m, extras: null } : { tipo: 'nao_carregou', causa: 'leitura_falhou' },
  videosN: 20, buscando: false, ultimaBoa: null, longos: { recente: 6, anterior: 5, cobertura: { ok: true }, fora: { semFormato: 0, aoVivo: 0, agendados: 0 } }, ...extra,
})
function par(a: MedidasDoCanalPack | undefined, b: MedidasDoCanalPack | undefined, hojeSP = '2026-12-01') {
  const ca = { ...canalDe('a', { name: 'Ana' }), medidasDoLado: a }
  const cb = { ...canalDe('b', { name: 'Beto' }), medidasDoLado: b }
  return { ...pacoteDe([ca, cb]), hojeSP }
}

describe('buildMedidasDoPar', () => {
  it('pacote sem hojeSP (montado sem medidas): nada novo', () => {
    const p = pacoteDe([canalDe('a'), canalDe('b')])
    expect(buildMedidasDoPar(p, 'a', 'b')).toBeNull()
  })

  it('lado que não carregou: só o nome e a pastilha; o outro lado segue', () => {
    const r = buildMedidasDoPar(par(pack(planas()), pack(null)), 'a', 'b')!
    expect(r.lados[1].naoCarregou).toBe(true)
    expect(r.semCarregar).toEqual([{ lado: 'B', nome: 'Beto' }])
    expect(r.lados[1].m1[7]).toEqual({ tipo: 'nao_carregou' })
    expect(r.primeiros.linhas.every(l => l.relacao === null && l.barras === null)).toBe(true)
  })

  it('primeiros dias: barras na mesma escala e relação dita', () => {
    const b = planas({ m1: { 1: med(500), 7: med(2500), 30: med(9000) } } as Partial<MedidasPlanas>)
    const r = buildMedidasDoPar(par(pack(planas()), pack(b)), 'a', 'b')!
    const l7 = r.primeiros.linhas[1]!
    expect(l7.barras![0]).toBe(1)
    expect(l7.barras![1]).toBeCloseTo(0.5)
    expect(l7.relacao?.tipo).toBe('maior')
    expect(r.primeiros.linhas[2]!.relacao?.tipo).toBe('igual')
  })

  it('acerto: 3 de 12 com porcentagem; 3 de 9 sem porcentagem', () => {
    const b = planas({ m4: med({ acertos: 3, fracassos: 1, total: 9, pctAcerto: 0.33, pctFracasso: 0.11 }) } as Partial<MedidasPlanas>)
    const r = buildMedidasDoPar(par(pack(planas()), pack(b)), 'a', 'b')!
    const [ca, cb] = r.acerto.lados
    expect(ca).toMatchObject({ tipo: 'medido', acertos: 3, total: 12, meio: 7 })
    expect(cb).toMatchObject({ tipo: 'medido', acertos: 3, total: 9, meio: 5 })
  })

  it('reação: idades diferentes não geram relação; iguais geram', () => {
    const hoje = med(0.05, 10, [{ tipo: 'total_de_hoje' }] as never[])
    const r1 = buildMedidasDoPar(par(pack(planas()), pack(planas({ m7: hoje } as Partial<MedidasPlanas>))), 'a', 'b')!
    expect(r1.reacao.diferentes).toBe(true)
    expect(r1.reacao.relacao).toBeNull()
    const r2 = buildMedidasDoPar(par(pack(planas()), pack(planas({ m7: med(0.08) } as Partial<MedidasPlanas>))), 'a', 'b')!
    expect(r2.reacao.diferentes).toBe(false)
    expect(r2.reacao.relacao?.tipo).toBe('maior')
  })

  it('só curtidas num lado: leituras diferentes', () => {
    const sc = med(0.04, 10, [{ tipo: 'so_curtidas' }] as never[])
    const r = buildMedidasDoPar(par(pack(planas()), pack(planas({ m7: sc } as Partial<MedidasPlanas>))), 'a', 'b')!
    expect(r.reacao.diferentes).toBe(true)
  })

  it('nichos diferentes: duas réguas e a frase de contexto', () => {
    const p = par(pack(planas()), pack(planas()))
    p.canais[1] = { ...p.canais[1]!, niche: 'culinaria', nicheLabel: 'Culinária' }
    const r = buildMedidasDoPar(p, 'a', 'b')!
    expect(r.nichosDiferentes).toBe(true)
    expect(r.contexto).toMatch(/Nichos diferentes/)
  })

  it('nenhum lado é canal seu: a linha quieta', () => {
    const r = buildMedidasDoPar(par(pack(planas()), pack(planas())), 'a', 'b')!
    expect(r.semCanalProprio).toBe(true)
  })

  it('lado próprio: medidas viram "canal próprio", nunca zero', () => {
    const p = par(pack(planas()), { ...pack(null), fonte: { tipo: 'canal_proprio' } })
    p.canais[1] = { ...p.canais[1]!, own: true }
    const r = buildMedidasDoPar(p, 'a', 'b')!
    expect(r.lados[1].proprio).toBe(true)
    expect(r.lados[1].a.tipo).toBe('canal_proprio')
    expect(r.semCanalProprio).toBe(false)
  })

  it('(c) antes da data de existir: "ainda não existe"; depois: medida', () => {
    const antes = buildMedidasDoPar(par(pack(planas()), pack(planas()), '2026-10-16'), 'a', 'b')!
    const depois = buildMedidasDoPar(par(pack(planas()), pack(planas()), '2027-12-01'), 'a', 'b')!
    expect(antes.lados[0].c.tipo).toBe('ainda_nao_existe')
    expect(antes.direcao.principal).toBe('a')
    expect(depois.lados[0].c.tipo).toBe('medido')
    expect(depois.direcao.principal).toBe('c')
  })

  it('c medida só num lado: (a) segue principal nos dois', () => {
    const b = planas({ m3c: nao('poucos_videos', { n: 1, minimo: 3 }) } as Partial<MedidasPlanas>)
    const r = buildMedidasDoPar(par(pack(planas()), pack(b), '2027-12-01'), 'a', 'b')!
    expect(r.direcao.principal).toBe('a')
  })

  it('o pacote é dado simples (JSON ida e volta idêntico)', () => {
    const p = par(pack(planas()), pack(planas()))
    expect(JSON.parse(JSON.stringify(p))).toEqual(p)
  })
})
