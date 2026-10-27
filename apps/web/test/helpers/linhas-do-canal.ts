import type { SupabaseClient } from '@supabase/supabase-js'
import { lerPaginaDoCanal } from '@/lib/youtube/teste-youtube/nativo/lista-borda'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import type { LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'

/** Página 0 do canal inteiro (filtro "todos"): extras fixadas + até 20 vídeos públicos. Substitui o antigo `lerLinhasDoCaminho`. */
export async function lerLinhasDoCaminho(sb: SupabaseClient, siteId: string, agora: Date, leitura: LeituraPrivadaDoSite | null): Promise<LinhaDoCaminho[]> {
  return (await lerPaginaDoCanal(sb, siteId, agora, leitura, { busca: null, filtro: 'todos', pagina: 0, incluirYtId: null })).linhas
}
