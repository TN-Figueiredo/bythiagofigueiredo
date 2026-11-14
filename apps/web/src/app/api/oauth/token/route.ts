import { createHash } from 'crypto'
import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { pipelineLog } from '@/lib/pipeline/logger'
import { acessoExternoLigado } from '@/lib/youtube/observatorio/acesso-ia/interruptor'
import { avisarRecusa } from '@/lib/youtube/observatorio/acesso-ia/oauth/aviso'
import { ESCOPO, RECURSO, hostDoRecurso, oauthLigado } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import { lerForm, novoToken, s256 } from '@/lib/youtube/observatorio/acesso-ia/oauth/tokens'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'gru1'

const json = (status: number, corpo: unknown): Response =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  })
const erro = (error: string, error_description?: string): Response =>
  json(400, error_description ? { error, error_description } : { error })
const invalidRequest = (d: string): Response => erro('invalid_request', d)
type Etapa = 'troca' | 'giro' | 'linha'
/** I1 (portão F3): todo 503 deixa rastro com etapa e código; nunca token, hash nem client_id. */
const indisponivel = (etapa: Etapa, code: string): Response => {
  pipelineLog('error', 'oauth-token', etapa, { code })
  return json(503, { error: 'temporarily_unavailable' })
}
const codigoDe = (e: unknown): string => (e as { code?: string } | null)?.code ?? 'desconhecido'

const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/
const Obrigatorio = z.string().min(1)
const Linha = z.object({ motivo: z.string().nullable(), acesso_expira: z.string().nullable() })

const Codigo = z.object({
  code: Obrigatorio, code_verifier: z.string().regex(VERIFIER), client_id: Obrigatorio, redirect_uri: Obrigatorio,
})
const Refresh = z.object({ refresh_token: Obrigatorio, client_id: Obrigatorio })

const sha256 = (t: string): string => createHash('sha256').update(t).digest('hex')

function obj(f: URLSearchParams): Record<string, string> {
  return Object.fromEntries(f.entries())
}

export async function POST(req: Request): Promise<Response> {
  if (!oauthLigado() || !acessoExternoLigado().ligado) return json(503, { error: 'temporarily_unavailable' })
  if (!hostDoRecurso(req.headers.get('host') ?? new URL(req.url).host)) return json(404, { error: 'not_found' })

  const lido = await lerForm(req)
  if (!lido.ok) return lido.status === 413 ? json(413, { error: 'invalid_request' }) : invalidRequest('invalid body')
  const dados = obj(lido.f)

  const grant = dados.grant_type
  if (!grant) return invalidRequest('grant_type missing')
  if (grant !== 'authorization_code' && grant !== 'refresh_token') return erro('unsupported_grant_type')

  const p = (grant === 'authorization_code' ? Codigo : Refresh).safeParse(dados)
  if (!p.success) return invalidRequest('missing or invalid parameter')
  // corte barato: formato errado nunca chega ao banco
  if (grant === 'refresh_token' && !(p.data as z.infer<typeof Refresh>).refresh_token.startsWith('ort_')) return erro('invalid_grant')
  if (grant === 'authorization_code' && !(p.data as z.infer<typeof Codigo>).code.startsWith('oac_')) return erro('invalid_grant')
  if (dados.resource !== undefined && dados.resource !== RECURSO) return erro('invalid_target')

  const acesso = novoToken('oat_')
  const refresh = novoToken('ort_')
  const agoraMs = Date.now()
  const agora = new Date(agoraMs).toISOString()
  const etapa: Etapa = grant === 'authorization_code' ? 'troca' : 'giro'

  let linha: z.SafeParseReturnType<unknown, { motivo: string | null; acesso_expira: string | null }>
  try {
    const sb = getSupabaseServiceClient()
    const r =
      grant === 'authorization_code'
        ? await sb.rpc('obs_ai_trocar_codigo', {
            p_hash: sha256((p.data as z.infer<typeof Codigo>).code),
            p_client: p.data.client_id,
            p_redirect: (p.data as z.infer<typeof Codigo>).redirect_uri,
            p_verifier_s256: s256((p.data as z.infer<typeof Codigo>).code_verifier),
            p_acesso_hash: acesso.hash,
            p_refresh_hash: refresh.hash,
            p_agora: agora,
          })
        : await sb.rpc('obs_ai_girar_refresh', {
            p_hash: sha256((p.data as z.infer<typeof Refresh>).refresh_token),
            p_client: p.data.client_id,
            p_novo_acesso: acesso.hash,
            p_novo_refresh: refresh.hash,
            p_agora: agora,
          })
    if (r.error) return indisponivel(etapa, codigoDe(r.error))
    linha = Linha.safeParse(Array.isArray(r.data) ? r.data[0] : r.data)
  } catch {
    return indisponivel(etapa, 'excecao')
  }
  if (!linha.success) return indisponivel('linha', 'linha_invalida')
  if (linha.data.motivo !== null) {
    // A3 (ataque F3): reuso de refresh é o sinal de roubo do BCP; sem token, hash nem client_id.
    if (linha.data.motivo === 'reuso_familia' || linha.data.motivo === 'reuso_carencia') {
      avisarRecusa('reuso_refresh')
      pipelineLog('warn', 'oauth-token', 'reuso de refresh', { motivo: linha.data.motivo })
    }
    return erro('invalid_grant')
  }
  // M3 (portão F3): o prazo vem do banco, uma fonte só.
  const expiraMs = linha.data.acesso_expira === null ? Number.NaN : Date.parse(linha.data.acesso_expira)
  if (Number.isNaN(expiraMs)) return indisponivel('linha', 'linha_invalida')

  return json(200, {
    access_token: acesso.texto,
    refresh_token: refresh.texto,
    token_type: 'Bearer',
    scope: ESCOPO,
    expires_in: Math.max(1, Math.floor((expiraMs - agoraMs) / 1000)),
  })
}
