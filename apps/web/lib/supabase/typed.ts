import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * Client Supabase tipado com o schema gerado (BTF-059).
 * Regenerar types: `npm run db:types` (requer Supabase local up).
 */
export type TypedClient = SupabaseClient<Database>

/** @deprecated transitório BTF-059 — migrar consumidores para TypedClient */
export type UntypedClient = SupabaseClient
