// apps/web/test/youtube/observatorio/arquivo-interruptor.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { tituloDoInterruptor, faltaParaLigar, NOTA_DESCARTES } from '@/lib/youtube/observatorio/arquivo-mensal/interruptor'

describe('interruptor mínimo (literais do interruptor.js)', () => {
  it('faltaParaLigar', () => {
    expect(faltaParaLigar(1, 0)).toBe('Falta: 2 saídas feitas por você (1 de 3) e 2 simulações vistas (0 de 2).')
    expect(faltaParaLigar(2, 1)).toBe('Falta: 1 saída feita por você (2 de 3) e 1 simulação vista (1 de 2).')
    expect(faltaParaLigar(3, 1)).toBe('Falta: 1 simulação vista (1 de 2).')
  })
  it('títulos: não medido quando o estado não foi lido; desligado na configuração quando a variável está desligada', () => {
    expect(tituloDoInterruptor(null, true, '2028-05-03')).toBe('Automático: não medido')
    expect(tituloDoInterruptor({ estado: 'ligado', armado_ate: '2028-07-31T12:00:00Z' }, false, '2028-05-03')).toBe('Automático: desligado na configuração')
    expect(tituloDoInterruptor({ estado: 'nao_pode', descartes: 1, simulacoes: 0 }, true, '2028-05-03')).toBe('Automático: ainda não dá para ligar')
    expect(tituloDoInterruptor({ estado: 'ligado', armado_ate: '2028-05-09T12:00:00Z' }, true, '2028-05-03')).toBe('Automático: ligado, vence em 6 dias')
    expect(tituloDoInterruptor({ estado: 'desligou_sozinho', motivo: '2', desligado_em: '2028-05-02T12:00:00Z' }, true, '2028-05-03')).toBe('Automático: desligou sozinho em 02/05/2028')
    expect(tituloDoInterruptor({ estado: 'venceu', motivo: '8', desligado_em: '2028-05-02T12:00:00Z' }, true, '2028-05-03')).toBe('Automático: a validade de 90 dias acabou em 02/05/2028')
    expect(tituloDoInterruptor({ estado: 'nao_existe' }, true, '2028-05-03')).toBe('Automático: não existe aqui')
  })
})
