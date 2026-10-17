// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { dentroDosDiasAntes, numerarMudancas, tipoDaMudanca } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/mudancas-model'

const H = 3600_000
const base = Date.UTC(2026, 9, 10, 15, 0, 0)
describe('E5a T20, mudanças', () => {
  it('numera na ordem do tempo e classifica o tipo', () => {
    const l = numerarMudancas([
      { campos: ['miniatura'], deMs: base - 30 * H, ateMs: base + 24 * H, precisao: 'dia' },
      { campos: ['titulo'], deMs: base - 30 * H, ateMs: base, precisao: 'dia' },
    ])
    expect(l.map((m) => m.n)).toEqual([1, 2])
    expect(l[0]!.tipo).toBe('titulo')
    expect(tipoDaMudanca(['tags', 'descricao'])).toBe('outras')
  })
  it('janela dos 14 dias antes: dia da subida e fronteira', () => {
    expect(dentroDosDiasAntes({ dia: '2026-10-02' }, '2026-10-16')).toBe(true)
    expect(dentroDosDiasAntes({ dia: '2026-10-01' }, '2026-10-16')).toBe(false)
    expect(dentroDosDiasAntes({ dia: '2026-10-16' }, '2026-10-16')).toBe(false)
  })
})
