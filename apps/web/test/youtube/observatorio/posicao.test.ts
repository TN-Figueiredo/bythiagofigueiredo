// @vitest-environment node
// A3 Tarefa 2: a conta da posição ("1 + quantos têm valor MAIOR") e o texto do conjunto. Puro, sem motor.
import { describe, it, expect } from 'vitest'
import { posicoes, conjuntoTexto, type Conjunto } from '@/lib/youtube/observatorio/posicao'

const v = (id: string, x: number | null, chave?: string) => ({ id, x, chave })

describe('A3.2 posicoes: 1 + quantos têm valor maior', () => {
  it('1 + quantos são maiores; "de" é o número de quem tem valor', () => {
    const m = posicoes([v('a', 10), v('b', 30), v('c', 20)])
    expect(m.get('b')).toEqual({ pos: 1, de: 3, empate: false })
    expect(m.get('c')).toEqual({ pos: 2, de: 3, empate: false })
    expect(m.get('a')).toEqual({ pos: 3, de: 3, empate: false })
  })
  it('a ordem de entrada não importa', () => {
    const a = posicoes([v('a', 1), v('b', 2), v('c', 3)]), b = posicoes([v('c', 3), v('a', 1), v('b', 2)])
    for (const id of ['a', 'b', 'c']) expect(a.get(id)).toEqual(b.get(id))
  })
  it('empate marca os dois e pula a posição seguinte (1º, 1º, 3º)', () => {
    const m = posicoes([v('a', 50), v('b', 50), v('c', 10)])
    expect(m.get('a')).toEqual({ pos: 1, de: 3, empate: true })
    expect(m.get('b')).toEqual({ pos: 1, de: 3, empate: true })
    expect(m.get('c')).toEqual({ pos: 3, de: 3, empate: false })
  })
  it('quem tem x null recebe null e não conta em "de"', () => {
    const m = posicoes([v('a', 5), v('b', null), v('c', 9), v('d', null)])
    expect(m.get('b')).toBeNull()
    expect(m.get('d')).toBeNull()
    expect(m.get('c')).toEqual({ pos: 1, de: 2, empate: false })
    expect(m.get('a')).toEqual({ pos: 2, de: 2, empate: false })
    expect(m.size).toBe(4)
  })
  it('lista vazia: mapa vazio', () => {
    expect(posicoes([]).size).toBe(0)
  })
  it('todos sem valor: todos null', () => {
    const m = posicoes([v('a', null), v('b', null)])
    expect([m.get('a'), m.get('b')]).toEqual([null, null])
  })
  it('um só canal é "1º de 1", sem empate', () => {
    expect(posicoes([v('a', 3)]).get('a')).toEqual({ pos: 1, de: 1, empate: false })
  })
  it('zero medido entra e fica atrás de qualquer positivo; dois zeros empatam', () => {
    const m = posicoes([v('z', 0), v('p', 0.1), v('y', 0)])
    expect(m.get('p')).toEqual({ pos: 1, de: 3, empate: false })
    expect(m.get('z')).toEqual({ pos: 2, de: 3, empate: true })
    expect(m.get('y')).toEqual({ pos: 2, de: 3, empate: true })
  })
})

describe('A3.2 conjuntoTexto', () => {
  it('nicho: "em <rótulo>"; geral: "no geral"', () => {
    const n: Conjunto = { tipo: 'nicho', niche: 'viagem', label: 'Viagem' }
    expect(conjuntoTexto(n)).toBe('em Viagem')
    expect(conjuntoTexto({ tipo: 'geral' })).toBe('no geral')
  })
  it('usa o rótulo, não o id (nicho criado pelo dono)', () => {
    expect(conjuntoTexto({ tipo: 'nicho', niche: 'cozinha-2', label: 'Cozinha de rua' })).toBe('em Cozinha de rua')
  })
})

describe('A3.2 posicoes: o empate é decidido pelo valor como está escrito', () => {
  it('valores diferentes que se escrevem igual dividem a posição e levam "empate"; a ordem entre eles não muda', () => {
    const m = posicoes([v('a', 0.24, '0,2'), v('b', 0.21, '0,2'), v('c', 0.9, '0,9'), v('d', 0.05, '0,1')])
    expect(m.get('c')).toEqual({ pos: 1, de: 4, empate: false })
    expect(m.get('a')).toEqual({ pos: 2, de: 4, empate: true })
    expect(m.get('b')).toEqual({ pos: 2, de: 4, empate: true })
    expect(m.get('d')).toEqual({ pos: 4, de: 4, empate: false })
  })
  it('sem a chave escrita vale o número cru (como antes)', () => {
    const m = posicoes([v('a', 0.24), v('b', 0.21)])
    expect(m.get('a')).toEqual({ pos: 1, de: 2, empate: false })
    expect(m.get('b')).toEqual({ pos: 2, de: 2, empate: false })
  })
})
