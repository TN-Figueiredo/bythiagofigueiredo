'use server'
// Aprovar e negar: atômicos (uma função SQL cada), presos ao navegador que abriu o pedido (A1) e à pessoa da sessão.
// Ordem: origem → forma do id → host e travas → `getUser()` → cookie do pedido → site → função. Nada antes da função toca o banco.
// `redirect()` fica FORA dos `try` (lança `NEXT_REDIRECT`).
import * as Sentry from '@sentry/nextjs'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { getSiteContext } from '@/lib/cms/site-context'
import { EMISSOR } from '@/lib/youtube/observatorio/acesso-ia/oauth/config'
import { novoToken } from '@/lib/youtube/observatorio/acesso-ia/oauth/tokens'
import { FORMA_DO_ID, COOKIE_PEDIDO, codigoDeErro, cookieConfere, hostAceito, origemConfere, sha256Hex, travasFechadas } from './guardas'
import { usuarioDaSessao } from './sessao'
import type { EstadoDaTela } from './tipos'

interface Contexto {
  id: string
  userId: string
  siteId: string
}

const erro = (e?: unknown): EstadoDaTela => {
  const codigo = codigoDeErro()
  const code = typeof e === 'object' && e !== null && typeof (e as { code?: unknown }).code === 'string' ? (e as { code: string }).code : undefined
  Sentry.captureException(new Error('acesso-ia: consentimento falhou'), { tags: { codigo }, extra: code ? { code } : {} })
  return { estado: 'erro', codigo }
}

async function preludio(fd: FormData): Promise<{ ok: true; c: Contexto } | { ok: false; estado: EstadoDaTela }> {
  const h = await headers()
  const host = h.get('host')
  if (!origemConfere(h.get('origin'), host)) return { ok: false, estado: { estado: 'invalido' } }
  const bruto = fd.get('authorization_id')
  if (typeof bruto !== 'string' || !FORMA_DO_ID.test(bruto)) return { ok: false, estado: { estado: 'invalido' } }
  if (!hostAceito(host)) return { ok: false, estado: { estado: 'invalido' } }
  if (travasFechadas()) return { ok: false, estado: { estado: 'desligado' } }
  const user = await usuarioDaSessao()
  if (!user) return { ok: false, estado: { estado: 'sem_login' } }
  let cookie: string | undefined
  try {
    cookie = (await cookies()).get(COOKIE_PEDIDO)?.value
  } catch {
    cookie = undefined
  }
  if (!cookieConfere(cookie, bruto)) return { ok: false, estado: { estado: 'outro_navegador' } }
  let siteId: string
  try {
    siteId = (await getSiteContext()).siteId
  } catch (e) {
    return { ok: false, estado: erro(e) }
  }
  return { ok: true, c: { id: bruto, userId: user.id, siteId } }
}

function estadoDoMotivo(motivo: string): EstadoDaTela {
  switch (motivo) {
    case 'pedido_invalido':
    case 'site':
      return { estado: 'invalido' }
    case 'cortado':
      return { estado: 'cortado' }
    case 'nao_liberada':
    case 'teto':
    case 'sem_vinculo':
    case 'banida':
    case 'apagamento':
      return { estado: 'sem_direito' }
    case 'sem_login':
      return { estado: 'sem_login' }
    default:
      return erro()
  }
}

async function apagarCookie(): Promise<void> {
  try {
    ;(await cookies()).delete({ name: COOKIE_PEDIDO, path: '/', secure: true })
  } catch {
    /* melhor esforço: o pedido já foi consumido */
  }
}

type Linha = { motivo?: string | null; redirect_uri?: string | null; state?: string | null; cliente?: string | null }

function destino(uri: string, state: string | null | undefined, params: Record<string, string>): string {
  const u = new URL(uri)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  if (typeof state === 'string') u.searchParams.set('state', state)
  u.searchParams.set('iss', EMISSOR)
  return u.toString()
}

export async function aprovar(fd: FormData): Promise<EstadoDaTela> {
  const p = await preludio(fd)
  if (!p.ok) return p.estado
  const agora = Date.now()
  const codigo = novoToken('oac_')
  let linha: Linha
  try {
    const { data, error } = await getSupabaseServiceClient().rpc('obs_ai_aprovar_conexao', {
      p_pedido_hash: sha256Hex(p.c.id),
      p_user: p.c.userId,
      p_site: p.c.siteId,
      p_codigo_hash: codigo.hash,
      p_agora: new Date(agora).toISOString(),
    })
    if (error) return erro(error)
    const l = Array.isArray(data) ? data[0] : data
    if (typeof l !== 'object' || l === null) return erro()
    linha = l as Linha
  } catch (e) {
    return erro(e)
  }
  if (typeof linha.motivo === 'string') return estadoDoMotivo(linha.motivo)
  if (linha.motivo !== null && linha.motivo !== undefined) return erro()
  if (typeof linha.redirect_uri !== 'string') return erro()
  let url: string
  try {
    url = destino(linha.redirect_uri, linha.state, { code: codigo.texto })
  } catch (e) {
    return erro(e)
  }
  Sentry.captureMessage('acesso-ia: conexão aprovada', {
    level: 'info',
    tags: { cliente: typeof linha.cliente === 'string' ? linha.cliente : 'desconhecido', dia: new Date(agora).toISOString().slice(0, 10) },
  })
  await apagarCookie()
  redirect(url)
}

export async function negar(fd: FormData): Promise<EstadoDaTela> {
  const p = await preludio(fd)
  if (!p.ok) return p.estado
  let linha: Linha
  try {
    const { data, error } = await getSupabaseServiceClient().rpc('obs_ai_negar_pedido', {
      p_pedido_hash: sha256Hex(p.c.id),
      p_user: p.c.userId,
      p_site: p.c.siteId,
    })
    if (error) return erro(error)
    const l = Array.isArray(data) ? data[0] : data
    if (typeof l !== 'object' || l === null) return erro()
    linha = l as Linha
  } catch (e) {
    return erro(e)
  }
  if (typeof linha.motivo === 'string') return estadoDoMotivo(linha.motivo)
  if (typeof linha.redirect_uri !== 'string') return erro()
  let url: string
  try {
    url = destino(linha.redirect_uri, linha.state, { error: 'access_denied' })
  } catch (e) {
    return erro(e)
  }
  await apagarCookie()
  redirect(url)
}
