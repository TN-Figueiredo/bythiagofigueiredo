import type { SupabaseClient } from '@supabase/supabase-js'
import { CODIGOS_SCHEMA_AUSENTE } from '@/lib/youtube/coleta/schema'
import { CODIGO_RE } from './motivos'
import { ARRENDAMENTO_TTL_S, BANCO_MS, RODANDO_VENCE_MIN } from './relogio'
import type { EstadoAgenda, Lido, LinhaTarefa } from './tipos'

/**
 * O estado da agenda no banco (MG10): uma função por RPC. Regras:
 * - toda ida ao banco leva `AbortSignal.timeout(BANCO_MS)`;
 * - nenhuma leitura falha em silêncio como valor: o que não foi lido volta `{ porque }`;
 * - o `porque` é frase fixa em português mais, no máximo, o CÓDIGO do erro; o texto do erro do banco nunca sai daqui.
 */

const NOME_DO_ARRENDAMENTO = 'despachante'
const TETO_MAX = 32_767 // smallint do banco

const P_NAO_RESPONDEU = 'o banco não respondeu'
const P_FORMA = 'resposta fora da forma esperada'
const P_TETO = 'teto de tentativas inválido (precisa ser inteiro positivo)'
const P_FECHO = 'contadores do fecho fora da forma esperada'
const CODIGO_DO_BANCO_RE = /^[0-9A-Z]{5,8}$/

type Objeto = Record<string, unknown>
const ehObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v)
const tem = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k)

function porqueDoErro(erro: { code?: unknown } | null | undefined): string {
  const codigo = erro && typeof erro.code === 'string' ? erro.code : ''
  // Prazo estourado: o cliente não lança, devolve `AbortError` com código vazio. Tratado como "não respondeu".
  if (!CODIGO_DO_BANCO_RE.test(codigo)) return P_NAO_RESPONDEU
  if (CODIGOS_SCHEMA_AUSENTE.includes(codigo)) return `migration da agenda não aplicada (código ${codigo})`
  return `erro do banco (código ${codigo})`
}

/** Uma ida a uma função do banco: o dado cru, ou o porquê. Nunca lança. */
async function chamar(sb: SupabaseClient, fn: string, args: Objeto): Promise<Lido<unknown>> {
  try {
    const { data, error } = await sb.rpc(fn, args).abortSignal(AbortSignal.timeout(BANCO_MS))
    if (error) return { porque: porqueDoErro(error) }
    const cru: unknown = data
    if (cru === null || cru === undefined) return { porque: P_NAO_RESPONDEU }
    return { valor: cru }
  } catch {
    return { porque: P_NAO_RESPONDEU }
  }
}

async function chamarBooleano(sb: SupabaseClient, fn: string, args: Objeto): Promise<Lido<boolean>> {
  const r = await chamar(sb, fn, args)
  if ('porque' in r) return r
  return typeof r.valor === 'boolean' ? { valor: r.valor } : { porque: P_FORMA }
}

const tetoValido = (teto: unknown): teto is number => typeof teto === 'number' && Number.isInteger(teto) && teto > 0 && teto <= TETO_MAX
const inteiro = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

// ---- leitura do estado -----------------------------------------------------------------------------------------

const STATUS = ['rodando', 'ok', 'parcial', 'adiada', 'erro', 'esgotada'] as const
type Status = (typeof STATUS)[number]
const ehStatus = (v: unknown): v is Status => typeof v === 'string' && (STATUS as readonly string[]).includes(v)

const textoOuNulo = (v: unknown): string | null | undefined => (v === null ? null : typeof v === 'string' ? v : undefined)
const inteiroOuNulo = (v: unknown): number | null | undefined => (v === null ? null : inteiro(v) ? v : undefined)
const instanteOuNulo = (v: unknown): string | null | undefined => {
  if (v === null) return null
  return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : undefined
}

function lerLinha(bruta: unknown, par: { task: string; period_key: string }): LinhaTarefa | null {
  if (!ehObjeto(bruta)) return null
  const chaves = [
    'task', 'period_key', 'status', 'attempts', 'runs', 'unfinished_n', 'started_at', 'finished_at', 'done_n', 'left_n',
    'reason', 'last_ok_at', 'last_run_status', 'last_run_done_n',
  ]
  if (!chaves.every(k => tem(bruta, k))) return null
  if (bruta.task !== par.task || bruta.period_key !== par.period_key) return null
  const status = bruta.status === null ? null : ehStatus(bruta.status) ? bruta.status : undefined
  const attempts = inteiroOuNulo(bruta.attempts)
  const runs = inteiroOuNulo(bruta.runs)
  const unfinished = inteiroOuNulo(bruta.unfinished_n)
  const startedAt = instanteOuNulo(bruta.started_at)
  const finishedAt = instanteOuNulo(bruta.finished_at)
  const doneN = inteiroOuNulo(bruta.done_n)
  const leftN = inteiroOuNulo(bruta.left_n)
  const reason = textoOuNulo(bruta.reason)
  const lastOkAt = instanteOuNulo(bruta.last_ok_at)
  const lastRunStatus = textoOuNulo(bruta.last_run_status)
  const lastRunDoneN = inteiroOuNulo(bruta.last_run_done_n)
  if (
    status === undefined || attempts === undefined || runs === undefined || unfinished === undefined ||
    startedAt === undefined || finishedAt === undefined || doneN === undefined || leftN === undefined ||
    reason === undefined || lastOkAt === undefined || lastRunStatus === undefined || lastRunDoneN === undefined
  ) return null
  return {
    task: par.task, period_key: par.period_key, status, attempts, runs, unfinished_n: unfinished,
    started_at: startedAt, finished_at: finishedAt, done_n: doneN, left_n: leftN, reason,
    last_ok_at: lastOkAt, last_run_status: lastRunStatus, last_run_done_n: lastRunDoneN,
  }
}

/** Uma entrada por par pedido, na ordem. Qualquer outra forma é "não li". */
export async function lerEstado(sb: SupabaseClient, pares: Array<{ task: string; period_key: string }>): Promise<Lido<EstadoAgenda>> {
  const r = await chamar(sb, 'competitor_agenda_state', {
    p_tasks: pares.map(p => p.task),
    p_period_keys: pares.map(p => p.period_key),
  })
  if ('porque' in r) return r
  const d = r.valor
  if (!ehObjeto(d) || !tem(d, 'agora') || !tem(d, 'desde') || !tem(d, 'tarefas')) return { porque: P_FORMA }
  const agora = d.agora
  if (typeof agora !== 'string' || Number.isNaN(Date.parse(agora))) return { porque: P_FORMA }
  const desde = instanteOuNulo(d.desde)
  if (desde === undefined) return { porque: P_FORMA }
  if (!Array.isArray(d.tarefas) || d.tarefas.length !== pares.length) return { porque: P_FORMA }
  const tarefas: LinhaTarefa[] = []
  for (const [i, par] of pares.entries()) {
    const linha = lerLinha(d.tarefas[i], par)
    if (!linha) return { porque: P_FORMA }
    tarefas.push(linha)
  }
  return { valor: { agora, desde, tarefas } }
}

// ---- arrendamento ----------------------------------------------------------------------------------------------

export function tomarArrendamento(sb: SupabaseClient, holder: string): Promise<Lido<boolean>> {
  return chamarBooleano(sb, 'competitor_agenda_lease_take', {
    p_name: NOME_DO_ARRENDAMENTO, p_holder: holder, p_ttl: `${ARRENDAMENTO_TTL_S} seconds`,
  })
}

/** Solta só o arrendamento de quem o tem. Nunca lança; a falha ao soltar é coberta pela validade do arrendamento. */
export async function soltarArrendamento(sb: SupabaseClient, holder: string): Promise<void> {
  await chamar(sb, 'competitor_agenda_lease_release', { p_name: NOME_DO_ARRENDAMENTO, p_holder: holder })
}

// ---- a execução de uma tarefa ----------------------------------------------------------------------------------

const VALIDADE_DA_LINHA = `${RODANDO_VENCE_MIN} minutes`

export function tomar(sb: SupabaseClient, t: { task: string; period_key: string; teto: number; reabrir: boolean }): Promise<Lido<boolean>> {
  if (!tetoValido(t.teto)) return Promise.resolve({ porque: P_TETO })
  return chamarBooleano(sb, 'competitor_agenda_claim', {
    p_task: t.task, p_period_key: t.period_key, p_max_attempts: t.teto, p_stale: VALIDADE_DA_LINHA, p_reopen: t.reabrir === true,
  })
}

export function esgotar(sb: SupabaseClient, t: { task: string; period_key: string; teto: number }): Promise<Lido<boolean>> {
  if (!tetoValido(t.teto)) return Promise.resolve({ porque: P_TETO })
  return chamarBooleano(sb, 'competitor_agenda_exhaust', {
    p_task: t.task, p_period_key: t.period_key, p_max_attempts: t.teto, p_stale: VALIDADE_DA_LINHA,
  })
}

/** Só número finito passa; o resto é descartado chave a chave. */
function soNumeros(d: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(d)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  return out
}

export function fechar(
  sb: SupabaseClient,
  t: {
    task: string; period_key: string; estado: 'ok' | 'parcial' | 'erro'; feitas: number; deixadas: number | null
    motivo?: string; ms: number; detalhe?: Record<string, number>
  },
): Promise<Lido<boolean>> {
  const estadoOk = t.estado === 'ok' || t.estado === 'parcial' || t.estado === 'erro'
  const deixadasOk = t.deixadas === null || (inteiro(t.deixadas) && t.deixadas >= 0)
  const msOk = typeof t.ms === 'number' && Number.isFinite(t.ms) && t.ms >= 0
  if (!estadoOk || !inteiro(t.feitas) || t.feitas < 0 || !deixadasOk || !msOk) return Promise.resolve({ porque: P_FECHO })
  // Duas barreiras (a outra é o banco): só código passa; texto livre vira 'motivo_invalido'.
  const motivo = t.motivo === undefined ? null : CODIGO_RE.test(t.motivo) ? t.motivo : 'motivo_invalido'
  return chamarBooleano(sb, 'competitor_agenda_finish', {
    p_task: t.task, p_period_key: t.period_key, p_status: t.estado, p_done_n: t.feitas, p_left_n: t.deixadas,
    p_reason: motivo, p_duration_ms: Math.round(t.ms), p_detail: t.detalhe === undefined ? null : soNumeros(t.detalhe),
  })
}

/** A tarefa devida que nem começou neste disparo. Nunca lança. */
export async function adiar(sb: SupabaseClient, t: { task: string; period_key: string; motivo: 'sem_tempo' | 'uma_pesada_por_disparo' }): Promise<void> {
  await chamar(sb, 'competitor_agenda_defer', { p_task: t.task, p_period_key: t.period_key, p_reason: t.motivo })
}
