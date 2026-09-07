import { NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSiteContext } from '@/lib/cms/site-context'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  INSTAGRAM_STATE_LABEL, STATE_TTL_SECONDS, deriveHmacKey, signState, verifyState,
} from '@/lib/oauth/state'
import { oauthResultHtml } from '@/lib/oauth/popup-result'
import type { OauthErrorCode } from '@/lib/oauth/errors'
import { assertSameOriginFetch, getSiteDomains, resolveOAuthOrigin } from '@/lib/oauth/origin'
import { getVaultKeyOrNull } from '@/lib/instagram/token'
import { oauthErrorText } from '@/lib/instagram/status-text'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SETTINGS_HREF = '/cms/settings/instagram'
const LOGIN_HREF = '/cms/login?next=/cms/settings/instagram'
const AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } as const

/**
 * MUST (§3.1): toda falha do início responde `oauthResultHtml` — nunca JSON e
 * nunca 302 para o login. A rota é aberta por `window.open`; um 302 renderiza o
 * login DENTRO da janela do OAuth, o opener nunca recebe `postMessage` e o card
 * fica em `In progress` até o teto de 10 min.
 */
async function fail(
  code: OauthErrorCode,
  status: number,
  targetOrigin: string,
  backHref: string = SETTINGS_HREF,
): Promise<Response> {
  const nonce = (await headers()).get('x-nonce') ?? ''
  return oauthResultHtml({
    messageType: 'instagram-oauth-result',
    provider: 'instagram',
    success: false,
    error: oauthErrorText(code),
    extra: { code },
    backHref,
    targetOrigin,
    nonce,
    status,
    headers: NO_STORE,
  })
}

export async function GET(req: NextRequest): Promise<Response> {
  let targetOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // 1 — site + sessão + Fetch Metadata
  let siteId: string
  try {
    ({ siteId } = await getSiteContext())
  } catch {
    return fail('origin_not_allowed', 400, targetOrigin)
  }

  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!auth.ok) {
    return auth.reason === 'unauthenticated'
      ? fail('session_changed', 401, targetOrigin, LOGIN_HREF)
      : fail('session_changed', 403, targetOrigin)
  }

  const deny = assertSameOriginFetch(req)
  if (deny) return fail(deny.code, deny.status, targetOrigin)

  // 2 — configuração
  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  if (!appId || !appSecret) return fail('not_configured', 503, targetOrigin)
  const masterKey = process.env.SOCIAL_MASTER_KEY
  if (!masterKey || getVaultKeyOrNull() === null) {
    return fail('vault_unavailable', 503, targetOrigin)
  }

  // 3 — a conta pertence a este site
  const accountId = req.nextUrl.searchParams.get('account_id') ?? ''
  if (!UUID_RE.test(accountId)) return fail('account_not_found', 404, targetOrigin)
  const supabase = getSupabaseServiceClient()
  const { data: account } = await supabase
    .from('instagram_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('site_id', siteId)
    .maybeSingle()
  if (!account) return fail('account_not_found', 404, targetOrigin)

  // 4 — origem
  const origin = resolveOAuthOrigin(req, await getSiteDomains(siteId))
  if (!origin) return fail('origin_not_allowed', 400, targetOrigin)
  targetOrigin = origin
  const redirectUri = `${origin}/api/instagram/oauth/callback`
  const igKey = deriveHmacKey(masterKey, INSTAGRAM_STATE_LABEL)

  // 5 — rebind (opcional): `allowRebindTo` só vem de um state já verificado
  let allowRebindTo: string | undefined
  const rebind = req.nextUrl.searchParams.get('rebind')
  if (rebind) {
    const p = verifyState(rebind, igKey, { typ: 'rebind', requireExp: true })
    if (
      !p || p.siteId !== siteId || p.userId !== auth.user.id ||
      p.accountId !== accountId || !p.allowRebindTo
    ) {
      return fail('invalid_state', 400, targetOrigin)
    }
    allowRebindTo = p.allowRebindTo
  }

  // 6 — state + cookie de nonce
  const isHttps = origin.startsWith('https:')
  const cookieName = isHttps ? '__Secure-ig_oauth_nonce' : 'ig_oauth_nonce'
  const nonceValue = randomBytes(16).toString('hex')
  const jar = await cookies()
  jar.set({
    name: cookieName,
    value: nonceValue,
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    maxAge: STATE_TTL_SECONDS,
    path: '/api/instagram/oauth',
  })

  const state = signState({
    typ: 'state',
    siteId,
    userId: auth.user.id,
    accountId,
    origin,
    ...(allowRebindTo ? { allowRebindTo } : {}),
    nonce: nonceValue,
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  }, igKey)

  // 7 — 302 para a Meta. `force_reauth` SÓ em "Connect a different account":
  // no rebind o dono já autorizou @X e exigir senha+2FA reabriria a seleção de
  // conta, produzindo um terceiro mismatch (§3.1 passo 7).
  const authorize = new URL(AUTHORIZE_URL)
  authorize.searchParams.set('client_id', appId)
  authorize.searchParams.set('redirect_uri', redirectUri)
  authorize.searchParams.set('response_type', 'code')
  authorize.searchParams.set('scope', 'instagram_business_basic')
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('enable_fb_login', 'false')
  if (req.nextUrl.searchParams.get('different') === '1') {
    authorize.searchParams.set('force_reauth', 'true')
  }

  return new Response(null, {
    status: 302,
    headers: { Location: authorize.toString(), ...NO_STORE },
  })
}
