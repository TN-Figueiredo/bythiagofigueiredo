// A4 R3: os tipos do modelo puro da consulta. Só tipos: nada aqui roda.
import type { Observatory } from '../index'
import type { MedidasDoSite } from '../medidas-telas/carregar-do-site'

export type MetricaDaConsulta = 'views' | 'likes' | 'comentarios' | 'vpd7' | 'multiplicador' | 'engajamento' | 'inscritos'

export interface PedidoDaConsulta {
  formato: 'longos' | 'shorts' | 'todos'
  janelaIdade: string[] | 'todas'
  canalIds?: string[]
  nicho?: string
  lugar?: string
  publicadoDe?: string
  publicadoAte?: string
  metricas: MetricaDaConsulta[]
  ordenarPor: MetricaDaConsulta
  direcao: 'desc' | 'asc'
  limite: number
  incluirBaseFraca: boolean
}

export interface CelulaDaConsulta {
  x: number | null
  estado: 'medido' | 'zero_medido' | 'nao_medido' | 'falhou'
  causa?: string
  vpdBase?: '7d' | 'desde_publicacao'
  /** Só `engajamento`: a base da M7 do vídeo (`idade_30` ou `total_de_hoje`). */
  base?: 'idade_30' | 'total_de_hoje'
}

export interface LinhaDaConsulta {
  id: string; ytId: string; titulo: string; canal: string; canalId: string; publicadoEm: string; idadeDias: number
  formato: 'longos' | 'shorts'; formatoConfirmado: boolean
  estado: 'ativo' | 'leitura_mensal' | 'so_no_arquivo'
  medidoEm: string | null; lugares: string[] | null
  celulas: Partial<Record<MetricaDaConsulta, CelulaDaConsulta>>
  multN: number | null; multMetodo: string | null; baseFraca: boolean; motivos: string[]
}

export interface EntradaDoConjunto { obs: Observatory; medidas: MedidasDoSite; marcados: Set<string> | null; agoraMs: number }
