// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { criarTravaDeTaxa } from '../../src/lib/sentry-rate-limit'

type Ev = { message?: string; level?: string; exception?: { values?: Array<{ value?: string }> } }

describe('trava de taxa do Sentry Node', () => {
  it('corta a mensagem repetida depois do teto por mensagem', () => {
    const t = criarTravaDeTaxa({ porMensagem: 3, total: 100, janelaMs: 1000 })
    const r = Array.from({ length: 5 }, () => t.permitir({ message: 'aviso', level: 'warning' } as Ev, 0))
    expect(r).toEqual([true, true, true, false, false])
  })

  it('mensagens diferentes têm tetos separados, mas o total por instância vale', () => {
    const t = criarTravaDeTaxa({ porMensagem: 10, total: 4, janelaMs: 1000 })
    const r = ['a', 'b', 'c', 'd', 'e'].map((m) => t.permitir({ message: m, level: 'warning' } as Ev, 0))
    expect(r).toEqual([true, true, true, true, false])
  })

  it('nível error e fatal nunca é cortado', () => {
    const t = criarTravaDeTaxa({ porMensagem: 1, total: 1, janelaMs: 1000 })
    for (let i = 0; i < 20; i++) {
      expect(t.permitir({ message: 'x', level: 'error' } as Ev, 0)).toBe(true)
      expect(t.permitir({ message: 'y', level: 'fatal' } as Ev, 0)).toBe(true)
    }
  })

  it('erro sem level (exceção) também passa', () => {
    const t = criarTravaDeTaxa({ porMensagem: 1, total: 1, janelaMs: 1000 })
    for (let i = 0; i < 5; i++) {
      expect(t.permitir({ exception: { values: [{ value: 'boom' }] } } as Ev, 0)).toBe(true)
    }
  })

  it('a janela vence e libera de novo', () => {
    const t = criarTravaDeTaxa({ porMensagem: 1, total: 100, janelaMs: 1000 })
    expect(t.permitir({ message: 'a', level: 'info' } as Ev, 0)).toBe(true)
    expect(t.permitir({ message: 'a', level: 'info' } as Ev, 500)).toBe(false)
    expect(t.permitir({ message: 'a', level: 'info' } as Ev, 1001)).toBe(true)
  })

  it('padrão sem opções: tetos finitos e positivos (nada de limite infinito)', () => {
    const t = criarTravaDeTaxa()
    let passou = 0
    for (let i = 0; i < 1000; i++) if (t.permitir({ message: 'm', level: 'warning' } as Ev, 0)) passou++
    expect(passou).toBeGreaterThan(0)
    expect(passou).toBeLessThan(50)
  })
})
