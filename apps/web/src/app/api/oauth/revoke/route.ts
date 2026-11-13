import { createHash } from 'crypto'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { pipelineLog } from '@/lib/pipeline/logger'
import { acessoExternoLigado } from '@/lib/youtube/observatorio/acesso-ia/interruptor'
import { oauthLigado } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import { lerForm } from '@/lib/youtube/observatorio/acesso-ia/oauth/tokens'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'gru1'

const vazio = (status: number, corpo = ''): Response =>
  new Response(corpo, { status, headers: { 'Cache-Control': 'no-store', ...(corpo ? { 'Content-Type': 'application/json' } : {}) } })

/** RFC 7009: sempre 200, sem revelar se o token existia. `token_type_hint` é ignorado. */
export async function POST(req: Request): Promise<Response> {
  if (!oauthLigado() || !acessoExternoLigado().ligado) return vazio(503, JSON.stringify({ error: 'temporarily_unavailable' }))

  const lido = await lerForm(req)
  if (!lido.ok) return vazio(200)
  const token = lido.f.get('token')
  if (!token) return vazio(200)

  try {
    const { error } = await getSupabaseServiceClient().rpc('obs_ai_revogar_token', {
      p_hash: createHash('sha256').update(token).digest('hex'),
      p_agora: new Date().toISOString(),
    })
    if (error) pipelineLog('error', 'oauth-revoke', 'falha ao revogar', { code: (error as { code?: string }).code ?? 'desconhecido' })
  } catch {
    pipelineLog('error', 'oauth-revoke', 'falha ao revogar', { code: 'excecao' })
  }
  return vazio(200)
}
