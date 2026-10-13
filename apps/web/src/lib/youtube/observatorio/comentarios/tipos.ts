// A5 · E14: os tipos da coleta de comentários. Nenhum campo de texto livre de terceiros além de `texto` e do nome do autor,
// e esses nunca vão a log, nota, erro nem Sentry.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CODIGOS_EXECUCAO, MOTIVOS } from './regras'

export type Marco = 1 | 7 | 30
export type EstadoRetrato = 'ok' | 'sem_comentarios' | 'desligados' | 'erro'
export type Motivo = typeof MOTIVOS[number]
export type CodigoExecucao = typeof CODIGOS_EXECUCAO[number]

export interface Autor { nome: string | null; canalId: string | null; foto: string | null }

export interface RespostaVista {
  id: string
  texto: string
  cortado: boolean
  publicadoEm: string
  editadoEm: string | null
  curtidas: number
  autorCanalId: string | null
}

export interface Conversa {
  id: string
  posicao: number
  texto: string
  cortado: boolean
  publicadoEm: string
  editadoEm: string | null
  curtidas: number
  respostasTotal: number
  autor: Autor
  doCriador: boolean
  criadorRespondeu: boolean | null
  respostasDoCriador: RespostaVista[]
  canaisNasRespostas: string[]
}

export interface Destaque {
  motivo: 'canal_acompanhado' | 'inscritos' | 'canal_proprio'
  canalRowId: string | null
  faixaTamanho: string | null
  faixaRazao: string | null
}

export interface Escolhido {
  conversa: Conversa
  grupo: 'criador' | 'destaque' | 'curtidos'
  destaque: Destaque | null
}

/** As quinze colunas de `competitor_comment_due`, em camelCase. */
export interface Devido {
  videoId: string
  youtubeVideoId: string
  siteId: string
  channelRowId: string
  channelYoutubeId: string
  channelSubscribers: number | null
  channelSubscribersHidden: boolean | null
  mark: Marco
  t0: string
  deadline: string
  videoCommentCount: number | null
  videoCheckedAt: string | null
  prevStatus: string | null
  storedN: number
  totalDue: number
}

/** As chaves de `competitor_comment_health`. */
export interface ProvaComentarios {
  identidade_vencida: number
  identidade_prazo_errado: number
  identidade_de_criador: number
  respostas_de_terceiros: number
  retratos_atrasados: number
  retratos_em_erro: number
  erros_por_motivo: Record<string, number>
  retratos_na_janela: number
  retratos_perdidos_7d: number
  perdidos_por_motivo: Record<string, number>
  retratos_total: number
  retratos_ok: number
  primeira_coleta: string | null
  ultima_coleta: string | null
  comentarios_total: number
  identidades_total: number
  comentarios_ausentes_sem_decisao: number
}

/** O que se guarda do lote lido (`pool_stats`): só número e sim/não. Lote vazio: `curtidas_max` e `curtidas_mediana` ausentes. */
export interface AgregadosDoLote {
  conversas: number
  descartadas: number
  curtidas_soma: number
  curtidas_max?: number
  curtidas_mediana?: number
  respostas_soma: number
  do_criador: number
  criador_respondeu_sim: number
  criador_respondeu_nao: number
  criador_respondeu_nao_se_sabe: number
  autores_distintos: number
  sem_canal: number
  nas_primeiras_24h: number
}

export interface TarefaCtx {
  sb: SupabaseClient
  apiKey: string
  now: () => number
  t0: number
  inicioMs: number
  /** Só os testes passam. */
  siteId?: string
  fetchImpl?: typeof fetch
  /** Só os testes passam. */
  apiBase?: string
}

export interface TarefaSaida {
  status: 'ok' | 'parcial' | 'erro'
  feitos: number
  ficaram: number
  motivo?: CodigoExecucao
  numeros: Record<string, number>
}
