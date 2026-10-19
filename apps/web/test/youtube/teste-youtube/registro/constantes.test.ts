// @vitest-environment node
import { describe, expect, it } from 'vitest'
import * as c from '@/lib/youtube/teste-youtube/registro/constantes'

describe('constantes do registro', () => {
  it('valores nomeados do plano', () => {
    expect(c.PERIODO_DISPARO_MS).toBe(1_200_000)
    expect(c.DISPAROS_DE_ATRASO).toBe(2)
    expect(c.MARGEM_FRESCOR_MS).toBe(2_400_000)
    expect(c.JANELA_V14_MS).toBe(14 * 24 * 3_600_000)
    expect(c.JANELA_V48_MS).toBe(48 * 3_600_000)
    expect(c.JANELA_REPRODUCAO_MS).toBe(44 * 24 * 3_600_000)
    expect(c.INTERVALO_SEM_RODADA_MS).toBe(6 * 3_600_000)
    expect(c.RETENTATIVA_ERRO_MS).toBe(55 * 60_000)
    expect(c.JANELA_PROPAGACAO_MS).toBe(6 * 3_600_000)
    expect(c.EVIDENCIA_TETO).toBe(1000)
    expect(c.RETENCAO_PEDIDA_MS).toBe(365 * 24 * 3_600_000)
    expect(c.PODA_AVALIACOES_MS).toBe(180 * 24 * 3_600_000)
    expect(c.NOVO_TESTE_APOS_MS).toBe(7 * 24 * 3_600_000)
  })
})
