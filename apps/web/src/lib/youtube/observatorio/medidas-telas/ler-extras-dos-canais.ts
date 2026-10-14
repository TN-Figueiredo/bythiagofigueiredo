import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CausaNaoLida, Parte } from '../medidas/ler'

// A5 E5a, Tarefa 2: os três campos do canal que as telas pedem além de M3a e M8. Nunca lança: o que não foi lido vira
// `{ lido: false, causa }`, nunca mapa vazio. Sempre com o filtro de site.
export interface ExtrasDoCanal { missingSince: string | null; subscribersHidden: boolean | null; lastOkSyncedAt: string | null }

const PAGINA = 1000
const MAX_PAGINAS = 50
const SCHEMA_AUSENTE = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])
type Obj = Record<string, unknown>
const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const txt = (v: unknown): string | null => (typeof v === 'string' ? v : null)

export async function lerExtrasDosCanais(sb: SupabaseClient, o: { siteId: string; maxPaginas?: number }): Promise<Parte<Map<string, ExtrasDoCanal>>> {
  const out = new Map<string, ExtrasDoCanal>()
  const naoLido = (causa: CausaNaoLida): Parte<Map<string, ExtrasDoCanal>> => ({ lido: false, causa })
  try {
    for (let p = 0; p < (o.maxPaginas ?? MAX_PAGINAS); p++) {
      const r = await sb.from('competitor_channels').select('id, missing_since, subscribers_hidden, last_ok_synced_at')
        .eq('site_id', o.siteId).order('id').range(p * PAGINA, p * PAGINA + PAGINA - 1)
      if (r.error !== null && r.error !== undefined) {
        const code: unknown = ehObj(r.error) ? r.error.code : undefined
        return naoLido(typeof code === 'string' && SCHEMA_AUSENTE.has(code) ? 'schema_ausente' : 'erro_do_banco')
      }
      if (!Array.isArray(r.data)) return naoLido('erro_do_banco')
      for (const x of r.data) {
        if (!ehObj(x) || typeof x.id !== 'string') continue
        out.set(x.id, { missingSince: txt(x.missing_since), subscribersHidden: typeof x.subscribers_hidden === 'boolean' ? x.subscribers_hidden : null, lastOkSyncedAt: txt(x.last_ok_synced_at) })
      }
      if (r.data.length < PAGINA) return { lido: true, dados: out }
    }
    return naoLido('cortado')
  } catch {
    return naoLido('erro_do_banco')
  }
}
