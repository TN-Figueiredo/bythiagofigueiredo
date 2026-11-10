// @vitest-environment node
/**
 * A5 F0.5a-T2/T3, commit 0: a REDE da regra "a F0.5 não muda estado de célula" para Destaques e Mudanças (Yannis I1). Gravada contra o código de ANTES
 * do conserto; depois dele tem de continuar verde SEM regravar os arquivos de instantâneo.
 */
import { describe, it, expect } from 'vitest'
import { casosDeOutliers, casosDeMudancas } from './contexto-ia-x-telas-fixture'
import { mapaDeEstados } from './contexto-ia-x-fixture'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'

const mapa = (casos: Array<{ nome: string; pacote: PacoteModelo }>) => casos.map((c) => `## ${c.nome}\n${mapaDeEstados(c.pacote).join('\n')}`).join('\n\n') + '\n'

describe('Destaques e Mudanças: estados iguais (rede da F0.5a)', () => {
  it('Destaques: o mapa tabela/coluna/linha → estado e texto é o de antes do conserto', async () => {
    const saida = mapa(casosDeOutliers())
    expect(saida, 'a rede tem células medidas').toMatch(/outliers\/Múltiplo: M+ /)
    await expect(saida).toMatchFileSnapshot('__snapshots__/contexto-ia-x-estados-outliers.txt')
  })
  it('Mudanças: o mapa tabela/coluna/linha → estado e texto é o de antes do conserto', async () => {
    const saida = mapa(casosDeMudancas())
    expect(saida, 'a rede tem células medidas').toMatch(/trocas-efeito\/Observado: M+ /)
    expect(saida, 'a rede tem o quadro').toMatch(/quadro-de-efeito\/Com veredito \(n\): /)
    await expect(saida).toMatchFileSnapshot('__snapshots__/contexto-ia-x-estados-mudancas.txt')
  })
})
