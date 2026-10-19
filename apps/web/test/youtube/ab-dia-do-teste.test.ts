// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { diaDoTeste, duracaoPrevista } from '@/lib/youtube/ab-dia-do-teste'

const AGORA = new Date('2026-10-19T12:00:00Z')
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * 86400000).toISOString()

describe('diaDoTeste', () => {
  it('3,5 dias atrás vira 3', () => {
    expect(diaDoTeste(diasAtras(3.5), null, AGORA)).toBe(3)
  })
  it('fim antes do agora usa o fim', () => {
    expect(diaDoTeste(diasAtras(10), diasAtras(4), AGORA)).toBe(6)
  })
  it('nulo ou ilegível devolve null', () => {
    expect(diaDoTeste(null, null, AGORA)).toBeNull()
    expect(diaDoTeste('lixo', null, AGORA)).toBeNull()
    expect(diaDoTeste(diasAtras(2), 'lixo', AGORA)).toBeNull()
  })
  it('início no futuro não dá negativo', () => {
    expect(diaDoTeste(diasAtras(-2), null, AGORA)).toBe(0)
  })
})

describe('duracaoPrevista', () => {
  it('usa max_duration_days', () => {
    expect(duracaoPrevista({ max_duration_days: 21 })).toBe(21)
  })
  it('sem config ou valor inválido cai em 14', () => {
    expect(duracaoPrevista(null)).toBe(14)
    expect(duracaoPrevista({})).toBe(14)
    expect(duracaoPrevista({ max_duration_days: 0 })).toBe(14)
    expect(duracaoPrevista({ max_duration_days: Number.NaN })).toBe(14)
  })
})
