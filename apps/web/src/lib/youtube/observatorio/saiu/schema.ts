/**
 * A5 · E9, Tarefa 4: a guarda de schema. Só `null` é "pronto". Tabela ausente (`42P01`, `PGRST205`) diz que a migration não foi aplicada; qualquer outro
 * erro, resposta nula ou exceção diz que não foi possível conferir. Nunca devolve `null` por não saber.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const TEXTO_SCHEMA_AUSENTE = 'A migration desta etapa ainda não foi aplicada no banco.'
export const TEXTO_SCHEMA_NAO_CONFERIDO = 'Não foi possível conferir o schema desta etapa.'

export async function schemaE9(sb: SupabaseClient): Promise<string | null> {
  try {
    const r = await sb.from('competitor_missing_baseline').select('video_id').limit(0)
    if (r.error) return r.error.code === '42P01' || r.error.code === 'PGRST205' ? TEXTO_SCHEMA_AUSENTE : TEXTO_SCHEMA_NAO_CONFERIDO
    if (!Array.isArray(r.data)) return TEXTO_SCHEMA_NAO_CONFERIDO
    return null
  } catch {
    return TEXTO_SCHEMA_NAO_CONFERIDO
  }
}
