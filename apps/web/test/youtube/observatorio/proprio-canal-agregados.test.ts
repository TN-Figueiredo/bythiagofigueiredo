// @vitest-environment node
// A4 Tarefa 13.3: as contas puras que a tela do canal divide entre o cabeçalho, "Como o canal está" e a aba de % assistido: a taxa do canal
// (com intervalo), o % assistido do canal (média pesada pelas views, 28 dias), a soma de views por dia dos vídeos e as views dos 28 dias de um
// vídeo. Regra de ouro: não medido nunca vira zero; % acima de 100 é dado válido e não é recortado.
import { describe, it, expect } from 'vitest'
import {
  assistidoDoCanal, cobertura28DoVideo, taxaDoCanal, viewsDoCanalPorDia, views28DoVideo, MIN_DIAS_ASSISTIDO, POUCAS_VIEWS_MEDIA,
} from '@/app/cms/(authed)/youtube/competitors/_proprio/canal-agregados'
import type { DiarioCanal, DiarioLinha, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import type { ResumoAlcance } from '@/lib/youtube/observatorio/proprio/dias'

const ULT = '2026-10-10'
const dia = (n: number): string => { const d = new Date(Date.UTC(2026, 9, 10 - n)); return d.toISOString().slice(0, 10) }
const L = (ytId: string, atras: number, views: number | null, pct: number | null): DiarioLinha => ({ ytId, dia: dia(atras), views, pctAssistido: pct, duracaoMediaSeg: null })
const ok = (linhas: DiarioLinha[], ultimoDia: string | null = ULT): Privado<DiarioCanal> => ({ acesso: 'ok', dado: { canalId: 'c', ultimoDia, linhas, descartados: 0 } })

describe('taxaDoCanal', () => {
  const r = (imp: number | null, cliques: number | null): ResumoAlcance => ({ imp, cliques, diasComImpressao: 1, diasLidos: 1, diasNaoMedidos: 0 })
  it('cliques ÷ impressões, com o intervalo de 95%', () => {
    const t = taxaDoCanal(r(61023, 3036))!
    expect(t.taxa).toBeCloseTo(0.04975, 4)
    expect(t.lo).toBeCloseTo(0.048, 3)
    expect(t.hi).toBeCloseTo(0.0515, 3)
  })
  it('sem impressão, zero impressão ou cliques não medidos: nula (nunca 0%)', () => {
    expect(taxaDoCanal(r(null, null))).toBeNull()
    expect(taxaDoCanal(r(0, 0))).toBeNull()
    expect(taxaDoCanal(r(500, null))).toBeNull()
  })
})

describe('assistidoDoCanal', () => {
  it('média do % de cada dia pesada pelas views, nos vídeos pedidos; conta views, dias e vídeos', () => {
    const a = assistidoDoCanal(ok([L('A', 3, 10, 50), L('A', 2, 30, 60), L('B', 3, 20, 40)]), ['A', 'B'])
    expect(a.pct).toBeCloseTo((500 + 1800 + 800) / 60, 6)
    expect(a).toMatchObject({ n: 60, dias: 2, videos: 2, motivo: null })
    expect(a.janela).toEqual({ de: dia(27), ate: ULT })
  })
  it('ignora dia sem view, view nula, % nulo, fora da janela e vídeo que não foi pedido', () => {
    const a = assistidoDoCanal(ok([L('A', 1, 10, 50), L('A', 2, 0, 90), L('A', 3, null, 90), L('A', 4, 5, null), L('A', 28, 100, 10), L('Z', 1, 100, 10)]), ['A'])
    expect(a).toMatchObject({ pct: 50, n: 10, dias: 1, videos: 1 })
  })
  it('% acima de 100 é dado válido: a média passa de 100 e não é recortada', () => {
    const a = assistidoDoCanal(ok([L('A', 1, 10, 120)]), ['A'])
    expect(a.pct).toBe(120)
  })
  it('sem nenhuma linha que entre: pct nulo com o motivo, nunca 0', () => {
    expect(assistidoDoCanal(ok([L('A', 1, 0, 50)]), ['A'])).toMatchObject({ pct: null, n: 0, motivo: 'sem-views' })
    expect(assistidoDoCanal(ok([L('A', 1, 5, null)]), ['A'])).toMatchObject({ pct: null, n: 0, motivo: 'sem-percentual' })
    expect(assistidoDoCanal(ok([], null), ['A'])).toMatchObject({ pct: null, motivo: 'sem-diario' })
    expect(assistidoDoCanal({ acesso: 'negado' }, ['A'])).toMatchObject({ pct: null, motivo: 'sem-acesso' })
    expect(assistidoDoCanal({ acesso: 'erro' }, ['A'])).toMatchObject({ pct: null, motivo: 'leitura-falhou' })
  })
  it('os limiares da tela são os decididos pelo dono', () => {
    expect(MIN_DIAS_ASSISTIDO).toBe(7)
    expect(POUCAS_VIEWS_MEDIA).toBe(30)
  })
})

describe('viewsDoCanalPorDia', () => {
  it('28 dias que terminam no último dia gravado; soma os vídeos; zero medido e não medido são diferentes', () => {
    const r = viewsDoCanalPorDia(ok([L('A', 0, 5, null), L('B', 0, 7, null), L('A', 1, 0, null), L('B', 1, 0, null), L('A', 3, 4, null)]), ['A', 'B'])
    expect(r.periodo).toEqual({ de: dia(27), ate: ULT, dias: 28 })
    expect(r.dias).toHaveLength(28)
    const por = (atras: number) => r.dias.find(d => d.dia === dia(atras))!
    expect(por(0)).toMatchObject({ situacao: 'com-impressoes', imp: 12, cliques: null })
    expect(por(1)).toMatchObject({ situacao: 'zero-medido', imp: 0 })
    expect(por(2)).toMatchObject({ situacao: 'nao-medido', imp: null })
    expect(por(3)).toMatchObject({ situacao: 'com-impressoes', imp: 4 })
  })
  it('dia só com views nulas é não medido (nunca zero)', () => {
    const r = viewsDoCanalPorDia(ok([L('A', 0, null, null), L('A', 1, 3, null)]), ['A'])
    expect(r.dias.find(d => d.dia === ULT)).toMatchObject({ situacao: 'nao-medido', imp: null })
  })
  it('sem acesso, com erro ou sem diário: sem período e sem dias', () => {
    for (const p of [{ acesso: 'negado' } as const, { acesso: 'erro' } as const, ok([], null)]) expect(viewsDoCanalPorDia(p, ['A'])).toEqual({ periodo: null, dias: [], foraDoTeto: 0 })
  })
})

describe('views28DoVideo', () => {
  it('soma as views dos 28 dias; nula quando o vídeo não tem nenhuma linha com views', () => {
    expect(views28DoVideo(ok([L('A', 0, 5, null), L('A', 5, 7, null), L('A', 40, 100, null)]), 'A')).toBe(12)
    expect(views28DoVideo(ok([L('A', 0, null, null)]), 'A')).toBeNull()
    expect(views28DoVideo(ok([L('B', 0, 5, null)]), 'A')).toBeNull()
    expect(views28DoVideo(ok([L('A', 0, 0, null)]), 'A')).toBe(0)
    expect(views28DoVideo({ acesso: 'negado' }, 'A')).toBeNull()
  })
})

// 13.3 (Menor 2): as views dos 28 dias só são "dos 28 dias" quando o diário cobre os dias; a tela diz "N de M dias medidos" quando cobre menos.
describe('cobertura28DoVideo', () => {
  it('janela cheia: 28 dias esperados para um vídeo publicado antes da janela; mede quantos dias distintos têm views', () => {
    // 10 dias com views (hoje, -1 … -9)
    const linhas = Array.from({ length: 10 }, (_, i) => L('A', i, 5, null))
    expect(cobertura28DoVideo(ok(linhas), 'A', dia(60))).toEqual({ medidos: 10, esperados: 28 })
    // 28 dias com views: cheia
    expect(cobertura28DoVideo(ok(Array.from({ length: 28 }, (_, i) => L('A', i, 5, null))), 'A', dia(60))).toEqual({ medidos: 28, esperados: 28 })
  })
  it('vídeo publicado dentro da janela: esperados = dias da publicação até o último dia gravado (os dois contam)', () => {
    // publicado há 11 dias (dia -11): -11 … 0 são 12 dias
    expect(cobertura28DoVideo(ok(Array.from({ length: 12 }, (_, i) => L('A', i, 5, null))), 'A', dia(11))).toEqual({ medidos: 12, esperados: 12 })
    expect(cobertura28DoVideo(ok(Array.from({ length: 8 }, (_, i) => L('A', i, 5, null))), 'A', dia(11))).toEqual({ medidos: 8, esperados: 12 })
    // publicado no último dia gravado: 1 dia esperado
    expect(cobertura28DoVideo(ok([L('A', 0, 5, null)]), 'A', ULT)).toEqual({ medidos: 1, esperados: 1 })
  })
  it('sem data de publicação: a janela inteira de 28 dias', () => {
    expect(cobertura28DoVideo(ok([L('A', 0, 5, null)]), 'A', null)).toEqual({ medidos: 1, esperados: 28 })
  })
  it('conta DIAS distintos com views: dia com view nula, dia fora da janela e linha de outro vídeo não contam; dia com zero view medido conta', () => {
    const linhas = [L('A', 0, 5, null), L('A', 1, 0, null), L('A', 2, null, null), L('A', 28, 9, null), L('B', 3, 9, null)]
    expect(cobertura28DoVideo(ok(linhas), 'A', dia(60))).toEqual({ medidos: 2, esperados: 28 })
  })
  it('sem nenhuma linha com views: nula (não medido, nunca "0 de 28"); sem acesso ou sem diário também', () => {
    expect(cobertura28DoVideo(ok([L('A', 0, null, null)]), 'A', dia(60))).toBeNull()
    expect(cobertura28DoVideo(ok([L('B', 0, 5, null)]), 'A', dia(60))).toBeNull()
    expect(cobertura28DoVideo({ acesso: 'negado' }, 'A', dia(60))).toBeNull()
    expect(cobertura28DoVideo({ acesso: 'erro' }, 'A', dia(60))).toBeNull()
    expect(cobertura28DoVideo(ok([L('A', 0, 5, null)], null), 'A', dia(60))).toBeNull()
  })
  it('publicado DEPOIS do último dia gravado (data adiantada): não inventa dias esperados negativos; no mínimo 1', () => {
    expect(cobertura28DoVideo(ok([L('A', 0, 5, null)]), 'A', '2026-10-20')).toEqual({ medidos: 1, esperados: 1 })
  })
})
