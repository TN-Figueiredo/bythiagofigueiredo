// A poda do acesso externo da IA (plano, 4.9 e Tarefa 13a): apaga do registro (`obs_ai_access_log`) o que passou de 400 dias e do contador
// (`obs_ai_rate`) o que passou de 2 dias. Esta metade (13a) NÃO registra nada na agenda e não tem efeito até alguém chamar a função: a tarefa
// `poda_acesso_ia` (13b) só nasce depois de a MG11 estar em produção.
//
// SEM filtro de `site_id`, de propósito: a guarda é do banco inteiro (a tarefa roda uma vez para todos os sites), e vale para as duas origens
// (`botao` e `mcp`) do registro.
//
// Apaga por FATIA, para o atraso sempre diminuir: um `delete` único de tudo o que passou do corte, com 2,5 s de prazo, não converge se a tarefa
// ficar desligada por semanas. Cada execução faz quatro idas (ler a linha mais antiga e o total; apagar; o mesmo no contador): o limite do
// apagamento é o MENOR entre o corte e "a linha mais antiga mais a fatia" (30 dias nas duas tabelas). Em dia normal a fatia cobre tudo o que venceu.
// Com atraso, cada execução recupera até 30 dias e devolve `atraso_restante` até a fatia alcançar o corte.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ACESSO_IA_RULES } from './regras'

export interface ResultadoDaPoda { registroTotal: number; registroApagadas: number; taxaTotal: number; taxaApagadas: number }

export type MotivoDaPoda = 'schema_ausente' | 'banco_falhou' | 'contagem_ausente' | 'sem_tempo_para_terminar' | 'atraso_restante'

export type FeitoDaPoda = Partial<ResultadoDaPoda> & {
  /**
   * `atraso_restante`: LIMITE INFERIOR (ISO), não a data de uma linha. Tudo o que era mais antigo que este instante já saiu; dele em diante
   * ainda PODE haver linha vencida (pode não haver: se só sobraram linhas recentes, a execução seguinte devolve `ok`).
   */
  limpoAte?: string
}

export type ResultadoDaExecucao = { ok: true; r: ResultadoDaPoda } | { ok: false; motivo: MotivoDaPoda; feito: FeitoDaPoda }

const DIA_MS = 86_400_000
const SCHEMA_AUSENTE: ReadonlySet<string> = new Set(['42P01', 'PGRST205'])
const ESTOUROU = Symbol('estourou')

/** Corrida contra o próprio sinal de `AbortSignal.timeout`: não espera além do prazo mesmo que a chamada ignore o sinal. */
async function comPrazo<T>(prazoMs: number, fazer: (sinal: AbortSignal) => PromiseLike<T>): Promise<{ ok: true; valor: T } | { ok: false }> {
  const sinal = AbortSignal.timeout(prazoMs)
  const estouro = new Promise<typeof ESTOUROU>((resolve) => {
    if (sinal.aborted) resolve(ESTOUROU)
    else sinal.addEventListener('abort', () => resolve(ESTOUROU), { once: true })
  })
  try {
    const r = await Promise.race([Promise.resolve(fazer(sinal)), estouro])
    return r === ESTOUROU ? { ok: false } : { ok: true, valor: r }
  } catch {
    return { ok: false }
  }
}

type Resp = { data?: unknown; count?: unknown; error?: { code?: unknown } | null }

type Parte =
  | { estado: 'ok'; total: number; apagadas: number; restanteDesde?: string }
  | { estado: 'erro'; motivo: 'schema_ausente' | 'banco_falhou' | 'contagem_ausente'; total?: number }
  | { estado: 'sem_tempo'; total?: number }

const motivoDoErro = (e: { code?: unknown }): 'schema_ausente' | 'banco_falhou' =>
  typeof e.code === 'string' && SCHEMA_AUSENTE.has(e.code) ? 'schema_ausente' : 'banco_falhou'

const contagemValida = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0

async function podarTabela(
  sb: SupabaseClient,
  tabela: string,
  coluna: string,
  guardaDias: number,
  fatiaDias: number,
  agora: number,
  sobraMs: () => number,
): Promise<Parte> {
  const { prazoPorIdaDaPodaMs: prazo, folgaMs } = ACESSO_IA_RULES

  // ida 1: a linha mais antiga e o total (contagem exata)
  if (sobraMs() < folgaMs) return { estado: 'sem_tempo' }
  const leitura = await comPrazo<Resp>(prazo, (sinal) => sb.from(tabela).select(coluna, { count: 'exact' }).order(coluna, { ascending: true }).limit(1).abortSignal(sinal))
  if (!leitura.ok) return { estado: 'erro', motivo: 'banco_falhou' }
  const l = (leitura.valor ?? {}) as Resp
  if (l.error) return { estado: 'erro', motivo: motivoDoErro(l.error) }
  if (!contagemValida(l.count)) return { estado: 'erro', motivo: 'contagem_ausente' }
  const total = l.count
  if (total === 0) return { estado: 'ok', total: 0, apagadas: 0 }

  // o total é maior que zero: sem a linha mais antiga os dois números se contradizem, e não se apaga sem saber o começo da fatia
  const primeira = Array.isArray(l.data) ? (l.data[0] as Record<string, unknown> | undefined) : undefined
  const maisAntiga = typeof primeira?.[coluna] === 'string' ? Date.parse(primeira[coluna] as string) : Number.NaN
  if (!Number.isFinite(maisAntiga)) return { estado: 'erro', motivo: 'contagem_ausente', total }

  const corte = agora - guardaDias * DIA_MS
  if (maisAntiga >= corte) return { estado: 'ok', total, apagadas: 0 } // nada vencido (a linha exatamente no corte fica)
  const limite = Math.min(corte, maisAntiga + fatiaDias * DIA_MS)

  // ida 2: apagar a fatia
  if (sobraMs() < folgaMs) return { estado: 'sem_tempo', total }
  const apagar = await comPrazo<Resp>(prazo, (sinal) => sb.from(tabela).delete({ count: 'exact' }).lt(coluna, new Date(limite).toISOString()).abortSignal(sinal))
  if (!apagar.ok) return { estado: 'erro', motivo: 'banco_falhou', total }
  const a = (apagar.valor ?? {}) as Resp
  if (a.error) return { estado: 'erro', motivo: motivoDoErro(a.error), total }
  if (!contagemValida(a.count)) return { estado: 'erro', motivo: 'contagem_ausente', total }
  const apagadas = a.count
  // a fatia não alcançou o corte e ainda sobrou linha: pode haver vencida a partir do limite
  const restante = limite < corte && apagadas < total
  return restante ? { estado: 'ok', total, apagadas, restanteDesde: new Date(limite).toISOString() } : { estado: 'ok', total, apagadas }
}

/**
 * Nunca lança. `sobraMs` diz quanto tempo resta à tarefa; antes de cada uma das quatro idas ela confere que sobram ao menos `folgaMs` (3 s),
 * senão pára com `sem_tempo_para_terminar` e o resto fica para o dia seguinte (a poda é idempotente, o corte é por data).
 */
export async function podarAcessoIa(sb: SupabaseClient, agora: number, sobraMs: () => number): Promise<ResultadoDaExecucao> {
  const r = ACESSO_IA_RULES
  const feito: FeitoDaPoda = {}

  const reg = await podarTabela(sb, 'obs_ai_access_log', 'at', r.guardaDoRegistroDias, r.fatiaDaPodaDoRegistroDias, agora, sobraMs)
  if (reg.total !== undefined) feito.registroTotal = reg.total
  if (reg.estado === 'ok') feito.registroApagadas = reg.apagadas
  if (reg.estado === 'erro') return { ok: false, motivo: reg.motivo, feito }
  if (reg.estado === 'sem_tempo') return { ok: false, motivo: 'sem_tempo_para_terminar', feito }

  const taxa = await podarTabela(sb, 'obs_ai_rate', 'bucket', r.guardaDoContadorDias, r.fatiaDaPodaDoContadorDias, agora, sobraMs)
  if (taxa.total !== undefined) feito.taxaTotal = taxa.total
  if (taxa.estado === 'ok') feito.taxaApagadas = taxa.apagadas
  if (taxa.estado === 'erro') return { ok: false, motivo: taxa.motivo, feito }
  if (taxa.estado === 'sem_tempo') return { ok: false, motivo: 'sem_tempo_para_terminar', feito }

  const desde = [reg.restanteDesde, taxa.restanteDesde].filter((x): x is string => x !== undefined).sort()[0]
  if (desde !== undefined) return { ok: false, motivo: 'atraso_restante', feito: { ...feito, limpoAte: desde } }

  return { ok: true, r: { registroTotal: reg.total, registroApagadas: reg.apagadas, taxaTotal: taxa.total, taxaApagadas: taxa.apagadas } }
}
