import { createHash } from 'crypto'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { pipelineLog } from '@/lib/pipeline/logger'
import { resolverChave, ehDoPerfil, fraseDeVencida } from '@/lib/pipeline/chave'

/**
 * MCP-authenticated service context.
 * Transport-agnostic: works with Streamable HTTP headers.
 */
export interface McpServiceContext {
  siteId: string
  permissions: string[]
  keyHash: string
  /** pipeline_api_keys.id of the key that authenticated this MCP request. */
  keyId: string
  /** Pessoa dona da chave (E17 d2). Nula nas chaves que existem hoje e antes da MG11. */
  userId: string | null
  /** Validade da chave, ISO; nula = não vence. */
  expiresAt: string | null
  /** Nome da chave (só para registro; nunca o segredo). */
  name: string | null
  /**
   * `estado === 'vencida'` do ponto único (lib/pipeline/chave.ts). A chave comum vencida já foi recusada aqui;
   * este campo só chega `true` para a chave do perfil, cuja porta decide na ordem de 4.2 do plano da E17.
   */
  vencida: boolean
}

/**
 * Extracts the API key from MCP request headers.
 *
 * Checks (in order):
 *  1. Authorization: Bearer <token>  (MCP transport standard)
 *  2. X-Pipeline-Key: <token>        (existing pipeline compat)
 */
function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() || null
  }
  return req.headers.get('X-Pipeline-Key')
}

/**
 * Resolves MCP authentication from a raw Request.
 *
 * Reuses the same pipeline_api_keys table and SHA-256 key-hash
 * validation that the REST pipeline uses (lib/pipeline/auth.ts).
 *
 * @throws {McpAuthError} on missing/invalid/revoked key
 */
export async function resolveMcpAuth(req: Request): Promise<McpServiceContext> {
  const apiKey = extractApiKey(req)

  if (!apiKey) {
    pipelineLog('warn', 'mcp/auth', 'Missing API key in MCP request')
    throw new McpAuthError('API key required. Send via Authorization: Bearer <key> or X-Pipeline-Key header.', 401)
  }

  const keyHash = createHash('sha256').update(apiKey).digest('hex')

  const supabase = getSupabaseServiceClient()
  // E17 d2: busca e validade num ponto único. A exceção da busca NÃO é apanhada: a rota responde 500, como hoje.
  const lida = await resolverChave(supabase, keyHash, Date.now())

  if (lida.estado === 'ausente' || lida.estado === 'erro') {
    pipelineLog('warn', 'mcp/auth', 'Invalid or revoked API key', { keyHash: keyHash.slice(0, 8) })
    throw new McpAuthError('Invalid or revoked API key', 401)
  }

  const keyRow = lida.chave
  const doPerfil = ehDoPerfil(keyRow.permissions)

  // Chave comum vencida: 401 com a data (item 236). A do perfil segue: quem decide é a porta.
  if (lida.estado === 'vencida' && !doPerfil) {
    pipelineLog('warn', 'mcp/auth', 'Expired API key', { keyHash: keyHash.slice(0, 8) })
    throw new McpAuthError(fraseDeVencida(keyRow.expiresAt ?? ''), 401)
  }

  if (!doPerfil) {
    // Touch last_used_at (fire-and-forget, non-blocking). A chave do perfil não tem last_used_at atualizado:
    // o "último uso" dela é o registro de acesso de IA.
    supabase
      .from('pipeline_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRow.id)
      .then(() => { /* intentional no-op */ })

    pipelineLog('info', 'mcp/auth', 'MCP auth success', { siteId: keyRow.siteId, keyHash: keyHash.slice(0, 8) })
  } else {
    // O hash não vai a log (aviso 0.3 do plano da E17).
    pipelineLog('info', 'mcp/auth', 'MCP auth success', { siteId: keyRow.siteId })
  }

  return {
    siteId: keyRow.siteId,
    permissions: keyRow.permissions,
    keyHash,
    keyId: keyRow.id,
    userId: keyRow.userId,
    expiresAt: keyRow.expiresAt,
    name: keyRow.name,
    vencida: lida.estado === 'vencida',
  }
}

/**
 * Checks whether context has the required permission level.
 * Mirrors requirePermission() from lib/pipeline/auth.ts.
 */
export function mcpRequirePermission(ctx: McpServiceContext, required: 'read' | 'write' | 'admin'): boolean {
  if (required === 'read') return ctx.permissions.includes('read') || ctx.permissions.includes('write') || ctx.permissions.includes('admin')
  if (required === 'write') return ctx.permissions.includes('write') || ctx.permissions.includes('admin')
  return ctx.permissions.includes('admin')
}

/**
 * Structured auth error for MCP layer.
 */
export class McpAuthError extends Error {
  public readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'McpAuthError'
    this.statusCode = statusCode
  }
}
