// Tipos da gravação do A/B Lab (S8-F1). Nomes de dado copiados do spec 2026-10-18-ab-s8-placar-e-duracao-design.md.

export type EstadoAlcance = 'medido' | 'zero_medido' | 'ausente_no_relatorio' | 'aguardando' | 'nao_medido'
export type EstadoViews = 'medido' | 'zero_medido' | 'nao_medido'
export type MotivoSemVariante = 'menos_de_90' | 'meta_ausente' | 'meta_nula' | 'dia_de_outro_teste' | 'teste_apagado'

export interface RelatorioDoDia {
  report_id: string
  status: 'listado' | 'baixado' | 'vazio' | 'erro' | 'expirado_sem_baixar'
  create_time: string
  normalized_at: string | null
}

export interface LinhaAlcance {
  thumbnail_impressions: number | null
  thumbnail_ctr: number | null
  source_report_id: string
  report_create_time: string
}

export interface MetaDoDia {
  ab_test_id: string | null
  ab_variant_id: string | null
  seconds_on_air_analytics: number | null
  captured_at: string
}
