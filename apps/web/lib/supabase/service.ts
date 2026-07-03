import { createClient } from '@supabase/supabase-js';
import type { TypedClient, UntypedClient } from './typed';

let cached: UntypedClient | null = null;

/**
 * @deprecated transitório BTF-059 — novos consumidores devem usar
 * {@link getTypedServiceClient}. Migração incremental na Fase 2.
 */
export function getSupabaseServiceClient(): UntypedClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  cached = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}

/**
 * Mesmo singleton de {@link getSupabaseServiceClient}, exposto como
 * {@link TypedClient} (BTF-059, modo conservador). O cast é seguro: o client
 * aponta para o schema `public` do qual @/types/database.types foi gerado
 * (`npm run db:types`). Cast centralizado aqui — consumidores migram para
 * esta fábrica na Fase 2 sem casts locais.
 */
export function getTypedServiceClient(): TypedClient {
  return getSupabaseServiceClient() as TypedClient;
}
