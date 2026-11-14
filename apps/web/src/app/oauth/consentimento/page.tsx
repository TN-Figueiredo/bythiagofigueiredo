// Tela de consentimento (spec 4.3/4.4). Só LÊ: quem muda o banco é a action (`aprovar`/`negar`), por uma função SQL atômica.
// Ordem: host → travas → forma do id → `getUser()` → cookie do navegador (A1) → pedido → cliente → liberação/privado/conexão.
import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { headers, cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { PRAZOS } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import { clienteDoRedirect } from '@/lib/youtube/observatorio/acesso-ia/oauth/redirects'
import { registrarConsentimento, type DesfechoDoConsentimento } from '@/lib/youtube/observatorio/acesso-ia/registrar'
import type { Cliente } from '@/lib/youtube/observatorio/acesso-ia/liberacao'
import { vePrivado } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { aprovar, negar } from './actions'
import { Consentimento } from './formulario'
import { COOKIE_PEDIDO, FORMA_DO_ID, NOME_DA_IA, caminhoDoLogin, codigoDeErro, cookieConfere, hostAceito, sha256Hex, travasFechadas } from './guardas'
import { usuarioDaSessao } from './sessao'
import type { DadosDoPedido, EstadoDaTela } from './tipos'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Conectar à IA', robots: { index: false, follow: false } }

const TRES_MIN = 3 * 60_000
const SP = 'America/Sao_Paulo'

const tela = (id: string, inicial: EstadoDaTela | null, pedido: DadosDoPedido | null) => (
  <Consentimento authorizationId={id} inicial={inicial} pedido={pedido} aprovar={aprovar} negar={negar} />
)

function erro(id: string, e?: unknown) {
  const codigo = codigoDeErro()
  const code = typeof e === 'object' && e !== null && typeof (e as { code?: unknown }).code === 'string' ? (e as { code: string }).code : undefined
  Sentry.captureException(new Error('acesso-ia: consentimento falhou'), { tags: { codigo }, extra: code ? { code } : {} })
  return tela(id, { estado: 'erro', codigo }, null)
}

async function gravar(siteId: string, userId: string, cliente: Cliente | null, desfecho: DesfechoDoConsentimento, agora: number): Promise<void> {
  try {
    await registrarConsentimento(getSupabaseServiceClient(), { siteId, userId, keyId: null, cliente, desfecho, agora })
  } catch {
    /* melhor esforço: a linha é só do registro */
  }
}

const hora = (ms: number): string => new Intl.DateTimeFormat('pt-BR', { timeZone: SP, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms)
const dia = (ms: number): string => new Intl.DateTimeFormat('pt-BR', { timeZone: SP, day: '2-digit', month: '2-digit', year: 'numeric' }).format(ms)

export default async function Consentimento_({ searchParams }: { searchParams: Promise<{ authorization_id?: string | string[] }> }) {
  const h = await headers()
  if (!hostAceito(h.get('host'))) notFound()
  const agora = Date.now()
  const bruto = (await searchParams).authorization_id
  const idBruto = Array.isArray(bruto) ? bruto[0] : bruto
  const idOk = typeof idBruto === 'string' && FORMA_DO_ID.test(idBruto)
  const id = idOk ? idBruto : ''

  if (travasFechadas()) {
    const user = await usuarioDaSessao()
    if (user) {
      try {
        await gravar((await getSiteContext()).siteId, user.id, null, 'desligado', agora)
      } catch {
        /* sem site, sem linha */
      }
    }
    return tela(id, { estado: 'desligado' }, null)
  }
  if (!idOk) return tela('', { estado: 'invalido' }, null)

  const user = await usuarioDaSessao()
  if (!user) redirect(caminhoDoLogin(id))

  let cookie: string | undefined
  try {
    cookie = (await cookies()).get(COOKIE_PEDIDO)?.value
  } catch {
    cookie = undefined
  }
  if (!cookieConfere(cookie, id)) return tela(id, { estado: 'outro_navegador' }, null)

  let siteId: string
  let pedido: { client_id?: unknown; redirect_uri?: unknown; expires_at?: unknown; consumido_em?: unknown; site_id?: unknown } | null
  try {
    siteId = (await getSiteContext()).siteId
    const r = await getSupabaseServiceClient()
      .from('obs_ai_oauth_pedidos')
      .select('client_id, redirect_uri, expires_at, consumido_em, site_id')
      .eq('hash', sha256Hex(id))
      .maybeSingle()
    if (r.error) return erro(id, r.error)
    pedido = r.data as typeof pedido
  } catch (e) {
    return erro(id, e)
  }

  const expira = typeof pedido?.expires_at === 'string' ? Date.parse(pedido.expires_at) : NaN
  const cliente = typeof pedido?.redirect_uri === 'string' ? clienteDoRedirect(pedido.redirect_uri) : null
  if (!pedido || !Number.isFinite(expira) || expira <= agora || pedido.consumido_em != null || pedido.site_id !== siteId || cliente === null) {
    await gravar(siteId, user.id, cliente, 'invalido', agora)
    return tela(id, { estado: 'invalido' }, null)
  }

  let valeAte: string | null = null
  let jaConectado = false
  let privado = false
  try {
    const sb = getSupabaseServiceClient()
    const lib = await sb.from('obs_ai_liberacoes').select('expires_at').eq('site_id', siteId).eq('user_id', user.id).is('revoked_at', null).maybeSingle()
    if (lib.error) return erro(id, lib.error)
    const fim = typeof (lib.data as { expires_at?: unknown } | null)?.expires_at === 'string' ? Date.parse((lib.data as { expires_at: string }).expires_at) : NaN
    if (Number.isFinite(fim) && fim > agora) valeAte = dia(fim)
    privado = await vePrivado(siteId)
    // erro nesta leitura não recusa: só omite a linha
    try {
      const con = await sb.from('obs_ai_conexoes').select('id').eq('site_id', siteId).eq('user_id', user.id).eq('cliente', cliente).is('revoked_at', null).limit(1).maybeSingle()
      jaConectado = !con.error && con.data != null
    } catch {
      jaConectado = false
    }
  } catch (e) {
    return erro(id, e)
  }

  const feito = expira - PRAZOS.pedidoMin * 60_000
  const ia = NOME_DA_IA[cliente]
  return tela(id, null, { ia, email: user.email, hora: hora(feito), tarde: agora - feito > TRES_MIN, privado, valeAte, jaConectado })
}
