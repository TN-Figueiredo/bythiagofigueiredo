// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { MOTIVOS_NAO_MEDIDO } from '@/lib/youtube/observatorio/proprio/motivos-nao-medido'

const NOMES = [
  'coleta_comeca_em', 'coleta_nao_comecou', 'antes_da_coleta', 'janela_aberta', 'janela_fechou_antes',
  'janela_desistida', 'ainda_nao_existe', 'youtube_sem_curva', 'nao_coletada', 'em_revisao',
  'relatorio_nao_chegou', 'busca_falhou', 'dia_nao_chegou', 'poucas_views', 'coleta_desligada',
  'cobertura_parcial',
]

describe('motivos de "não medido"', () => {
  it('todo motivo tem origem', () => {
    for (const [nome, v] of Object.entries(MOTIVOS_NAO_MEDIDO)) {
      expect(v.origem, nome).toMatch(/^(spec-6\.1\.5|mockup-11b|mockup-12|lote-1|plano-e5b)$/)
    }
  })
  it('a lista tem exatamente os 16 nomes', () => {
    expect(Object.keys(MOTIVOS_NAO_MEDIDO).sort()).toEqual([...NOMES].sort())
  })
  it('nenhum motivo de origem plano-e5b além de coleta_nao_comecou, janela_desistida, coleta_desligada e cobertura_parcial', () => {
    const doPlano = Object.entries(MOTIVOS_NAO_MEDIDO).filter(([, v]) => v.origem === 'plano-e5b').map(([k]) => k).sort()
    expect(doPlano).toEqual(['cobertura_parcial', 'coleta_desligada', 'coleta_nao_comecou', 'janela_desistida'])
  })
})
