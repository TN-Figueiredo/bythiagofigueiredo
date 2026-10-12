// Observatório A5 (E2): a guarda de schema das sincronizações de concorrentes que NÃO passam pelo cron (as ações do CMS).
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { schemaReady } from '@/lib/youtube/competitor-health'

/**
 * O sync lê e grava colunas e tabelas da MG1 e da MG2. Antes de sincronizar por uma ação do CMS, confere as duas migrations (o mesmo
 * modo do cron). Devolve o texto em português para mostrar a quem pediu, ou null quando está tudo pronto.
 * Só `null` é "pronto": a guarda que lança, ou responde com algo que não é texto nem nulo, é "não deu para conferir" e ninguém sincroniza.
 */
export async function syncSchemaBlock(): Promise<string | null> {
  try {
    const r: unknown = await schemaReady(getSupabaseServiceClient(), 'e1e2')
    if (r === null) return null
    if (typeof r === 'string' && r !== '') return r
    return 'não foi possível conferir o schema: a guarda não respondeu. Nada foi gravado.'
  } catch (e) {
    return 'não foi possível conferir o schema: ' + (e instanceof Error ? e.message : 'a consulta falhou') + '. Nada foi gravado.'
  }
}
