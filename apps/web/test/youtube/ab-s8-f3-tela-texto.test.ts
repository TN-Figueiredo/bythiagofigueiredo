// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { Placar, PlacarVariante } from '@/lib/youtube/ab-gravacao/placar'
import {
  casoDoPlacar, faixaDoPlacar, fraseDoPlacar, ordenarPorRotulo,
} from '@/app/cms/(authed)/youtube/ab-lab/_components/placar-texto'

function pv(id: string, o: Partial<PlacarVariante> = {}): PlacarVariante {
  return {
    variant_id: id, dias: 0, dias_validos: 0, dias_zero: 0, dias_ausentes: 0, dias_aguardando: 0,
    dias_nao_medidos: 0, dias_fora_do_ctr: 0, impressoes: null, impressoes_com_ctr: null, cliques: null, ctr: null, views: null, ...o,
  }
}
function pl(o: Partial<Placar> = {}): Placar {
  return {
    regra: 'v2', estatistica: 'nao_calculada', variantes: [pv('a'), pv('b')], dias_total: 4, dias_descartados: 0,
    dias_variante_desconhecida: 0, atualizado_em: '2026-10-20T10:00:00Z', desatualizado: false, atrasado: false,
    todos_finais: false, iniciado: true, proximo_fechamento: null, ...o,
  }
}
const com = (i: number, c: number | null, ic: number | null = i) => ({ impressoes: i, cliques: c, impressoes_com_ctr: ic, dias: 2, dias_validos: 2 })

describe('S8-F3 T5: casos e frases do placar (tabela)', () => {
  const casos: Array<[string, Placar, string]> = [
    ['nao iniciado', pl({ iniciado: false, dias_total: 0 }), 'nao_iniciado'],
    ['atrasado ganha de sem dia', pl({ atrasado: true, dias_total: 0 }), 'atrasado'],
    ['atrasado com linhas', pl({ atrasado: true }), 'atrasado'],
    ['sem dia fechado', pl({ dias_total: 0 }), 'sem_dia_fechado'],
    ['nao medido: volume sem CTR', pl({ variantes: [pv('a', com(0, 0, 0)), pv('b', { impressoes: 5000, impressoes_com_ctr: 0, cliques: null })] }), 'nao_medido'],
    ['poucas: 1 a 3', pl({ variantes: [pv('a', com(3, 1)), pv('b', com(2, 0))] }), 'poucas'],
    ['normal', pl({ variantes: [pv('a', com(2105, 97)), pv('b', com(2105, 112))] }), 'normal'],
  ]
  for (const [nome, p, caso] of casos) it(`caso: ${nome}`, () => expect(casoDoPlacar(p)).toBe(caso))

  it('faixa: atrasado vence sem dia fechado; some quando nenhum dos dois', () => {
    expect(faixaDoPlacar(pl({ atrasado: true, dias_total: 0 }))).toBe('atrasado')
    expect(faixaDoPlacar(pl({ dias_total: 0 }))).toBe('sem_dia_fechado')
    expect(faixaDoPlacar(pl({ iniciado: false, dias_total: 0 }))).toBeNull()
    expect(faixaDoPlacar(pl())).toBeNull()
  })

  it('frase normal: total de impressões, sem % e sem comparação', () => {
    const f = fraseDoPlacar(pl({ variantes: [pv('a', com(2105, 97)), pv('b', com(2105, 112))] }), 'active')
    expect(f.principal).toBe('2 variantes, 4.210 impressões no total.')
    expect(`${f.principal} ${f.apoio}`).not.toMatch(/%|vencedor|líder|chance|melhor/i)
  })
  it('frase com aguardando cita a data limite', () => {
    const f = fraseDoPlacar(pl({ proximo_fechamento: '2026-10-31', variantes: [pv('a', { ...com(10, 1), dias_aguardando: 1 }), pv('b', com(10, 1))] }), 'active')
    expect(f.apoio).toContain('31/10')
    expect(f.apoio).toContain('aguarda o YouTube')
  })
  it('frase v1 diz que termina por duração', () => {
    const f = fraseDoPlacar(pl({ regra: 'v1', variantes: [pv('a', com(5, 1)), pv('b', com(5, 1))] }), 'active', undefined, { dayOf: 8, total: 14 })
    expect(f.apoio).toBe('Este teste termina por duração, no dia 14.')
  })
  it('frase atrasado: último dia gravado vem da faixa; sem linhas diz que não rodou desde o início', () => {
    const dia = (d: string) => ({ day_pt: d, variante: 'a', estado: 'medido' as const, impressoes: 1, ctr: 0.1, motivo: null })
    expect(fraseDoPlacar(pl({ atrasado: true }), 'active', [dia('2026-10-19'), dia('2026-10-21')]).principal).toContain('21/10')
    expect(fraseDoPlacar(pl({ atrasado: true, dias_total: 0 }), 'active').principal).toContain('não rodaram desde o início')
  })
  it('frase não medido e poucas', () => {
    expect(fraseDoPlacar(pl({ variantes: [pv('a', com(0, 0, 0)), pv('b', { impressoes: 5000, impressoes_com_ctr: 0, cliques: null })] }), 'active').principal)
      .toContain('ainda não têm cliques')
    expect(fraseDoPlacar(pl({ variantes: [pv('a', com(3, 1)), pv('b', com(2, 0))] }), 'active').apoio).toContain('Não leia isto como resultado')
  })
  it('ordem fixa por rótulo A, B, C, D, qualquer que seja a entrada', () => {
    const em = [{ label: 'C' }, { label: 'A' }, { label: 'D' }, { label: 'B' }]
    expect(ordenarPorRotulo(em).map(x => x.label)).toEqual(['A', 'B', 'C', 'D'])
    expect(em.map(x => x.label)).toEqual(['C', 'A', 'D', 'B']) // não muta
  })
})

describe('conserto do lote (Yannis 3)', () => {
  it('dias aguardando somam as variantes (cada dia tem uma só)', () => {
    const f = fraseDoPlacar(pl({ variantes: [pv('a', { ...com(10, 1), dias_aguardando: 1 }), pv('b', { ...com(10, 1), dias_aguardando: 1 })] }), 'active')
    expect(f.apoio).toContain('2 dias ainda aguardam')
  })
})
