// E19: a entrada e a consulta do script scripts/e19-janela.ts, aqui para estarem sob o typecheck do web e sob teste.
import type { DiaLido } from './leitura-janela'

export class EntradaInvalida extends Error {}

const numero = (v: unknown, campo: string): number => {
  const n = Number(v ?? 0)
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
    }
  })
}

/**
 * Só select. Dia de São Paulo = UTC-3 fixo (sem horário de verão desde 2019); por isso o corte é `T03:00:00Z`.
 * LIMITE CONHECIDO: `youtube_intelligence_tasks` não tem coluna de worker/chave/origem (id, status, trigger_type,
 * requested_by, completed_at, ...), então "tarefa da forja" é aproximação: toda tarefa com status 'completed' no dia,
 * inclusive uma concluída pelo Cowork pelo caminho legado com `write`.
 */
export function consultaDaJanela(desde: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) throw new EntradaInvalida('desde deve ser AAAA-MM-DD')
  return `with l as (select (created_at at time zone 'America/Sao_Paulo')::date as dia_sp, count(*) filter (where action = 'pipeline_leitura_aviso' and after_data->>'tem_read' = 'true') as controle, count(*) filter (where action = 'pipeline_leitura_aviso' and after_data->>'tem_read' = 'false') as sem_read, count(*) as linhas from audit_log where action in ('pipeline_leitura_aviso','pipeline_leitura_recusada') group by 1), t as (select (completed_at at time zone 'America/Sao_Paulo')::date as dia_sp, count(*) as tarefas_forja from youtube_intelligence_tasks where status = 'completed' and completed_at >= '${desde}T03:00:00Z' group by 1) select coalesce(l.dia_sp, t.dia_sp) as dia_sp, coalesce(l.controle, 0) as controle, coalesce(l.sem_read, 0) as sem_read, coalesce(l.linhas, 0) as linhas, coalesce(t.tarefas_forja, 0) as tarefas_forja from l full join t using (dia_sp) order by 1`
}
