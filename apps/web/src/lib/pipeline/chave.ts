import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

/**
 * Ponto único da validade de uma chave de API do pipeline (E17, degrau 2, Tarefa 2).
 *
 * As duas entradas de autenticação (`lib/pipeline/auth.ts` e `lib/pipeline/mcp/auth.ts`) passam a chamar
 * `resolverChave` em vez de cada uma ter a sua busca. Três decisões que mantêm o Cowork e a forja idênticos:
 *  - a consulta pede `*`, não uma lista de colunas: sem a MG11 (colunas `user_id` e `expires_at`) uma lista
 *    daria erro de coluna inexistente e derrubaria as chaves vivas; com `*` as duas colunas só aparecem quando existem;
 *  - a busca mantém `.single()`: "nenhuma linha" e "mais de uma linha" chegam com o mesmo código (PGRST116) e
 *    viram `ausente`; a primeira de duas linhas nunca é usada;
 *  - a exceção da chamada ao banco NÃO é apanhada: sobe como nas duas buscas de hoje (a rota do MCP responde
 *    500, a do pipeline deixa passar). Erro DEVOLVIDO pelo banco vira `erro` (401 nas entradas antigas).
 */

/** Permissão única do perfil de leitura externa do Observatório. */
export const PERFIL = 'observatorio_leitura'

export const ehDoPerfil = (permissions: readonly string[]): boolean => permissions.includes(PERFIL)

/** Exatamente um item, e é o do perfil (perfil misto não é perfil). */
export const ehSoDoPerfil = (permissions: readonly string[]): boolean =>
  permissions.length === 1 && permissions[0] === PERFIL

const INSTANTE_COMPLETO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/

/**
 * Data e hora completas com fuso (`Z` ou deslocamento), com ou sem fração. É o formato que o banco devolve
 * (`2027-04-11T12:00:00+00:00`, às vezes com seis casas); o `datetime()` do Zod recusa esse formato sem opção.
 */
export function instanteValido(texto: string): boolean {
  return INSTANTE_COMPLETO.test(texto) && Number.isFinite(Date.parse(texto))
}

const TRES_HORAS_MS = 3 * 3_600_000 // São Paulo é UTC-3, sem horário de verão desde 2019

/** `chave vencida em dd/mm: peça outra ao dono`, no dia de São Paulo. Instante inválido não inventa data. */
export function fraseDeVencida(expiresAtIso: string): string {
  const ms = Date.parse(expiresAtIso)
  if (!Number.isFinite(ms)) return 'chave vencida: peça outra ao dono'
  const d = new Date(ms - TRES_HORAS_MS)
  const dia = String(d.getUTCDate()).padStart(2, '0')
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `chave vencida em ${dia}/${mes}: peça outra ao dono`
}

export interface ChaveLida {
  id: string
  siteId: string
  name: string | null
  permissions: string[]
  userId: string | null
  expiresAt: string | null
}

export type ResultadoDaChave =
  | { estado: 'ativa'; chave: ChaveLida }
  | { estado: 'vencida'; chave: ChaveLida } // expires_at preenchida e <= agora
  | { estado: 'ausente' } // nenhuma linha não revogada com esse hash, ou mais de uma: nunca a primeira
  | { estado: 'erro'; code: string } // erro devolvido pelo banco, ou linha fora de forma

/**
 * `id` e `site_id`: texto não vazio, sem exigir forma de uuid (os simuladores de teste usam `key-1`).
 * `name` e `user_id` ausentes valem nulo; `permissions` fora do formato vale lista vazia, como hoje.
 */
const LINHA = z.object({
  id: z.string().min(1),
  site_id: z.string().min(1),
  name: z.string().nullish(),
  permissions: z.unknown().optional(),
  user_id: z.string().min(1).nullish(),
  expires_at: z.string().nullish(),
})

export async function resolverChave(sb: SupabaseClient, keyHash: string, agora: number): Promise<ResultadoDaChave> {
  const { data, error } = await sb
    .from('pipeline_api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .single()

  if (error && error.code !== 'PGRST116') return { estado: 'erro', code: error.code || 'desconhecido' }
  if (!data) return { estado: 'ausente' }

  const lida = LINHA.safeParse(data)
  if (!lida.success) return { estado: 'erro', code: 'linha_invalida' }
  const l = lida.data

  const expiresAt = l.expires_at ?? null
  if (expiresAt !== null && !instanteValido(expiresAt)) return { estado: 'erro', code: 'validade_invalida' }

  const chave: ChaveLida = {
    id: l.id,
    siteId: l.site_id,
    name: l.name ?? null,
    permissions: Array.isArray(l.permissions) ? l.permissions.filter((p): p is string => typeof p === 'string') : [],
    userId: l.user_id ?? null,
    expiresAt,
  }
  if (expiresAt !== null && Date.parse(expiresAt) <= agora) return { estado: 'vencida', chave }
  return { estado: 'ativa', chave }
}
