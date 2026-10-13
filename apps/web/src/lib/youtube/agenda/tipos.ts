import type { SupabaseClient } from '@supabase/supabase-js'
import type { BatchRow } from '@/lib/youtube/competitor-sync-batch'

/** Só tipos da agenda. Nenhuma outra tarefa declara tipo que outra importa: tudo o que duas tarefas usam nasce aqui. Não importa nada de `agenda/` nem de `horaria/`. */
export type Peso = 'sempre' | 'leve' | 'pesada'
export type Periodo = 'hora' | 'faixa' | 'dia'
/**
 * Por que uma leitura da agenda falhou (conjunto FECHADO; quem decide o que fazer decide por isto, nunca pelo texto de `porque`):
 * `schema_ausente` = a migration da agenda ainda não foi aplicada; `prazo` = o banco não respondeu a tempo (ou erro de transporte);
 * `excecao` = a chamada lançou; `erro_do_banco` = o banco respondeu com um erro de código (permissão, timeout do servidor...);
 * `forma_invalida` = resposta nula ou fora da forma esperada, ou entrada inválida do chamador.
 */
export type CausaDaFalha = 'schema_ausente' | 'prazo' | 'excecao' | 'erro_do_banco' | 'forma_invalida'
/** Uma leitura que pode falhar: o valor, ou o motivo (em português) para o resumo do disparo. `causa` é opcional: quem não a preenche continua compilando. */
export type Lido<T> = { valor: T } | { porque: string; causa?: CausaDaFalha }

export interface LinhaTarefa {
  task: string
  period_key: string
  status: 'rodando' | 'ok' | 'parcial' | 'adiada' | 'erro' | 'esgotada' | null
  attempts: number | null
  runs: number | null
  unfinished_n: number | null
  started_at: string | null
  finished_at: string | null
  done_n: number | null
  left_n: number | null
  reason: string | null
  last_ok_at: string | null
  last_run_status: string | null
  last_run_done_n: number | null
}
export interface EstadoAgenda { agora: string; desde: string | null; tarefas: LinhaTarefa[] }

/** `motivo` é CÓDIGO do catálogo da tarefa; `detalhe` é só número. Texto de fora não cabe em campo nenhum. */
export interface ResultadoTarefa {
  estado: 'ok' | 'parcial' | 'erro'
  feitas: number
  deixadas: number | null
  motivo?: string
  detalhe?: Record<string, number>
  extra?: unknown
}
export interface ContextoTarefa { t0: number; agora: () => number; apiKey: string; sb: SupabaseClient; linhas: BatchRow[] | null }

export interface Tarefa {
  /** A chave em `competitor_agenda_runs.task`. */
  nome: string
  /** O nome que o dono lê: 'leitura horária'. */
  rotulo: string
  ordem: number
  peso: Peso
  periodo: Periodo
  /** serie_semanal: 12 */
  aPartirDaHoraSP?: number
  /** hora 3, faixa 9, dia 12 */
  tetoTentativas: number
  toleranciaVigiaH: number
  /** Fechos seguidos sem terminar que tornam o disparo vermelho; null = nunca por contagem. */
  naoTerminouVermelhoEm: number | null
  /** Não começa depois disto (vira `adiada`, `sem_tempo`). */
  comecaAteMs: number
  /** O despachante desiste dela neste instante, contado de t0. */
  fimAteMs: number
  /** Só concorre à vaga da pesada quando estas não estão devidas e sãs. */
  cedeA?: string[]
  /** Para `anular_identidade` (E14). */
  nuncaDesliga?: boolean
  /** Código → frase em português, sem ponto final. Catálogo FECHADO da tarefa (frase fixa, sem número). */
  motivos: Record<string, string>
  /**
   * Opcional. Monta a frase de um código COM números, a partir de `ResultadoTarefa.detalhe` (só números).
   * Devolver texto vazio, lançar ou devolver código fora do catálogo = cai na frase fixa de `motivos`.
   * Nunca recebe texto de fora: o único dado que entra é `Record<string, number>`.
   */
  fraseDe?: (codigo: string, detalhe: Readonly<Record<string, number>>) => string | undefined
  devidaPeloDado?: (c: Pick<ContextoTarefa, 'linhas' | 'agora'>) => boolean
  rodar: (c: ContextoTarefa) => Promise<ResultadoTarefa>
}
