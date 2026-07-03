import {
  createServerClient,
  type CreateServerClientParams,
} from '@tn-figueiredo/auth-nextjs'
import type { TypedClient } from './typed'

/**
 * Wrapper tipado sobre o `createServerClient` do @tn-figueiredo/auth-nextjs
 * (BTF-059). O pacote retorna `SupabaseClient<any, ...>` — o cast fica
 * centralizado AQUI, e apenas aqui, até o pacote aceitar um generic
 * `Database`. Consumidores recebem `TypedClient` sem casts locais.
 */
export function createTypedServerClient(
  params: CreateServerClientParams,
): TypedClient {
  // Cast seguro: o client aponta para o mesmo schema `public` do qual
  // os types em @/types/database.types foram gerados (npm run db:types).
  return createServerClient(params) as TypedClient
}
