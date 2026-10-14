/**
 * Lista fechada dos motivos de "não medido" das telas do canal próprio (plano E5b, Tarefa 1).
 * Só o catálogo e a origem de cada motivo; as frases ficam nos modelos de tela, que tipam o campo `motivo` com este tipo.
 */
export type MotivoNaoMedido =
  | 'coleta_comeca_em' | 'coleta_nao_comecou' | 'antes_da_coleta' | 'janela_aberta' | 'janela_fechou_antes'
  | 'janela_desistida' | 'ainda_nao_existe' | 'youtube_sem_curva' | 'nao_coletada' | 'em_revisao'
  | 'relatorio_nao_chegou' | 'busca_falhou' | 'dia_nao_chegou' | 'poucas_views' | 'coleta_desligada'
  /** a coleta roda e nenhum dia do período tem todos os vídeos medidos */
  | 'cobertura_parcial'

export type OrigemDoMotivo = 'spec-6.1.5' | 'mockup-11b' | 'mockup-12' | 'lote-1' | 'plano-e5b'

export const MOTIVOS_NAO_MEDIDO: Readonly<Record<MotivoNaoMedido, { origem: OrigemDoMotivo }>> = {
  coleta_comeca_em: { origem: 'spec-6.1.5' },
  coleta_nao_comecou: { origem: 'plano-e5b' },
  antes_da_coleta: { origem: 'spec-6.1.5' },
  janela_aberta: { origem: 'mockup-11b' },
  janela_fechou_antes: { origem: 'mockup-11b' },
  janela_desistida: { origem: 'plano-e5b' },
  ainda_nao_existe: { origem: 'mockup-11b' },
  youtube_sem_curva: { origem: 'mockup-11b' },
  nao_coletada: { origem: 'mockup-12' },
  em_revisao: { origem: 'mockup-12' },
  relatorio_nao_chegou: { origem: 'mockup-12' },
  busca_falhou: { origem: 'mockup-12' },
  dia_nao_chegou: { origem: 'lote-1' },
  poucas_views: { origem: 'lote-1' },
  coleta_desligada: { origem: 'plano-e5b' },
  cobertura_parcial: { origem: 'plano-e5b' },
}
