import { createHash, randomBytes } from 'crypto'
import { z } from 'zod'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { EMISSOR, LIMITES, PRAZOS, hostDoRecurso, oauthLigado, segredoDeIp } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import { codigoDeErroPg } from '@/lib/youtube/observatorio/acesso-ia/oauth/log'
import { hashDoIp } from '@/lib/youtube/observatorio/acesso-ia/oauth/ip'
import { pipelineLog } from '@/lib/pipeline/logger'
import { avisarRecusa } from '@/lib/youtube/observatorio/acesso-ia/oauth/aviso'
import { validarPedido } from '@/lib/youtube/observatorio/acesso-ia/oauth/pedido'
import { htmlDeErro, type CodigoErro } from '@/lib/youtube/observatorio/acesso-ia/oauth/textos-erro'

const COOKIE_PEDIDO = '__Host-oauth_pedido'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'gru1'

const CAB = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }

const pagina = (status: number, codigo: CodigoErro): Response =>
  new Response(htmlDeErro(codigo), { status, headers: { ...CAB, 'Content-Type': 'text/html; charset=utf-8' } })
type Etapa = 'rate' | 'cliente' | 'site' | 'pedido'
/** I1 (portão F3): todo 503 deixa rastro com etapa e código; nunca IP, hash, client_id nem redirect_uri. */
const indisponivel = (etapa: Etapa, code: string): Response => {
  pipelineLog('error', 'oauth-authorize', etapa, { code })
  return pagina(503, 'falha')
}
const redirecionar = (url: string): Response => new Response(null, { status: 302, headers: { ...CAB, Location: url } })

const Linha = z.object({ n: z.number(), n_dia: z.number(), estourou: z.boolean() })
const Cliente = z.object({ redirect_uris: z.array(z.string()) })

export async function GET(req: Request): Promise<Response> {
  if (!oauthLigado()) return new Response('not_found', { status: 404 })
  const url = new URL(req.url)
  const host = req.headers.get('host') ?? url.host
  if (!hostDoRecurso(host)) return new Response('not_found', { status: 404 })
  const segredo = segredoDeIp()
  if (!segredo) return indisponivel('rate', 'sem_segredo')

  const agora = Date.now()
  let sb: ReturnType<typeof getSupabaseServiceClient>
  try {
    sb = getSupabaseServiceClient()
    const { data, error } = await sb.rpc('obs_ai_rate_ip_hit', {
      p_grain: 'authorize',
      p_hash: hashDoIp(req, segredo, agora),
      p_now: new Date(agora).toISOString(),
      p_limite: LIMITES.authorizeHora,
      p_teto_dia: LIMITES.authorizeDia,
    })
    if (error) return indisponivel('rate', codigoDeErroPg(error))
    const linha = Linha.safeParse(Array.isArray(data) ? data[0] : data)
    if (!linha.success) return indisponivel('rate', 'linha_invalida')
    const { n, n_dia, estourou } = linha.data
    if (n > LIMITES.authorizeHora || n_dia > LIMITES.authorizeDia || estourou) {
      avisarRecusa(estourou || n_dia > LIMITES.authorizeDia ? 'teto_dia' : 'limite_authorize')
      return pagina(429, 'limite')
    }
  } catch {
    return indisponivel('rate', 'excecao')
  }

  const q = url.searchParams
  const clientId = q.get('client_id')
  let registrado: { redirect_uris: string[] } = { redirect_uris: [] }
  if (clientId) {
    try {
      const { data, error } = await sb
        .from('obs_ai_oauth_clientes')
        .select('redirect_uris')
        .eq('client_id', clientId)
        .maybeSingle()
      if (error) return indisponivel('cliente', codigoDeErroPg(error))
      const c = Cliente.safeParse(data)
      if (!c.success) return pagina(200, 'cliente')
      registrado = c.data
    } catch {
      return indisponivel('cliente', 'excecao')
    }
  }

  const r = validarPedido(q, registrado)
  if (!r.ok) {
    if (!('descricao' in r)) return pagina(200, r.erro)
    const destino = new URL(q.get('redirect_uri') as string)
    destino.searchParams.set('error', r.erro)
    destino.searchParams.set('error_description', r.descricao)
    const state = q.get('state')
    if (state !== null && state.length <= LIMITES.stateMax) destino.searchParams.set('state', state)
    destino.searchParams.set('iss', EMISSOR)
    return redirecionar(destino.toString())
  }

  let siteId: string
  try {
    siteId = (await getSiteContext()).siteId
  } catch {
    return indisponivel('site', 'excecao')
  }

  const id = randomBytes(32).toString('base64url')
  try {
    const { error } = await sb.from('obs_ai_oauth_pedidos').insert({
      hash: createHash('sha256').update(id).digest('hex'),
      client_id: r.p.clientId,
      redirect_uri: r.p.redirectUri,
      code_challenge: r.p.codeChallenge,
      state: r.p.state,
      scope: r.p.scope,
      resource: r.p.resource,
      site_id: siteId,
      expires_at: new Date(agora + PRAZOS.pedidoMin * 60_000).toISOString(),
    })
    if (error) return indisponivel('pedido', codigoDeErroPg(error))
  } catch {
    return indisponivel('pedido', 'excecao')
  }
  // A1 (ataque F3): o pedido fica preso ao navegador que o abriu; a tela e as actions exigem este cookie (sem Domain: `__Host-`).
  const res = redirecionar(`/oauth/consentimento?authorization_id=${id}`)
  res.headers.append('Set-Cookie', `${COOKIE_PEDIDO}=${id}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${PRAZOS.pedidoMin * 60}`)
  return res
}
