// A taxa do acesso externo da IA (plano, 4.5): 30 por minuto e 500 por dia, POR CHAVE, contados no banco (`obs_ai_rate_hit`, atômico,
// baldes em UTC). A taxa acontece em cada chamada da ferramenta, não na porta: `initialize`, `tools/list` e notificações não gastam limite.
// A chamada recusada por limite SOMA no contador (não há como saber antes de somar).
//
// Quando gravar a linha `limite` (um valor do contador sai uma vez só, então a regra fecha o teto de 17 linhas por dia por chave):
//   - pelo dia: uma vez por dia por chave, só quando `no_dia === 501`, seja qual for o minuto;
//   - pelo minuto: só quando `no_minuto === 31` e `no_dia <= 500`.
// O dia tem precedência sobre o minuto (uma decisão só por chamada).
import type { SupabaseClient } from '@supabase/supabase-js'
import { ACESSO_IA_RULES } from './regras'

export type DecisaoDeTaxa = { serve: true } | { serve: false; por: 'minuto' | 'dia'; voltaEm: string; registrar: boolean }

const MINUTO_MS = 60_000
const DIA_MS = 86_400_000

const inteiroPositivo = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1

/**
 * Pura. `agora` só decide a hora de volta: o minuto seguinte em UTC, ou 00:00 UTC do dia seguinte.
 * Falha FECHADA: contagem que não é inteiro >= 1 (NaN, Infinity, negativa, zero, fração, não número) ou `agora` ilegível não serve
 * (sem isso `NaN > 500` seria falso e a ferramenta serviria). Sem linha de registro: o dado é inválido, não um estouro de limite.
 */
export function decidirTaxa(noMinuto: number, noDia: number, agora: number): DecisaoDeTaxa {
  const { porMinuto, porDia } = ACESSO_IA_RULES
  if (!inteiroPositivo(noMinuto) || !inteiroPositivo(noDia) || !Number.isFinite(agora)) {
    const base = Number.isFinite(agora) ? agora : Date.now()
    return { serve: false, por: 'dia', voltaEm: new Date((Math.floor(base / DIA_MS) + 1) * DIA_MS).toISOString(), registrar: false }
  }
  if (noDia > porDia) {
    const voltaEm = new Date((Math.floor(agora / DIA_MS) + 1) * DIA_MS).toISOString()
    return { serve: false, por: 'dia', voltaEm, registrar: noDia === porDia + 1 }
  }
  if (noMinuto > porMinuto) {
    const voltaEm = new Date((Math.floor(agora / MINUTO_MS) + 1) * MINUTO_MS).toISOString()
    return { serve: false, por: 'minuto', voltaEm, registrar: noMinuto === porMinuto + 1 }
  }
  return { serve: true }
}

const ESTOUROU = Symbol('estourou')

/** Corrida contra o próprio sinal de `AbortSignal.timeout`: não espera além do prazo mesmo que a chamada ignore o sinal. */
async function comPrazo<T>(prazoMs: number, fazer: (sinal: AbortSignal) => PromiseLike<T>): Promise<{ ok: true; valor: T } | { ok: false; code: 'tempo' | 'excecao' }> {
  const sinal = AbortSignal.timeout(prazoMs)
  const estouro = new Promise<typeof ESTOUROU>((resolve) => {
    if (sinal.aborted) resolve(ESTOUROU)
    else sinal.addEventListener('abort', () => resolve(ESTOUROU), { once: true })
  })
  try {
    const r = await Promise.race([Promise.resolve(fazer(sinal)), estouro])
    return r === ESTOUROU ? { ok: false, code: 'tempo' } : { ok: true, valor: r }
  } catch {
    return { ok: false, code: 'excecao' }
  }
}

/**
 * `obs_ai_rate_hit(p_key, p_now)`: soma uma chamada e devolve `(no_minuto, no_dia)` já somados. Nunca lança.
 * Aceita uma linha ou uma lista com UMA linha; lista vazia, null, número em texto e número que não é inteiro positivo são
 * `forma_invalida`: sem número, a ferramenta não serve (erro "não foi possível conferir o limite de uso").
 */
export async function somarNaTaxa(
  sb: SupabaseClient,
  keyId: string,
  agora: number,
  opcoes?: { prazoMs?: number },
): Promise<{ ok: true; noMinuto: number; noDia: number } | { ok: false; code: string }> {
  // chave nula, vazia ou que nem é texto: recusada aqui, antes do banco (não depende de a restrição do SQL pegar)
  if (typeof keyId !== 'string' || keyId.trim() === '') return { ok: false, code: 'key_invalida' }
  const r = await comPrazo(opcoes?.prazoMs ?? ACESSO_IA_RULES.prazoPorIdaMs, (sinal) =>
    sb.rpc('obs_ai_rate_hit', { p_key: keyId, p_now: new Date(agora).toISOString() }).abortSignal(sinal),
  )
  if (!r.ok) return { ok: false, code: r.code }
  const { data, error } = (r.valor ?? {}) as { data?: unknown; error?: { code?: unknown } | null }
  if (error) return { ok: false, code: typeof error.code === 'string' && error.code !== '' ? error.code : 'desconhecido' }
  const linha = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data
  if (typeof linha !== 'object' || linha === null) return { ok: false, code: 'forma_invalida' }
  const { no_minuto: noMinuto, no_dia: noDia } = linha as { no_minuto?: unknown; no_dia?: unknown }
  if (!inteiroPositivo(noMinuto) || !inteiroPositivo(noDia)) return { ok: false, code: 'forma_invalida' }
  return { ok: true, noMinuto, noDia }
}
