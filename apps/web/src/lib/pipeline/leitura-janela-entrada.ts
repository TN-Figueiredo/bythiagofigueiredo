// E19: a entrada e a consulta do script scripts/e19-janela.ts, aqui para estarem sob o typecheck do web e sob teste.
import type { DiaLido } from './leitura-janela'

export class EntradaInvalida extends Error {}

// (onda 3, E) Coluna ausente NÃO é zero: ausência virava "nenhuma leitura sem read" e a recusa podia subir por omissão.
const numero = (v: unknown, campo: string): number => {
  if (v === undefined || v === null) throw new EntradaInvalida(`a coluna "${campo}" não veio na consulta (consulta antiga ou editada à mão?)`)
  const n = Number(v)
  if (!Number.isFinite(n)) throw new EntradaInvalida(`o campo "${campo}" não é número`)
  return n
}

/**
 * Lê a saída de `supabase db query` (texto antes/depois do JSON é tolerado) e devolve as linhas por dia.
 * Entrada malformada (array solto, tabela do modo humano, `rows: [null]`) lança EntradaInvalida: nunca vira "dia limpo".
 * `dia_sp` aceita "2026-10-13" e "2026-10-13T00:00:00Z" (o banco local devolve a segunda forma).
 */
export function lerEntradaDaJanela(entrada: string): DiaLido[] {
  const ini = entrada.indexOf('{')
  const fim = entrada.lastIndexOf('}')
  if (ini < 0 || fim < ini) throw new EntradaInvalida('a entrada não tem o JSON da consulta (use o modo agente: --agent=yes, sem -o)')
  let corpo: unknown
  try {
    corpo = JSON.parse(entrada.slice(ini, fim + 1))
  } catch {
    throw new EntradaInvalida('a entrada não é um JSON único {"rows":[...]} (array solto ou tabela do modo humano?)')
  }
  const rows = typeof corpo === 'object' && corpo !== null ? (corpo as { rows?: unknown }).rows : undefined
  if (!Array.isArray(rows)) throw new EntradaInvalida('a consulta não devolveu "rows"')
  return rows.map((r: unknown, i: number): DiaLido => {
    if (typeof r !== 'object' || r === null) throw new EntradaInvalida(`rows[${i}] não é um objeto`)
    const l = r as Record<string, unknown>
    const dia = typeof l.dia_sp === 'string' ? l.dia_sp.slice(0, 10) : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new EntradaInvalida(`rows[${i}].dia_sp não é uma data`)
    return {
      dia_sp: dia,
      controle: numero(l.controle, 'controle'),
      sem_read: numero(l.sem_read, 'sem_read'),
      linhas: numero(l.linhas, 'linhas'),
      tarefas_forja: numero(l.tarefas_forja, 'tarefas_forja'),
      perdidas: numero(l.perdidas, 'perdidas'),
    }
  })
}

/**
 * Só select. Dia de São Paulo = UTC-3 fixo (sem horário de verão desde 2019); por isso o corte é `T03:00:00Z`.
 *
 * "Tarefa da forja" (onda 3, C): tarefa `completed` no dia cujo `result_summary->>'closed_by'` (id da chave que a fechou,
 * gravado por services/youtube.ts e services/forja-queue.ts) é uma chave ATIVA SEM leitura (nem read, nem write, nem admin,
 * as três que `requirePermission(..., 'read')` aceita). Hoje isso é a chave `forja (fila)`, mas nenhum nome está escrito aqui.
 * Tarefa com `closed_by` nulo (as de maio, anteriores à fila) ou fechada por chave larga (Cowork) não conta.
 *
 * `perdidas` (onda 3, B): para cada linha de registro que declarou leituras perdidas (`after_data.perdidas`), cobre TODOS os dias
 * de São Paulo do instante `perdidas_desde` ao dia da linha (o buraco pode atravessar a meia-noite).
 */
export function consultaDaJanela(desde: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) throw new EntradaInvalida('desde deve ser AAAA-MM-DD')
  const acoes = "('pipeline_leitura_aviso','pipeline_leitura_recusada')"
  const sp = "'America/Sao_Paulo'"
  return [
    `with l as (select (created_at at time zone ${sp})::date as dia_sp, count(*) filter (where action = 'pipeline_leitura_aviso' and after_data->>'tem_read' = 'true') as controle, count(*) filter (where action = 'pipeline_leitura_aviso' and after_data->>'tem_read' = 'false') as sem_read, count(*) as linhas from audit_log where action in ${acoes} group by 1)`,
    `t as (select (y.completed_at at time zone ${sp})::date as dia_sp, count(*) as tarefas_forja from youtube_intelligence_tasks y join pipeline_api_keys k on k.id::text = y.result_summary->>'closed_by' where y.status = 'completed' and y.completed_at >= '${desde}T03:00:00Z' and k.revoked_at is null and not (k.permissions && array['read','write','admin']) group by 1)`,
    `p as (select d::date as dia_sp, sum(x.perdidas) as perdidas from (select (created_at at time zone ${sp})::date as fim, coalesce((after_data->>'perdidas_desde')::timestamptz at time zone ${sp}, created_at at time zone ${sp})::date as ini, (after_data->>'perdidas')::numeric as perdidas from audit_log where action in ${acoes} and coalesce((after_data->>'perdidas')::numeric, 0) > 0) x, generate_series(least(x.ini, x.fim)::timestamp, x.fim::timestamp, interval '1 day') d group by 1)`,
  ].join(', ') + ` select dia_sp, coalesce(l.controle, 0) as controle, coalesce(l.sem_read, 0) as sem_read, coalesce(l.linhas, 0) as linhas, coalesce(t.tarefas_forja, 0) as tarefas_forja, coalesce(p.perdidas, 0) as perdidas from l full join t using (dia_sp) full join p using (dia_sp) order by 1`
}
