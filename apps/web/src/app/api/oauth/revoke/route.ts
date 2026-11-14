import { createHash } from 'crypto'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { pipelineLog } from '@/lib/pipeline/logger'
import { acessoExternoLigado } from '@/lib/youtube/observatorio/acesso-ia/interruptor'
import { hostDoRecurso, oauthLigado } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import { codigoDeErroPg } from '@/lib/youtube/observatorio/acesso-ia/oauth/log'
import { lerForm } from '@/lib/youtube/observatorio/acesso-ia/oauth/tokens'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'gru1'

const vazio = (status: number, corpo = '', extra: Record<string, string> = {}): Response =>
  new Response(corpo, { status, headers: { 'Cache-Control': 'no-store', ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...extra } })
const indisponivel = (): Response => vazio(503, JSON.stringify({ error: 'temporarily_unavailable' }), { 'Retry-After': '5' })

/** RFC 7009: 200 salvo falha de infraestrutura (503, A2 do ataque F3), sem revelar se o token existia. `token_type_hint` é ignorado. */
export async function POST(req: Request): Promise<Response> {
  if (!oauthLigado() || !acessoExternoLigado().ligado) return vazio(503, JSON.stringify({ error: 'temporarily_unavailable' }))
  if (!hostDoRecurso(req.headers.get('host') ?? new URL(req.url).host)) return vazio(404, JSON.stringify({ error: 'not_found' }))

  const lido = await lerForm(req)
  if (!lido.ok) return vazio(200)
  const token = lido.f.get('token')
  if (!token || !(token.startsWith('oat_') || token.startsWith('ort_'))) return vazio(200)

  try {
    const { error } = await getSupabaseServiceClient().rpc('obs_ai_revogar_token', {
      p_hash: createHash('sha256').update(token).digest('hex'),
      p_agora: new Date().toISOString(),
    })
    if (error) {
      pipelineLog('error', 'oauth-revoke', 'falha ao revogar', { code: codigoDeErroPg(error) })
      return indisponivel()
    }
  } catch {
    pipelineLog('error', 'oauth-revoke', 'falha ao revogar', { code: 'excecao' })
    return indisponivel()
  }
  return vazio(200)
}
