import type { ContagemLeituras } from '../tipos'

export interface EvidenciaRodada {
  rodada: string // = RodadaTitulo.chave
  de: string
  ate: string
  votos: Record<string, number> // chave = índice da variante ("0","1","2") ou "x" (texto fora das variantes)
  mista: boolean
  ms_desde_escrita: number | null
}

export interface MedidaPropagacao {
  mistas48ForaQuarentena: number
  minDesdeEscrita: number[] | null
}

export type EstadoAvaliacao14 = 'sem_leitura' | 'insuficiente' | 'nada_visivel' | 'provavel_teste' | 'sem_rodada_nova' | 'erro'

export interface NovaAvaliacao {
  avaliadaEm: string
  ateLidaEm: string | null
  estado14: EstadoAvaliacao14
  motivo14: string | null
  estado48: Exclude<EstadoAvaliacao14, 'sem_rodada_nova' | 'erro'> | null
  mistas48: number | null
  mistas48ForaQuarentena: number | null
  minDesdeEscrita: number[] | null
  contagem: ContagemLeituras | null
  escritas: number | null
  versaoRegra: number
  registroId: string | null
  erro: string | null
  retroativa: boolean
  aviso: 'variantes_demais' | null
}
