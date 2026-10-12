// Observatório A5 (E1 e E2): a guarda de schema e (Tarefa 12) a prova embutida da coleta.
import type { SupabaseClient } from '@supabase/supabase-js'

const E1: Array<[string, string]> = [
  ['competitor_videos', 'miss_streak, miss_first_at, missing_since, last_seen_at, views_hidden, discovered_at'],
  ['competitor_channels', 'miss_streak, last_seen_at, custom_url'],
  ['competitor_field_versions', 'id'],
  ['competitor_raw', 'id'],
]
const E2: Array<[string, string]> = [
  ['competitor_videos', 'series_tier, series_tier_since, daily_until'],
  ['competitor_channels', 'weekly_pass_date'], // (emenda do portão: D-I3)
  ['competitor_video_tier_spans', 'video_id'],
  ['competitor_video_early', 'video_id'],
]
const NOT_CHECKED = (table: string, why: string): string => 'não foi possível conferir o schema (' + table + '): ' + why + '. Nada foi gravado.'
/**
 * O código da E1 e da E2 grava colunas e tabelas novas. Sem a migration, parte dessas gravações falharia sem ninguém
 * ver; por isso o cron pergunta antes e para em vermelho. null = pronto.
 *
 * A pergunta que pesa é "o que acontece quando a PRÓPRIA guarda não consegue ler?": consulta que lança, resultado nulo,
 * sem a lista de linhas, ou erro sem ser de coluna/tabela ausente. Nada disso é "pronto": o texto diz que não deu para conferir.
 */
export async function schemaReady(sb: SupabaseClient, need: 'e1' | 'e1e2'): Promise<string | null> {
  for (const [name, list] of [['MG1', E1], ...(need === 'e1e2' ? [['MG2', E2]] : [])] as Array<[string, Array<[string, string]>]>) {
    for (const [table, cols] of list) {
      let res: { data?: unknown; error?: { message?: string; code?: string } | null } | null | undefined
      try {
        res = await sb.from(table).select(cols).limit(1)
      } catch (e) {
        return NOT_CHECKED(table, e instanceof Error ? e.message : 'a consulta falhou')
      }
      if (typeof res !== 'object' || res === null) return NOT_CHECKED(table, 'o banco não respondeu')
      const { data, error } = res
      if (error) {
        // (emenda do portão: S-M4) só "coluna ou tabela que não existe" é migration ausente: 42703 e 42P01 (Postgres),
        // PGRST204 e PGRST205 (o PostgREST não acha a coluna ou a tabela). Rede ou banco fora têm outra frase.
        const code = error.code ?? ''
        if (['42703', '42P01', 'PGRST204', 'PGRST205'].includes(code)) return 'migration ' + name + ' não aplicada (' + table + '): ' + (error.message ?? code) + '. Nada foi gravado.'
        return NOT_CHECKED(table, error.message ?? 'erro do banco')
      }
      // um select que deu certo devolve a lista (vazia ou não): qualquer outra forma é leitura que não dá para confiar
      if (!Array.isArray(data)) return NOT_CHECKED(table, 'resposta fora da forma esperada')
    }
  }
  return null
}
