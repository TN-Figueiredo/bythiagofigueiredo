import { NextRequest, after } from 'next/server'
import { cookies, headers } from 'next/headers'
import { revalidateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { requireSiteScope } from '@tn-figueiredo/auth-nextjs/server'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import {
  INSTAGRAM_STATE_LABEL, deriveHmacKey, signState, verifyState,
} from '@/lib/oauth/state'
import type { IOauthStatePayload } from '@/lib/oauth/state'
import { oauthResultHtml } from '@/lib/oauth/popup-result'
import type { OauthErrorCode } from '@/lib/oauth/errors'
import { getSiteDomains, resolveOAuthOrigin } from '@/lib/oauth/origin'
import { recordSocialConsent } from '@/lib/oauth/consent'
import { getVaultKeyOrNull, redact, writeAccessToken } from '@/lib/instagram/token'
import { TOKEN_API_BASE, fetchInstagramProfile } from '@/lib/instagram/api-client'
import { oauthErrorText } from '@/lib/instagram/status-text'
import { openSyncRow, closeSyncRow } from '@/lib/instagram/sync-log'
import { syncInstagramAccount } from '@/lib/instagram/sync'
import type { InstagramAccountRow } from '@/lib/instagram/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
/** Plano Pro (§7). O sync pós-OAuth roda em `after()` dentro desta janela. */
export const maxDuration = 120

const SETTINGS_HREF = '/cms/settings/instagram'
const LOGIN_HREF = '/cms/login?next=/cms/settings/instagram'
const TOKEN_EXCHANGE_URL = 'https://api.instagram.com/oauth/access_token'
const EXCHANGE_TIMEOUT_MS = 10_000
const MISMATCH_TTL_SECONDS = 600
const POST_SYNC_BUDGET_MS = 100_000
const NONCE_COOKIES = ['__Secure-ig_oauth_nonce', 'ig_oauth_nonce'] as const
const NO_STORE = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } as const
const HANDLE_RE = /^[a-z0-9._]{1,30}$/
const IG_ID_RE = /^[0-9]{1,32}$/
const PERMISSION_ENUM = new Set([
  'instagram_business_basic',
  'instagram_business_content_publish',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
])

interface FlatExchange {
  access_token?: string
  user_id?: string | number
  permissions?: string
  code?: number
  error_type?: string
  error_message?: string
}

function normalizeHandle(raw: string | null): string {
  return String(raw ?? '').trim().replace(/^@/, '').toLowerCase()
}

export async function GET(req: NextRequest): Promise<Response> {
  const nonce = (await headers()).get('x-nonce') ?? ''
  const jar = await cookies()
  const fallbackOrigin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  /**
   * Toda resposta apaga o cookie de nonce com o MESMO `Path` do `Set-Cookie` do
   * início — `cookies().delete(name)` assume `path:'/'` e não limparia nada.
   */
  const finish = (opts: {
    success: boolean
    code?: OauthErrorCode
    mismatch?: boolean
    error?: string
    status?: number
    targetOrigin?: string
    /** Ambos allow-listados por `popup-result.ts` (B). Default: o card. */
    backHref?: string
  }): Response => {
    for (const name of NONCE_COOKIES) jar.delete({ name, path: '/api/instagram/oauth' })
    const extra = opts.mismatch
      ? ({ status: 'handle_mismatch' } as const)
      : opts.code
        ? ({ code: opts.code } as const)
        : undefined
    return oauthResultHtml({
      messageType: 'instagram-oauth-result',
      provider: 'instagram',
      success: opts.success,
      error: opts.success ? undefined : (opts.error ?? (opts.code ? oauthErrorText(opts.code) : 'unknown')),
      extra,
      backHref: opts.backHref ?? SETTINGS_HREF,
      targetOrigin: opts.targetOrigin ?? fallbackOrigin,
      nonce,
      status: opts.status ?? 200,
      headers: NO_STORE,
    })
  }

  // 1 — configuração
  const appId = process.env.INSTAGRAM_APP_ID
  const appSecret = process.env.INSTAGRAM_APP_SECRET
  if (!appId || !appSecret) return finish({ success: false, code: 'not_configured', status: 503 })
  const masterKey = process.env.SOCIAL_MASTER_KEY
  if (!masterKey || getVaultKeyOrNull() === null) {
    return finish({ success: false, code: 'vault_unavailable', status: 503 })
  }
  const igKey = deriveHmacKey(masterKey, INSTAGRAM_STATE_LABEL)

  // 2a — nonce ausente é decidível AQUI e quase sempre é o retorno caindo num
  // navegador in-app: `browser_changed` diz o que fazer; `invalid_state` mandaria
  // o dono repetir exatamente o que acabou de falhar.
  const cookieNonce =
    jar.get('__Secure-ig_oauth_nonce')?.value ?? jar.get('ig_oauth_nonce')?.value ?? ''
  if (!cookieNonce) return finish({ success: false, code: 'browser_changed', status: 400 })

  const rawState = req.nextUrl.searchParams.get('state') ?? ''
  // `requireNonce` de B é BOOLEANO (só exige o campo). A comparação com o cookie
  // é desta rota — é ela que torna o `state` inutilizável noutro navegador.
  const state: IOauthStatePayload | null = verifyState(rawState, igKey, {
    typ: 'state', requireNonce: true, requireExp: true,
  })
  if (
    !state || !state.siteId || !state.userId || !state.accountId || !state.origin ||
    state.nonce !== cookieNonce
  ) {
    return finish({ success: false, code: 'invalid_state', status: 400 })
  }
  const siteId = state.siteId
  const userId = state.userId
  const accountId = state.accountId

  // 2b — a origem do retorno tem de ser a mesma que assinou o `state`.
  const allowed = await getSiteDomains(siteId)
  if (resolveOAuthOrigin(req, allowed) !== state.origin) {
    return finish({ success: false, code: 'invalid_state', status: 400 })
  }
  const targetOrigin = state.origin

  // 3 — a Meta recusou/o dono cancelou
  if (req.nextUrl.searchParams.get('error') || req.nextUrl.searchParams.get('error_reason')) {
    return finish({ success: false, code: 'cancelled', targetOrigin })
  }

  // 4 — sessão re-verificada no retorno
  const auth = await requireSiteScope({ area: 'cms', siteId, mode: 'edit' })
  if (!auth.ok || auth.user.id !== userId) {
    return finish({ success: false, code: 'session_changed', status: 401, targetOrigin, backHref: LOGIN_HREF })
  }

  const code = req.nextUrl.searchParams.get('code') ?? ''
  const supabase = getSupabaseServiceClient()

  // 5–7 — troca de código, troca longa e identidade. Qualquer throw/timeout aqui
  // é `exchange_failed`: nada gravado, nenhuma marcação de token.
  let plainToken: string
  let expiresIn: number
  let igId: string
  let igProfessionalId: string | null
  let handle: string
  let grantedPermissions: string
  try {
    const form = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: `${state.origin}/api/instagram/oauth/callback`,
      code,
    })
    const exRes = await fetch(TOKEN_EXCHANGE_URL, {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
    })
    const exJson = (await exRes.json()) as { data?: FlatExchange[] } & FlatExchange
    const d: FlatExchange = Array.isArray(exJson.data) ? (exJson.data[0] ?? {}) : exJson

    if (!d.access_token) {
      // MUST: só o `code` numérico chega ao dono; o `error_message` da Meta vai
      // redigido ao Sentry e NUNCA para o popup (§2 proíbe string de máquina).
      Sentry.captureMessage(
        `instagram code exchange rejected: ${redact(JSON.stringify({ code: d.code, error_type: d.error_type, error_message: d.error_message }))}`,
        'warning',
      )
      const text = typeof d.code === 'number'
        ? `Instagram rejected the authorization (code ${d.code})`
        : 'Instagram rejected the authorization'
      return finish({ success: false, code: 'exchange_failed', error: text, targetOrigin })
    }

    const perms = (d.permissions ?? '').split(',').map((p) => p.trim()).filter(Boolean)
    if (perms.length > 0 && !perms.includes('instagram_business_basic')) {
      return finish({ success: false, code: 'permission_denied', targetOrigin })
    }
    grantedPermissions = perms.filter((p) => PERMISSION_ENUM.has(p)).join(',')

    // `TOKEN_API_BASE` (C2) é `GRAPH_API_BASE` salvo se o gate de §7 provar a
    // forma sem prefixo — a escolha é de C2, não desta rota.
    const longUrl = new URL(`${TOKEN_API_BASE}/access_token`)
    longUrl.searchParams.set('grant_type', 'ig_exchange_token')
    longUrl.searchParams.set('client_secret', appSecret)
    longUrl.searchParams.set('access_token', d.access_token)
    const longRes = await fetch(longUrl.toString(), { signal: AbortSignal.timeout(EXCHANGE_TIMEOUT_MS) })
    const longJson = (await longRes.json()) as { access_token?: string; expires_in?: number }
    if (!longJson.access_token) {
      return finish({ success: false, code: 'exchange_failed', targetOrigin })
    }
    plainToken = longJson.access_token
    expiresIn = typeof longJson.expires_in === 'number' ? longJson.expires_in : 60 * 24 * 60 * 60

    // MUST — dois ids de espaços diferentes, nunca misturados:
    //   ig_user_id          = me.id ?? String(exchange.user_id)   (app-scoped)
    //   ig_professional_id  = me.user_id ?? null                  (só casa callbacks)
    const me = await fetchInstagramProfile(plainToken)
    const exchangeUserId = d.user_id != null ? String(d.user_id) : null
    if (me.id && exchangeUserId && exchangeUserId !== me.id) {
      Sentry.captureMessage('instagram id spaces differ', 'warning')
    }
    const chosenId = me.id ?? exchangeUserId
    handle = normalizeHandle(me.username)
    if (!chosenId || !IG_ID_RE.test(chosenId) || !HANDLE_RE.test(handle)) {
      return finish({ success: false, code: 'identity_invalid', targetOrigin })
    }
    igId = chosenId
    igProfessionalId = me.userId
    if (igProfessionalId !== null && !IG_ID_RE.test(igProfessionalId)) {
      Sentry.captureMessage('instagram professional id malformed', 'warning')
      igProfessionalId = null
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'instagram-oauth-exchange' } })
    return finish({ success: false, code: 'exchange_failed', targetOrigin })
  }

  // 8 — identidade da linha-alvo (leitura SEMPRE escopada por site)
  const { data: targetData } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('site_id', siteId)
    .single()
  const target = (targetData ?? null) as InstagramAccountRow | null
  if (!target) return finish({ success: false, code: 'account_not_found', status: 404, targetOrigin })

  const isOauthRow = target.ig_user_id_source === 'oauth'
  const identityMatches = isOauthRow
    ? target.ig_user_id === igId
    : normalizeHandle(target.handle) === handle
  const rebindAllowed = state.allowRebindTo === igId

  // 9 — mismatch: nada gravado; cookie assinado alimenta o banner de 1 clique
  if (!identityMatches && !rebindAllowed) {
    const isHttps = state.origin.startsWith('https:')
    jar.set({
      name: isHttps ? '__Secure-ig_handle_mismatch' : 'ig_handle_mismatch',
      value: signState({
        typ: 'mismatch',
        siteId,
        userId,
        accountId,
        authorizedHandle: handle,
        authorizedIgUserId: igId,
        exp: Math.floor(Date.now() / 1000) + MISMATCH_TTL_SECONDS,
      }, igKey),
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: MISMATCH_TTL_SECONDS,
      path: '/cms/settings',
    })
    return finish({
      success: false,
      mismatch: true,
      error: 'You authorized a different Instagram account',
      targetOrigin,
    })
  }

  // 10 — escrita única: a linha-alvo + toda linha do MESMO perfil no site
  let updatedRows: InstagramAccountRow[]
  try {
    const cipher = writeAccessToken(plainToken)
    const nowIso = new Date().toISOString()
    const orFilter =
      `id.eq.${accountId},` +
      `and(ig_user_id.eq.${igId},ig_user_id_source.eq.oauth),` +
      `and(handle.eq.${handle},ig_user_id_source.eq.legacy)`

    const { data, error } = await supabase
      .from('instagram_accounts')
      .update({
        access_token: cipher,
        ig_user_id: igId,
        ig_professional_id: igProfessionalId,
        ig_user_id_source: 'oauth',
        handle,
        token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
        token_refreshed_at: nowIso,
        token_error: null,
        token_error_at: null,
        token_error_mode: null,
        token_alert_sent_at: null,
        token_alert_attempt_at: null,
        token_reprobe_at: null,
        updated_at: nowIso,
      })
      .eq('site_id', siteId)
      .or(orFilter)
      .select('*')

    if (error) {
      Sentry.captureException(error, { tags: { component: 'instagram-oauth-write' } })
      return finish({ success: false, code: 'write_failed', targetOrigin })
    }
    updatedRows = (data ?? []) as InstagramAccountRow[]
    if (updatedRows.length === 0) {
      Sentry.captureMessage('instagram oauth write matched 0 rows', 'warning')
      return finish({ success: false, code: 'write_failed', targetOrigin })
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'instagram-oauth-write' } })
    return finish({ success: false, code: 'write_failed', targetOrigin })
  }

  // Trilha de auditoria quando a identidade mudou (rebind ou reconexão de legado)
  const identityChanged =
    target.ig_user_id !== igId || normalizeHandle(target.handle) !== handle
  if (identityChanged) {
    const trailNow = new Date().toISOString()
    await supabase.from('instagram_sync_log').insert({
      site_id: siteId,
      account_id: accountId,
      mode: 'rebind',
      status: 'completed',
      posts_found: 0,
      posts_inserted: 0,
      posts_updated: 0,
      media_cached: 0,
      error_message:
        `identity: @${normalizeHandle(target.handle)}/${target.ig_user_id ?? 'null'} → @${handle}/${igId}`,
      started_at: trailNow,
      completed_at: trailNow,
    })
  }

  await recordSocialConsent(supabase, {
    userId,
    siteId,
    category: 'social_feed_read',
    req,
  })

  // 11 — sync pós-OAuth da linha `accountId`. A linha `started` é aberta ANTES
  // do `after()` para que o card mostre "Syncing your feed…" no `router.refresh()`
  // que o listener dispara ~8 s depois do sucesso (§3.5, modificador `Syncing`).
  const account = updatedRows.find((r) => r.id === accountId) ?? updatedRows[0]
  if (account) {
    const logId = await openSyncRow(supabase, account, 'manual', { detail: grantedPermissions })
    if (logId === null) Sentry.captureMessage('instagram oauth: sync log row missing', 'warning')
    const runStart = Date.now()
    const token = plainToken
    after(async () => {
      try {
        const r = await syncInstagramAccount(supabase, account, token, {
          deadlineAt: runStart + POST_SYNC_BUDGET_MS,
        })
        await closeSyncRow(supabase, logId, r)
        if (r.postsInserted > 0 || r.postsUpdated > 0) revalidateTag('instagram-feed', { expire: 0 })
      } catch (err) {
        await closeSyncRow(supabase, logId, null, redact(String(err)))
        Sentry.captureException(err, { tags: { component: 'instagram-oauth-postsync' } })
        // MUST: o sync pós-OAuth NUNCA marca token inválido nem alerta — o token
        // acabou de ser emitido; uma falha aqui é quase sempre configuração
        // (Standard Access, conta não-profissional, id errado no /me). A
        // confirmação fica com o probe do cron das 13:00 (§3.4).
      }
    })
  }

  // 12 — sucesso
  return finish({ success: true, targetOrigin })
}
