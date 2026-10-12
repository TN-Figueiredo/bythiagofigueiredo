// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { aplicarFiltrosDeAuditoria } from '@/app/admin/(authed)/audit/filtros'

const gravador = () => {
  const chamadas: string[] = []
  const q = {
    eq: (c: string, v: string) => { chamadas.push(`eq ${c} ${v}`); return q },
    not: (c: string, op: string, v: string) => { chamadas.push(`not ${c} ${op} ${v}`); return q },
  }
  return { q, chamadas }
}

describe('aplicarFiltrosDeAuditoria', () => {
  it('sem filtro de ação: as duas ações do registro de leitura do pipeline ficam fora da listagem', () => {
    const { q, chamadas } = gravador()
    aplicarFiltrosDeAuditoria(q, {})
    expect(chamadas).toEqual(['not action in (pipeline_leitura_aviso,pipeline_leitura_recusada)'])
  })
  it('com filtro de ação: vale o filtro (é assim que se veem as linhas do registro)', () => {
    const { q, chamadas } = gravador()
    aplicarFiltrosDeAuditoria(q, { action: 'pipeline_leitura_aviso', org: 'o1', resource: 'pipeline_api_key' })
    expect(chamadas).toEqual(['eq org_id o1', 'eq action pipeline_leitura_aviso', 'eq resource_type pipeline_api_key'])
  })
})
