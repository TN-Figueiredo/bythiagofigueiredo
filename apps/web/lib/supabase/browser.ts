import { createBrowserClient } from '@supabase/ssr'
import type { TypedClient, UntypedClient } from './typed'

let _client: UntypedClient | null = null

/**
 * @deprecated transitório BTF-059 — novos consumidores devem usar
 * {@link getTypedBrowserClient}. Migração incremental na Fase 2.
 */
export function getSupabaseBrowserClient(): UntypedClient {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  return _client
}

/**
 * Mesmo singleton de {@link getSupabaseBrowserClient}, exposto como
 * {@link TypedClient} (BTF-059, modo conservador). Cast seguro e
 * centralizado — ver lib/supabase/typed.ts.
 */
export function getTypedBrowserClient(): TypedClient {
  return getSupabaseBrowserClient() as TypedClient
}
