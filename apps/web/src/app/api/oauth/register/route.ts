import { randomBytes } from 'crypto'
import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { LIMITES, oauthLigado, segredoDeIp } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import { hashDoIp } from '@/lib/youtube/observatorio/acesso-ia/oauth/ip'
import { avisarRecusa } from '@/lib/youtube/observatorio/acesso-ia/oauth/aviso'
import { clienteDaLista } from '@/lib/youtube/observatorio/acesso-ia/oauth/redirects'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'gru1'

const MAX_CORPO = 8 * 1024

const json = (status: number, corpo: unknown): Response =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })

const indisponivel = (): Response => json(503, { error: 'temporarily_unavailable' })
const metadadosInvalidos = (): Response => json(400, { error: 'invalid_client_metadata' })

/** Lê o corpo até MAX_CORPO bytes; `null` = passou do limite. */
async function lerCorpo(req: Request): Promise<string | null> {
  const cl = Number(req.headers.get('content-length'))
  if (Number.isFinite(cl) && cl > MAX_CORPO) return null
  if (!req.body) return ''
  const leitor = req.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_CORPO) {
      await leitor.cancel().catch(() => undefined)
      return null
    }
    partes.push(value)
  }
  return Buffer.concat(partes).toString('utf8')
}

const Linha = z.object({ n: z.number(), n_dia: z.number(), estourou: z.boolean() })

export async function POST(req: Request): Promise<Response> {
  if (!oauthLigado()) return json(404, { error: 'not_found' })
  const segredo = segredoDeIp()
  if (!segredo) return indisponivel()

  let texto: string | null
  try {
    texto = await lerCorpo(req)
  } catch {
    return metadadosInvalidos()
  }
  if (texto === null) return json(413, { error: 'invalid_client_metadata' })

  let corpo: unknown
  try {
    corpo = JSON.parse(texto)
  } catch {
    return metadadosInvalidos()
  }
  const obj = z.record(z.string(), z.unknown()).safeParse(corpo)
  if (!obj.success || Array.isArray(corpo)) return metadadosInvalidos()

  const agora = Date.now()
  let sb: ReturnType<typeof getSupabaseServiceClient>
  try {
    sb = getSupabaseServiceClient()
    const { data, error } = await sb.rpc('obs_ai_rate_ip_hit', {
      p_grain: 'register',
      p_hash: hashDoIp(req, segredo, agora),
      p_now: new Date(agora).toISOString(),
      p_limite: LIMITES.registerHora,
      p_teto_dia: LIMITES.registerDia,
    })
    if (error) return indisponivel()
    const linha = Linha.safeParse(Array.isArray(data) ? data[0] : data)
    if (!linha.success) return indisponivel()
    const { n, n_dia, estourou } = linha.data
    if (n > LIMITES.registerHora || n_dia > LIMITES.registerDia || estourou) {
      avisarRecusa('limite_register')
      return json(429, { error: 'rate_limited' })
    }
  } catch {
    return indisponivel()
  }

  const r = clienteDaLista(obj.data.redirect_uris)
  if (!r.ok) {
    avisarRecusa('redirect', r.host ?? undefined)
    return json(400, { error: 'invalid_redirect_uri' })
  }

  const clientId = randomBytes(32).toString('base64url')
  try {
    const { error } = await sb.from('obs_ai_oauth_clientes').insert({
      client_id: clientId,
      redirect_uris: r.uris,
      cliente: r.cliente,
    })
    if (error) return indisponivel()
  } catch {
    return indisponivel()
  }

  return json(201, {
    client_id: clientId,
    redirect_uris: r.uris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  })
}
