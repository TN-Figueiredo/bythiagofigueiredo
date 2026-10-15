/**
 * A5 · E9, Tarefa 4: o número da aba. Uma ida ao banco (`competitor_missing_count`), cinco chaves somadas. Qualquer resposta que não seja o objeto
 * esperado devolve `null` (a aba mostra "?"), nunca zero. Recebe o cliente de serviço de quem já passou a guarda de edição.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

const CHAVES = ['videos', 'canais', 'grupos_de_comentarios', 'apagando', 'voltaram'] as const

export async function contarFila(sb: SupabaseClient, siteId: string): Promise<number | null> {
  try {
    const r = await sb.rpc('competitor_missing_count', { p_site: siteId })
    if (r.error) return null
    const d: unknown = r.data
    if (typeof d !== 'object' || d === null || Array.isArray(d)) return null
    let soma = 0
    for (const k of CHAVES) {
      const v = (d as Record<string, unknown>)[k]
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) return null
      soma += v
    }
    return soma
  } catch {
    return null
  }
}
