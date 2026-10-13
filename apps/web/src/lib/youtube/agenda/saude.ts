import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFINICOES, agendaLigada, tarefasDesligadas } from './catalogo'
import { lerEstado } from './estado'
import { chaveDoPeriodo } from './periodo'
import { BANCO_MS, comPrazo } from './relogio'
import type { EstadoAgenda, Lido, Tarefa } from './tipos'

/**
 * O vigia (relatório de saúde dos crons) enxerga cada tarefa da agenda. Esta é a SEGUNDA fonte do relatório:
 * a primeira é `cron_health` (uma chave por cron, nunca por tarefa: OP-5). Aqui nada grava; só lê e avalia.
 *
 * Todo texto que sai daqui é frase fixa do código. Nenhum texto do banco, nenhum código de erro do banco, nenhum id.
 */
export interface ItemAgenda {
  nome: string
  status: 'ok' | 'late' | 'unknown' | 'desligada'
  ultimoOk: string | null
  toleranciaH: number
  motivo?: string
}

type DaTarefa = Pick<Tarefa, 'nome' | 'toleranciaVigiaH' | 'nuncaDesliga'>

const HORA_MS = 3_600_000
export const MOTIVO_AGENDA_OFF = 'agenda off'
export const MOTIVO_TAREFA_OFF = 'tarefa desligada (OBS_AGENDA_TASKS_OFF)'
export const MOTIVO_NAO_LIDO = 'não foi possível ler a agenda'
export const MOTIVO_SCHEMA_AUSENTE = 'não conferida (schema ausente)'
export const MOTIVO_SEM_LEITURA = 'sem leitura'
export const NOTA_SEM_RESPOSTA = 'agenda não conferida: o banco não respondeu'

// As duas frases que `estado.ts` devolve e que mudam a decisão. O teste de `saude.test.ts` fixa o acoplamento.
const PREFIXO_SCHEMA_AUSENTE = 'migration da agenda não aplicada'
const PORQUE_SEM_RESPOSTA = 'o banco não respondeu'

const instante = (s: string | null): number | null => {
  if (s === null) return null
  const ms = Date.parse(s)
  return Number.isNaN(ms) ? null : ms
}

/**
 * Uma entrada por tarefa DO CATÁLOGO (o laço percorre o catálogo, nunca uma lista escrita à mão).
 * Ordem das regras: desligada (agenda off, ou a tarefa em OBS_AGENDA_TASKS_OFF) → estado não lido
 * (schema ausente = não conferida; qualquer outro = late) → ok dentro da tolerância → late além dela →
 * sem nenhum ok: late se a agenda já existe há mais que a tolerância, senão unknown ("sem leitura").
 */
export function avaliarAgenda(e: Lido<EstadoAgenda>, catalogo: readonly DaTarefa[], agoraMs: number, env: NodeJS.ProcessEnv): ItemAgenda[] {
  const ligada = agendaLigada(env)
  const { desligadas } = tarefasDesligadas(env, catalogo)
  const linhas = 'valor' in e ? new Map(e.valor.tarefas.map(l => [l.task, l])) : null
  const desde = 'valor' in e ? instante(e.valor.desde) : null

  return catalogo.map((t): ItemAgenda => {
    const base = { nome: t.nome, toleranciaH: t.toleranciaVigiaH }
    const ultimoOk = linhas?.get(t.nome)?.last_ok_at ?? null

    if (!ligada && !t.nuncaDesliga) return { ...base, status: 'desligada', ultimoOk, motivo: MOTIVO_AGENDA_OFF }
    if (desligadas.has(t.nome)) return { ...base, status: 'desligada', ultimoOk, motivo: MOTIVO_TAREFA_OFF }

    if (!linhas) {
      const porque = 'porque' in e ? e.porque : ''
      if (porque.startsWith(PREFIXO_SCHEMA_AUSENTE)) return { ...base, status: 'unknown', ultimoOk: null, motivo: MOTIVO_SCHEMA_AUSENTE }
      return { ...base, status: 'late', ultimoOk: null, motivo: MOTIVO_NAO_LIDO }
    }

    const toleranciaMs = t.toleranciaVigiaH * HORA_MS
    const okMs = instante(ultimoOk)
    if (okMs !== null) {
      return { ...base, status: agoraMs - okMs <= toleranciaMs ? 'ok' : 'late', ultimoOk }
    }
    if (desde !== null && agoraMs - desde > toleranciaMs) {
      return { ...base, status: 'late', ultimoOk: null, motivo: MOTIVO_SEM_LEITURA }
    }
    return { ...base, status: 'unknown', ultimoOk: null, motivo: MOTIVO_SEM_LEITURA }
  })
}

/** "Desligada" é fato de configuração, não do banco: sem resposta do banco, só ela continua no relatório. */
const soDesligadas = (e: Lido<EstadoAgenda>, catalogo: readonly DaTarefa[], agoraMs: number, env: NodeJS.ProcessEnv): ItemAgenda[] =>
  avaliarAgenda(e, catalogo, agoraMs, env).filter(i => i.status === 'desligada')

/**
 * A leitura do estado e a avaliação, para as duas rotas. NUNCA lança e nunca passa de `BANCO_MS + 1 s`.
 * - estado lido, ou ilegível por motivo do banco (permissão, forma): `avaliarAgenda` (ilegível = late, visível);
 * - schema da agenda ausente (a migration ainda não foi aplicada): as tarefas saem "não conferida", sem alarme;
 * - o banco não respondeu (prazo, transporte, exceção): `itens` vazio e uma `nota` visível. Sem resposta é AUSÊNCIA de
 *   informação, não evidência de falha (a mesma regra de `unknown` em cron-health-report); o resto do relatório sai inteiro.
 */
export async function lerAgendaDoVigia(
  sb: SupabaseClient,
  agoraMs: number,
  env: NodeJS.ProcessEnv,
  catalogo: readonly Pick<Tarefa, 'nome' | 'periodo' | 'toleranciaVigiaH' | 'nuncaDesliga'>[] = DEFINICOES,
): Promise<{ itens: ItemAgenda[]; nota: string | null }> {
  try {
    const pares = catalogo.map(t => ({ task: t.nome, period_key: chaveDoPeriodo(t.periodo, agoraMs) }))
    const r = await comPrazo(lerEstado(sb, pares), BANCO_MS + 1_000)
    const estado: Lido<EstadoAgenda> = 'estourou' in r ? { porque: PORQUE_SEM_RESPOSTA } : r.valor
    if ('porque' in estado && estado.porque === PORQUE_SEM_RESPOSTA) return { itens: soDesligadas(estado, catalogo, agoraMs, env), nota: NOTA_SEM_RESPOSTA }
    return { itens: avaliarAgenda(estado, catalogo, agoraMs, env), nota: null }
  } catch {
    return { itens: [], nota: NOTA_SEM_RESPOSTA }
  }
}
