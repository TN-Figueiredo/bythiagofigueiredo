import type { SupabaseClient } from '@supabase/supabase-js'
import { TODAS_AS_DEFINICOES, agendaLigada, tarefasDesligadas } from './definicoes'
import { lerEstado } from './estado'
import { chaveDoPeriodo } from './periodo'
import { BANCO_MS, comPrazo } from './relogio'
import type { EstadoAgenda, Lido, Tarefa } from './tipos'

/**
 * O vigia (relatório de saúde dos crons) enxerga cada tarefa da agenda. Esta é a SEGUNDA fonte do relatório:
 * a primeira é `cron_health` (uma chave por cron, nunca por tarefa: OP-5). Aqui nada grava; só lê e avalia.
 *
 * O padrão do vigia é a lista única de definições (`definicoes.ts`: as cinco tarefas, a anulação de identidade da LGPD inclusive). Este arquivo
 * NÃO importa `catalogo` (nem, por ele, a coleta de comentários ou a leitura horária): `/api/health` precisa só de nome, período e tolerância.
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
/** O item único que acusa a leitura que falhou: no relatório sai como `agenda:leitura`. */
export const NOME_DA_LEITURA = 'leitura'

const instante = (s: string | null): number | null => {
  if (s === null) return null
  const ms = Date.parse(s)
  return Number.isNaN(ms) ? null : ms
}

/**
 * Uma entrada por tarefa DO CATÁLOGO (o laço percorre o catálogo, nunca uma lista escrita à mão).
 * Ordem das regras: desligada (agenda off, ou a tarefa em OBS_AGENDA_TASKS_OFF) → estado não lido
 * (causa `schema_ausente` = tarefas "não conferida"; QUALQUER outra causa, ou nenhuma, = UMA entrada `leitura` late,
 * além das desligadas) → ok dentro da tolerância → late além dela → sem nenhum ok: late se a agenda já existe há mais
 * que a tolerância, senão unknown ("sem leitura"). A decisão usa `causa`, nunca o texto de `porque`.
 */
export function avaliarAgenda(e: Lido<EstadoAgenda>, catalogo: readonly DaTarefa[], agoraMs: number, env: NodeJS.ProcessEnv): ItemAgenda[] {
  const ligada = agendaLigada(env)
  const { desligadas } = tarefasDesligadas(env, catalogo)
  const linhas = 'valor' in e ? new Map(e.valor.tarefas.map(l => [l.task, l])) : null
  const desde = 'valor' in e ? instante(e.valor.desde) : null

  if (!linhas) {
    const causa = 'causa' in e ? e.causa : undefined
    const itens = catalogo.map((t): ItemAgenda => {
      const base = { nome: t.nome, toleranciaH: t.toleranciaVigiaH, ultimoOk: null }
      if (!ligada && !t.nuncaDesliga) return { ...base, status: 'desligada', motivo: MOTIVO_AGENDA_OFF }
      if (desligadas.has(t.nome)) return { ...base, status: 'desligada', motivo: MOTIVO_TAREFA_OFF }
      return { ...base, status: 'unknown', motivo: MOTIVO_SCHEMA_AUSENTE }
    })
    if (causa === 'schema_ausente') return itens
    // Qualquer outra causa: o vigia acusa. Só as desligadas (fato de configuração) ficam como estão; as demais viram UMA entrada.
    const desligadasItens = itens.filter(i => i.status === 'desligada')
    if (desligadasItens.length === itens.length) return desligadasItens
    return [...desligadasItens, { nome: NOME_DA_LEITURA, status: 'late', ultimoOk: null, toleranciaH: 0, motivo: MOTIVO_NAO_LIDO }]
  }

  return catalogo.map((t): ItemAgenda => {
    const base = { nome: t.nome, toleranciaH: t.toleranciaVigiaH }
    const ultimoOk = linhas.get(t.nome)?.last_ok_at ?? null

    if (!ligada && !t.nuncaDesliga) return { ...base, status: 'desligada', ultimoOk, motivo: MOTIVO_AGENDA_OFF }
    if (desligadas.has(t.nome)) return { ...base, status: 'desligada', ultimoOk, motivo: MOTIVO_TAREFA_OFF }

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

/**
 * A leitura do estado e a avaliação, para as duas rotas. NUNCA lança e nunca passa de `BANCO_MS + 1 s`.
 * - estado lido: `avaliarAgenda` por tarefa;
 * - schema da agenda ausente (a migration ainda não foi aplicada): as tarefas saem "não conferida", sem alarme;
 * - QUALQUER outra falha (prazo, transporte, exceção, resposta nula, erro do banco, forma inválida): UMA entrada
 *   `agenda:leitura` late, "não foi possível ler a agenda". O vigia acusa; a agenda nunca some do relatório.
 *   `nota` só acompanha a falta de resposta do banco (prazo, exceção), como detalhe, não como único sinal.
 */
export async function lerAgendaDoVigia(
  sb: SupabaseClient,
  agoraMs: number,
  env: NodeJS.ProcessEnv,
  catalogo: readonly Pick<Tarefa, 'nome' | 'periodo' | 'toleranciaVigiaH' | 'nuncaDesliga'>[] = TODAS_AS_DEFINICOES,
): Promise<{ itens: ItemAgenda[]; nota: string | null }> {
  try {
    const pares = catalogo.map(t => ({ task: t.nome, period_key: chaveDoPeriodo(t.periodo, agoraMs) }))
    const r = await comPrazo(lerEstado(sb, pares), BANCO_MS + 1_000)
    const estado: Lido<EstadoAgenda> = 'estourou' in r ? { porque: 'o banco não respondeu', causa: 'prazo' } : r.valor
    const causa = 'porque' in estado ? estado.causa : undefined
    const semResposta = causa === 'prazo' || causa === 'excecao'
    return { itens: avaliarAgenda(estado, catalogo, agoraMs, env), nota: semResposta ? NOTA_SEM_RESPOSTA : null }
  } catch {
    // Nada que possa lançar de novo: o item é escrito à mão.
    return { itens: [{ nome: NOME_DA_LEITURA, status: 'late', ultimoOk: null, toleranciaH: 0, motivo: MOTIVO_NAO_LIDO }], nota: NOTA_SEM_RESPOSTA }
  }
}
