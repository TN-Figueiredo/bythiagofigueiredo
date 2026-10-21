// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { caminhoDoTeste, type Formato } from '@/lib/youtube/teste-youtube/nativo/roteador'

const f = (o: Partial<Formato> = {}): Formato => ({ isShort: false, kids: false, adulto: false, aoVivo: false, ...o })
const rota = (formato: Formato, idadeDias = 30, impressoesAcimaDoPiso: boolean | null = true) => caminhoDoTeste({ formato, idadeDias, impressoesAcimaDoPiso })

describe('caminhoDoTeste: tabela de §5.1 (isShort × kids)', () => {
  it.each([
    [true, true, 'nosso'], [false, true, 'nosso'], [null, true, 'nosso'], // kids true: nosso nas três
    [true, false, 'nosso'], // Short + kids false
    [false, false, 'nativo'],
    [null, false, 'nao_confirmado'],
    [false, null, 'nao_confirmado'], [null, null, 'nao_confirmado'],
    [true, null, 'nosso'], // is_short true já decide
  ] as const)('isShort %s, kids %s => %s', (isShort, kids, esperado) => {
    expect(rota(f({ isShort, kids })).tipo).toBe(esperado)
  })
  it('18+ true com isShort false => nosso; 18+ true com isShort nulo => nosso (o certo vence o que falta)', () => {
    expect(rota(f({ adulto: true })).tipo).toBe('nosso')
    expect(rota(f({ adulto: true, isShort: null })).tipo).toBe('nosso')
  })
  it('ao vivo ou estreia (upcoming) => nosso, mesmo com kids nulo', () => {
    expect(rota(f({ aoVivo: true })).tipo).toBe('nosso')
    expect(rota(f({ aoVivo: true, kids: null })).tipo).toBe('nosso')
  })
  it('adulto e aoVivo nulos (desconhecidos) não impedem o nativo', () => {
    expect(rota(f({ adulto: null, aoVivo: null })).tipo).toBe('nativo')
  })
  it('todo caminho traz motivo não vazio', () => {
    for (const x of [f(), f({ kids: true }), f({ isShort: true }), f({ isShort: null })]) expect(rota(x).motivo.length).toBeGreaterThan(0)
  })
})

describe('caminhoDoTeste: portão de volume (idade 0 / 6 / 7 / 8 d × impressões)', () => {
  it.each([0, 6])('idade %s d: nativo sem portão, com ou sem volume', (idade) => {
    expect(rota(f(), idade, false)).toMatchObject({ tipo: 'nativo', portao: false })
    expect(rota(f(), idade, true)).toMatchObject({ tipo: 'nativo', portao: false })
    expect(rota(f(), idade, null)).toMatchObject({ tipo: 'nativo', portao: false })
  })
  it.each([7, 8])('idade %s d: com volume => nativo com portão; sem volume => sem_volume', (idade) => {
    expect(rota(f(), idade, true)).toMatchObject({ tipo: 'nativo', portao: true })
    expect(rota(f(), idade, false)).toEqual({ tipo: 'sem_volume', motivo: 'Sem volume para teste. Trocar direto?' })
  })
  it('volume ainda não lido (null) com 7 d ou mais: nenhum caminho escolhido calado (nao_confirmado)', () => {
    expect(rota(f(), 10, null)).toMatchObject({ tipo: 'nao_confirmado' })
  })
  it('Short ou kids vence o portão: Short sem volume continua nosso', () => {
    expect(rota(f({ isShort: true }), 30, false).tipo).toBe('nosso')
  })
  it('formato não confirmado vence o portão de volume', () => {
    expect(rota(f({ isShort: null }), 30, false).tipo).toBe('nao_confirmado')
  })
})
