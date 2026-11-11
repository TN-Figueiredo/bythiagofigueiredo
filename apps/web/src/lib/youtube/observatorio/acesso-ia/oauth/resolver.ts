import 'server-only'
import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { ehSoDoPerfil, resolverChavePorId, type ChaveLida } from '@/lib/pipeline/chave'
import { extractApiKeyComOrigem } from '@/lib/pipeline/mcp/auth'
import { EMISSOR, ESCOPO } from './config'

export type ResultadoDoToken =
  | { estado: 'ativa' | 'vencida'; chave: ChaveLida }
  | { estado: 'invalido' }
  | { estado: 'erro'; code: string }

const LINHA = z.object({ key_id: z.string().min(1), token_expira: z.string().min(1) })

/**
 * Token de acesso `oat_` -> hash -> `obs_ai_resolver_token` -> a chave da conexão (mesma regra de validade da chave comum).
 * Qualquer exceção das duas idas vira `erro` (a rota responde 503); o token e o hash nunca saem daqui.
 */
export async function resolverTokenDeAcesso(sb: SupabaseClient, token: string, agora: number): Promise<ResultadoDoToken> {
  try {
    const hash = createHash('sha256').update(token).digest('hex')
    const { data, error } = await sb.rpc('obs_ai_resolver_token', { p_hash: hash, p_tipo: 'acesso', p_agora: new Date(agora).toISOString() })
    if (error) return { estado: 'erro', code: (error as { code?: string }).code || 'desconhecido' }
    if (!Array.isArray(data)) return { estado: 'erro', code: 'linha_invalida' }
    if (data.length === 0) return { estado: 'invalido' }
    const linha = LINHA.safeParse(data[0])
    if (!linha.success) return { estado: 'erro', code: 'linha_invalida' }
    const expira = Date.parse(linha.data.token_expira)
    if (!Number.isFinite(expira)) return { estado: 'erro', code: 'validade_invalida' }

    const lida = await resolverChavePorId(sb, linha.data.key_id, agora)
    if (lida.estado === 'erro') return { estado: 'erro', code: lida.code }
    if (lida.estado === 'ausente') return { estado: 'invalido' }
    if (!ehSoDoPerfil(lida.chave.permissions)) return { estado: 'invalido' }
    if (!(expira > agora)) return { estado: 'vencida', chave: lida.chave }
    return { estado: lida.estado, chave: lida.chave }
  } catch {
    return { estado: 'erro', code: 'nao_conferido' }
  }
}

export type Credencial =
  | { tipo: 'nenhuma' }
  | { tipo: 'oat'; token: string }
  | { tipo: 'oat_em_pipeline_key' }
  | { tipo: 'ort' }
  | { tipo: 'outra' }

/** Classifica pelo prefixo. O parser de `Authorization`/`X-Pipeline-Key` é o de `mcp/auth.ts`. `oat_` só vale no `Bearer`; `ort_` nunca vale aqui. */
export function credencialDe(req: Request): Credencial {
  const c = extractApiKeyComOrigem(req)
  if (!c) return { tipo: 'nenhuma' }
  if (c.valor.startsWith('ort_')) return { tipo: 'ort' }
  if (c.valor.startsWith('oat_')) return c.origem === 'bearer' ? { tipo: 'oat', token: c.valor } : { tipo: 'oat_em_pipeline_key' }
  return { tipo: 'outra' }
}

/** Valor do `WWW-Authenticate` que manda o cliente OAuth ao documento de descoberta. */
export function conviteOAuth(): string {
  return `Bearer resource_metadata="${EMISSOR}/.well-known/oauth-protected-resource/api/mcp", scope="${ESCOPO}"`
}
