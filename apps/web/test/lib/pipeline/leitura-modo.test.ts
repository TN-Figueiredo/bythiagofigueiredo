// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { modoLeitura } from '@/lib/pipeline/leitura-modo'
import { ACAO_AVISO, ACAO_RECUSA, ACOES_DE_LEITURA, RECURSO_CHAVE } from '@/lib/pipeline/leitura-acoes'

// Review Focus 4 (E19): o lote 1 sobe em modo aviso. Trocar para 'recusa' é o commit 2 e tem de mexer neste teste.
describe('leitura-modo (valor publicado)', () => {
  it('o modo publicado é aviso, sem janela fechada e sem conferência', () => {
    const c = modoLeitura()
    expect(c.modo).toBe('aviso')
    expect(c.controleFechadoEm).toBeNull()
    expect(c.conferenciaAte).toBeNull()
  })
  it('as ações e o recurso de leitura são os esperados', () => {
    expect(ACOES_DE_LEITURA).toEqual([ACAO_AVISO, ACAO_RECUSA])
    expect(RECURSO_CHAVE).toBe('pipeline_api_key')
  })
})
