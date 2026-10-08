// Tipos e constantes da YouTube Reporting API (relatórios em lote). API separada da Analytics API.

/** Tipos de relatório que o site pede. A ORDEM é a prioridade de download. Habilitar um tipo é um commit de uma linha. */
export const REPORT_TYPES_ENABLED = [
  'channel_reach_basic_a1',
  'channel_reach_combined_a1',
  'channel_traffic_source_a3',
  'channel_basic_a3',
] as const
export type ReportTypeId = (typeof REPORT_TYPES_ENABLED)[number]

/** "Relatório de alcance" nos critérios da seção 9 do spec. */
export const REACH_TYPES = ['channel_reach_basic_a1', 'channel_reach_combined_a1'] as const

/** Tipos sem normalizador neste spec: o bruto é apagado 180 dias depois do download. */
export const SEM_NORMALIZADOR: string[] = REPORT_TYPES_ENABLED.filter(t => t !== 'channel_reach_basic_a1')

export interface ReportType {
  id: string
  name?: string
}

export interface Job {
  id: string
  reportTypeId: string
  name?: string
  createTime?: string
}

export interface Report {
  id: string
  jobId?: string
  startTime: string
  endTime: string
  createTime: string
  jobExpireTime?: string
  downloadUrl: string
}

/** Resposta não-ok da Reporting API. Leva só o status e o `reason`; nunca o corpo. */
export class ReportingHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly reason: string | null,
  ) {
    super(`YouTube Reporting API HTTP ${status}`)
    this.name = 'ReportingHttpError'
  }
}
