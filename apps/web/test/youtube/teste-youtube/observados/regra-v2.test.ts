// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  decidirCampo, qualificadas, rodadasDoTitulo, rodadasExigidas, rodadasMistas, tituloValido, type EstadoRegra, type LeituraObs, type Rodada,
} from '@/lib/youtube/teste-youtube/observados/inferir'
import { agoraEm, H, leitura, PUB, rodadas } from './fabrica'

const titulo = (letra: string): Partial<LeituraObs> => ({ tituloExibido: 'Titulo ' + letra })
/** itens = uma rodada por item (uma letra por passada), a partir de `h0`. */
const rs = (h0: number, itens: string[]): LeituraObs[] => rodadas(h0, itens, titulo)
const decidir = (ls: LeituraObs[], agoraH: number, campo: 'titulo' | 'miniatura' = 'titulo') =>
  decidirCampo(campo, rodadasDoTitulo(ls).rodadas, { publicadoMs: PUB.getTime(), agoraMs: agoraEm(agoraH) })
/** Hora da última rodada de uma sequência que começa em h0 com n rodadas (a passada 3 é +10 min). */
const fimH = (h0: number, n: number): number => h0 + (n - 1) * 6 + 10 / 60
const R = (tMs: number, ...v: string[]): Rodada => ({ tMs, rodadaId: 'r' + tMs + v.join(''), versoes: new Set(v) })

describe('rodadasExigidas', () => {
  it('fórmula e trava', () => {
    expect(rodadasExigidas(1)).toBe(2)
    expect(rodadasExigidas(0.5)).toBe(11)
    expect(rodadasExigidas(0.2)).toBe(35)
    expect(rodadasExigidas(0)).toBe(0)
    for (const q of [0, 1, 0.999, 1.5]) expect(Number.isFinite(rodadasExigidas(q))).toBe(true)
  })
})

describe('troca limpa A -> B (§9.2)', () => {
  it('nunca é teste; a 1ª troca sai com 28 rodadas (a 8ª de B)', () => {
    const itens = [...Array(20).fill('AAA'), ...Array(20).fill('BBB')] as string[]
    const estados: EstadoRegra[] = []
    for (let n = 21; n <= 40; n++) {
      const ls = rs(30, itens.slice(0, n))
      estados.push(decidir(ls, fimH(30, n) + 1).estado)
    }
    expect(estados).not.toContain('em_andamento')
    expect(estados).not.toContain('sumindo')
    expect(estados.indexOf('troca') + 21).toBe(28)
    expect(estados.slice(0, 7).every(e => e === 'sem_troca_vista' || e === 'nao_medido')).toBe(true)
  })
  it('Y em 100% de W⁻ e 1 blip de Y em W: nunca troca enquanto R < 2', () => {
    for (const posBlip of [15, 14]) {
      const itens = [...Array(8).fill('BBB'), ...Array(8).fill('AAA')] as string[]
      itens[posBlip] = 'AAB'
      expect(decidir(rs(30, itens), fimH(30, 16) + 1).estado).not.toBe('troca')
    }
  })
})

describe('teste A/B seguido de troca manual para C', () => {
  it('12 rodadas alternando A/B e 16 de C: terminou, ficou C', () => {
    const itens = [...Array(6).fill(['AAB', 'ABB']).flat(), ...Array(16).fill('CCC')] as string[]
    const d = decidir(rs(30, itens), fimH(30, itens.length) + 1)
    expect(d.estado).toBe('terminou')
    expect(d.x).toBe('Titulo C')
    expect([...d.sumidas].sort()).toEqual(['Titulo A', 'Titulo B'])
  })
  it('teste vivo com 2 versões misturadas em W: em_andamento', () => {
    const itens = Array(12).fill(['AAB', 'ABB']).flat() as string[]
    expect(decidir(rs(30, itens), fimH(30, itens.length) + 1).estado).toBe('em_andamento')
  })
})

describe('idioma majoritário (D-P4)', () => {
  const lr = (h: number, t: string, idioma: string | null): LeituraObs => leitura(h, { rodadaId: 'x' + h, tituloExibido: t, idioma })
  it('só a maioria vota: a minoria en não entra', () => {
    const ls = [...[0, 1, 2, 3].map(i => lr(30 + i, 'Pt ' + (i % 2), 'pt')), lr(40, 'En 3', 'en')]
    const vs = new Set(rodadasDoTitulo(ls).rodadas.flatMap(r => [...r.versoes]))
    expect([...vs].sort()).toEqual(['Pt 0', 'Pt 1'])
  })
  it('empate 9x9 vai para o idioma da leitura mais recente; idioma nulo nunca vota nem desempata', () => {
    const pt = Array.from({ length: 9 }, (_, i) => lr(30 + i, 'P', 'pt'))
    const en = Array.from({ length: 9 }, (_, i) => lr(50 + i, 'E', 'en'))
    const vs = (ls: LeituraObs[]) => [...new Set(rodadasDoTitulo(ls).rodadas.flatMap(r => [...r.versoes]))]
    expect(vs([...pt, ...en])).toEqual(['E'])
    const enAntes = en.map(l => ({ ...l, lidaEm: new Date(Date.parse(l.lidaEm) - 40 * H).toISOString() }))
    expect(vs([...pt, ...enAntes])).toEqual(['P'])
    const nulas = Array.from({ length: 5 }, (_, i) => lr(100 + i, 'N', null))
    expect(vs([...pt, ...enAntes, ...nulas])).toEqual(['P'])
  })
  it('a maioria é calculada depois de tirar os suspensos', () => {
    const ls = [...[0, 1, 2, 3, 4].map(i => lr(30 + i, 'Susp', 'pt')), ...[0, 1, 2, 3].map(i => lr(40 + i, 'Boa', 'en'))]
    const vs = (s: Set<string>) => [...new Set(rodadasDoTitulo(ls, s).rodadas.flatMap(r => [...r.versoes]))]
    expect(vs(new Set())).toEqual(['Susp'])
    expect(vs(new Set(['Susp']))).toEqual(['Boa'])
  })
  it('validade: jogador_bloqueado não invalida; sem título, sem idioma ou http != 200 invalidam', () => {
    expect(tituloValido(leitura(30, { jogadorBloqueado: true }))).toBe(true)
    expect(tituloValido(leitura(30, { tituloExibido: null }))).toBe(false)
    expect(tituloValido(leitura(30, { idioma: null }))).toBe(false)
    expect(tituloValido(leitura(30, { http: 404 }))).toBe(false)
    expect(tituloValido(leitura(30, { erro: 'x' }))).toBe(false)
  })
})

describe('bordas', () => {
  const trinta = Array(30).fill('AAA') as string[]
  it('frescor (foco 1): 8 h 59 min mede, 9 h 01 min não', () => {
    const ls = rs(30, trinta)
    const ultima = Date.parse(ls.filter(l => l.rodadaId === 'rod30-29')[0]!.lidaEm)
    const em = (min: number) => decidirCampo('titulo', rodadasDoTitulo(ls).rodadas, { publicadoMs: PUB.getTime(), agoraMs: ultima + min * 60_000 })
    expect(em(8 * 60 + 59).estado).toBe('sem_troca_vista')
    expect(em(9 * 60 + 1).estado).toBe('nao_medido')
  })
  it('span: 8 rodadas espalhadas em 73 h -> nao_medido', () => {
    const base = 100 * H
    const w = Array.from({ length: 8 }, (_, i) => R(base + (i * 73 * H) / 7, 'a'))
    expect(decidirCampo('titulo', w, { publicadoMs: 0, agoraMs: base + 73 * H + H }).estado).toBe('nao_medido')
    const w72 = Array.from({ length: 8 }, (_, i) => R(base + (i * 72 * H) / 7, 'a'))
    expect(decidirCampo('titulo', w72, { publicadoMs: 0, agoraMs: base + 72 * H + H }).x).toBe('a')
  })
  it('miniatura com qualificadas {X, Y} sem troca -> indeterminada (nunca troca nem nao_medido); título -> nao_medido', () => {
    const ant = ['a', 'b', 'a', 'b', 'a', 'b', 'a', 'b']
    const todas = [...ant, ...Array(8).fill('a')] as string[]
    const w = todas.map((v, i) => R(100 * H + i * 6 * H, v))
    const o = { publicadoMs: 0, agoraMs: w.at(-1)!.tMs + H }
    expect(decidirCampo('miniatura', w, o).estado).toBe('indeterminada')
    expect(decidirCampo('titulo', w, o).estado).toBe('nao_medido')
  })
  it('qualificadas e mistas', () => {
    const w = [R(1, 'a', 'b'), R(2, 'a', 'b'), R(3, 'a'), R(4, 'c')]
    expect([...qualificadas(w)].sort()).toEqual(['a', 'b'])
    expect(rodadasMistas(w, qualificadas(w))).toBe(2)
  })
  it('custo (foco 4): 120 rodadas e 8 versões alternando em < 50 ms', () => {
    const w = Array.from({ length: 120 }, (_, i) => R(100 * H + i * 6 * H, 'v' + (i % 8), 'v' + ((i + 3) % 8)))
    const t0 = performance.now()
    decidirCampo('titulo', w, { publicadoMs: 0, agoraMs: w.at(-1)!.tMs + H })
    expect(performance.now() - t0).toBeLessThan(50)
  })
})
