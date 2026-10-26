/** Tipos do modelo da página do A/B Lab (puro: sem banco nem relógio próprio). */

export type ModoPainel = 'ativo' | 'concluido' | 'aplicado'

export interface OpcaoPainel {
  varianteId: string
  letra: 'A' | 'B' | 'C' | 'D'
  original: boolean
  titulo: string | null
  miniatura: string | null
  /** fração 0..1; nulo = não medido */
  ctr: number | null
  noAr: boolean
  sugerida: boolean
  estado: 'escolhivel' | 'em_breve' | 'no_ar_fixo' | 'sem_permissao'
}

export interface PainelDecisao {
  testId: string
  nomeVideo: string
  tipo: 'thumbnail' | 'title' | 'combo'
  modo: ModoPainel
  opcoes: OpcaoPainel[]
  /** varianteId pré-marcado */
  padrao: string | null
  sugeridaLetra: string | null
  noArLetra: string
  regraV2: boolean
  restoreSeq: number
  /** 'dd/mm' */
  voltarAte: string | null
  podeDeixarVariante: boolean
}

export type EscolhaPainel =
  | { tipo: 'encerrar'; varianteId: string; original: boolean }
  | { tipo: 'aplicar_sugerida'; varianteId: string }
  | { tipo: 'voltar' }
