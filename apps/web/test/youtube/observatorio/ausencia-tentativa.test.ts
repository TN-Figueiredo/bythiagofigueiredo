// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { proximaFase, type Evento, type Fase } from '@/app/cms/(authed)/youtube/competitors/_chrome/ausencia/tentativa'

describe('proximaFase (tabela completa)', () => {
  const tabela: Array<[Fase, Evento, Fase]> = [
    ['parado', 'clicou', 'tentando'], ['parado', 'terminou_falhou', 'parado'], ['parado', 'terminou_lido', 'parado'],
    ['tentando', 'clicou', 'tentando'], ['tentando', 'terminou_falhou', 'falhou_de_novo'], ['tentando', 'terminou_lido', 'lido'],
    ['falhou_de_novo', 'clicou', 'tentando'], ['falhou_de_novo', 'terminou_falhou', 'falhou_de_novo'], ['falhou_de_novo', 'terminou_lido', 'falhou_de_novo'],
    ['lido', 'clicou', 'tentando'], ['lido', 'terminou_falhou', 'lido'], ['lido', 'terminou_lido', 'lido'],
  ]
  it.each(tabela)('%s + %s -> %s', (f, e, esperado) => expect(proximaFase(f, e)).toBe(esperado))
})
