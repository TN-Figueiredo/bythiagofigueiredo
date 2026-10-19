// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { periodoMin, RODADA } from '@/lib/youtube/watch/rodada'
import { MARGEM_FRESCOR_MS, PERIODO_DISPARO_MS, DISPAROS_DE_ATRASO } from '@/lib/youtube/teste-youtube/registro/constantes'
import { FRESCOR_MAX_MS, somaFrescorNominalMs } from '@/lib/youtube/teste-youtube/registro/frescor'

const MIN = 60_000
const HORA = 3_600_000

describe('frescor (C-10c)', () => {
  it('a soma nominal é montada de periodoMin(4), do sorteio e do período do disparo: 8 h 00', () => {
    const esperado = periodoMin(4) * MIN + 2 * RODADA.sorteioMin * MIN + PERIODO_DISPARO_MS + PERIODO_DISPARO_MS + DISPAROS_DE_ATRASO * PERIODO_DISPARO_MS
    expect(somaFrescorNominalMs()).toBe(esperado)
    expect(somaFrescorNominalMs()).toBe(8 * HORA)
  })
  it('FRESCOR_MAX_MS = soma + margem nomeada = 8 h 40', () => {
    expect(MARGEM_FRESCOR_MS).toBe(40 * MIN)
    expect(FRESCOR_MAX_MS).toBe(somaFrescorNominalMs() + MARGEM_FRESCOR_MS)
    expect(FRESCOR_MAX_MS).toBe(8 * HORA + 40 * MIN)
  })
  it('sonda: intervalo nominal de 7,00 h entre rodadas fica abaixo do limite com folga de pelo menos 1 h', () => {
    expect(FRESCOR_MAX_MS - 7 * HORA).toBeGreaterThanOrEqual(HORA)
  })
})
