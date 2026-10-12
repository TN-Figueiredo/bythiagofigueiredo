// Tipos e constantes da YouTube Reporting API (relatórios em lote). API separada da Analytics API.

/**
 * Tipos de relatório que o site pede. Habilitar um tipo é um commit de uma linha: o passo de jobs cria o job na
 * execução seguinte e o YouTube gera os 30 dias anteriores, que vencem 30 dias depois de gerados.
 * A ORDEM só desempata a fila de download (quem manda é o vencimento: coleta/fila-relatorios.ts).
 * Os 9 depois de `channel_basic_a3` entraram na E12 da A5 e só guardam o bruto (sem normalizador, sem tela).
 * Ids como o YouTube os ofereceu aos dois canais em 12/10/2026 (linhas `desativado` de yt_reporting_jobs).
 * Fora de propósito: `channel_annotations_a1` (recurso extinto) e os tipos `playlist_*`.
 */
export const REPORT_TYPES_ENABLED = [
  'channel_reach_basic_a1',
  'channel_reach_combined_a1',
  'channel_traffic_source_a3',
  'channel_basic_a3',
  'channel_combined_a3',
  'channel_device_os_a3',
  'channel_playback_location_a3',
  'channel_province_a3',
  'channel_demographics_a1',
  'channel_subtitles_a3',
  'channel_cards_a1',
  'channel_end_screens_a1',
  'channel_sharing_service_a1',
] as const
export type ReportTypeId = (typeof REPORT_TYPES_ENABLED)[number]

/** "Relatório de alcance" nos critérios da seção 9 do spec. */
export const REACH_TYPES = ['channel_reach_basic_a1', 'channel_reach_combined_a1'] as const

/** Tipos sem normalizador neste spec: o bruto é apagado 180 dias depois do download. */
export const SEM_NORMALIZADOR: string[] = REPORT_TYPES_ENABLED.filter(t => t !== 'channel_reach_basic_a1')

export interface ReportType {
  id: string
  name?: string
  /** Quando o YouTube marcou (ou vai marcar) o tipo como descontinuado. Ausente = tipo corrente. */
  deprecateTime?: string
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

/**
 * O arquivo passou de um teto de tamanho: o bruto NÃO é guardado e não há conserto automático (tentar de novo baixaria o
 * mesmo arquivo). `lado` diz qual teto estourou; `bytes` é o tamanho comprimido que se sabe (declarado, lido até parar ou
 * o do gzip que descomprime demais). Nunca é erro de zlib (`Z_*`): quem trata gzip inválido como passageiro não pode pegá-lo.
 */
export class ArquivoGrandeDemaisError extends Error {
  constructor(
    public readonly lado: 'comprimido' | 'descomprimido',
    public readonly bytes: number,
    /** Texto para a nota visível: o tamanho e o teto. */
    public readonly detalhe: string,
  ) {
    super(`relatório grande demais (${lado}): ${detalhe}`)
    this.name = 'ArquivoGrandeDemaisError'
  }
}
