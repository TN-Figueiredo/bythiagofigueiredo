// Tipos compartilhados pelos passos da coleta dos canais próprios (lote L1a).
import type { SupabaseClient } from '@supabase/supabase-js'

export const OUTCOMES = [
  'ok', 'sem_dado_na_janela', 'video_novo', 'sem_conexao', 'sem_autorizacao',
  'erro_http', 'nao_alcancado_orcamento', 'schema_ausente',
] as const
export type Outcome = (typeof OUTCOMES)[number]
export type AttemptKind = 'sondagem' | 'meta' | 'thumbnail' | 'relatorio' | 'diario' | 'retencao_vida'
export type ScopeType = 'video' | 'canal' | 'job'

/** Linha de `youtube_channels` como a coleta lê. `id` é o uuid; `channel_id` é o UC… do YouTube. */
export interface ColetaChannel {
  id: string
  channel_id: string
  site_id: string
  name: string
  sync_enabled: boolean
  /** `reautorizar` = o canal perdeu a autorização: a coleta por token para até o dono reconectar. */
  collection_status: 'ok' | 'reautorizar'
  /** O que o YouTube informou no último sync do canal. Nulo = não sabemos. */
  video_count: number | null
}

/** Uma linha de `yt_own_collection_attempts` (o dia é posto pelo banco, em UTC). */
export interface Tentativa {
  site_id: string
  scope_type: ScopeType
  /** video: id do YouTube · canal: youtube_channels.id · job: `<youtube_channels.id>:<report_type_id>` */
  scope_id: string
  kind: AttemptKind
  outcome: Outcome
  http_status?: number | null
  error?: string | null
  channel_id?: string | null
}

/** O que cada passo recebe. `deadline` é um instante (epoch ms), não uma duração. */
export interface StepCtx {
  supabase: SupabaseClient
  channels: ColetaChannel[]
  deadline: number
  falhas: string[]
  tentativas: Tentativa[]
  /** `youtube_channels.id` dos canais com uma chamada autenticada (Data API ou Analytics API) que passou nesta execução. */
  autorizados?: Set<string>
  /** `youtube_channels.id` dos canais com uma chamada autenticada negada por autorização nesta execução. */
  negados?: Set<string>
}

export interface StepResumo {
  gravados: number
  tentativas: Partial<Record<Outcome, number>>
  pendentes: number
}

export interface ColetaResult {
  falhas: string[]
  resumo: Record<string, unknown>
}
