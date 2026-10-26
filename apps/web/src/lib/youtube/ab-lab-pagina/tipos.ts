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

export interface LinhaConcluida {
  chave: string
  origem: 'lab' | 'studio'
  testId: string | null
  ytId: string
  titulo: string
  miniaturaUrl: string | null
  tipo: 'Título' | 'Miniatura' | 'Título e miniatura'
  /** "B venceu" | "A (original) ficou" | "B sugerido pelo teste" | "Sem vencedor" */
  resultado: string
  /** "no ar desde 26/10" | "falta aplicar no vídeo" | "no ar desde 12/10 · você contou do Studio" | "no ar: não confirmado" */
  apoio: string
  acao: { rotulo: `Aplicar ${string}` | 'Voltar à original'; painel: PainelDecisao } | null
  /** ISO usado para ordenar (mais recente primeiro) */
  ordem: string
}

// ---- Modelo da página (M7 T4) ----
import type { AbTestCardView, AbTestDraft, AbTestWithVariants } from '../ab-types'
import type { TelaV2 } from '../ab-gravacao/tela-v2'
import type { LinhaDoCaminho } from '../teste-youtube/nativo/lista'

export type ItemComVoce =
  | { tipo: 'primeiro_teste' }
  | { tipo: 'rascunho'; draftId: string; titulo: string; passo: number }
  | { tipo: 'aplicar'; testId: string; titulo: string; letra: string; motivo: string; painel: PainelDecisao }
  | { tipo: 'dia14'; titulo: string; linha: LinhaDoCaminho; ytId: string; prazo: string; vencido: boolean }
  | { tipo: 'conferir_studio'; titulo: string; ytId: string }
  | { tipo: 'retomar'; titulo: string; testId: string; pausadoHaDias: number | null }

export type CartaoEmTeste =
  | { tipo: 'lab'; card: AbTestCardView; lider: { letra: string; ctrs: [string, string] } | null; semLider: 'poucos dados' | 'CTR não medido'; proximaTroca: string | null; painel: PainelDecisao | null; /** pendência do dono neste teste (rodapé âmbar); o modelo ainda não a preenche */ pendencia?: { verbo: string; botao: string } }
  | { tipo: 'studio'; linha: LinhaDoCaminho; titulos: Array<{ letra: string; titulo: string | null }>; labPausadoAte: string | null; dia14: boolean }

export interface PaginaDoLab {
  topo: { frase: string }
  comVoce: { itens: ItemComVoce[]; vazio: string | null }
  emTeste: CartaoEmTeste[]
  concluidos: { linhas: LinhaConcluida[]; total: number; regua: { feitos: number; meta: 3 } | null }
  temHistorico: boolean
}

export interface EntradaPagina {
  ativos: Array<{ card: AbTestCardView; bruto: AbTestWithVariants; tela: Extract<TelaV2, { fase: 'ativo' }> | null; ctrs: Record<string, number | null> }>
  concluidos: Array<{ card: AbTestCardView; bruto: AbTestWithVariants; tela: Extract<TelaV2, { fase: 'concluido' }> | null; ctrs: Record<string, number | null> }>
  pausados: AbTestCardView[]
  rascunhos: AbTestDraft[]
  linhas: LinhaDoCaminho[]
  podeDeixarVariante: boolean
  agora: Date
}
