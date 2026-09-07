import { createHmac, timingSafeEqual } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { sendNtfyAlert } from '@/lib/ops/ntfy'
import type { getSupabaseServiceClient } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof getSupabaseServiceClient>

export const MAX_BODY_BYTES = 8192
/** Depois disto o `META_APP_SECRET` é ignorado (+ `captureMessage` 1×/dia). */
export const META_SECRET_FALLBACK_DEADLINE_MS = Date.parse('2026-10-06T00:00:00Z')
export const RUNBOOK_URL =
  'https://github.com/TN-Figueiredo/bythiagofigueiredo/blob/main/docs/ops/instagram-token-alert-runbook.md'

const SIG_ALERT_GUARD_MS = 60_000
const ISSUED_AT_MAX_AGE_S = 24 * 3600
const ISSUED_AT_SKEW_S = 10 * 60
const USER_ID_RE = /^[0-9]{1,32}$/

/** Guarda em memória (por instância) antes do claim — teto real = instâncias × 1/min. */
let lastSigAlertAt = 0

/**
 * Test hook — zera a guarda em memória entre casos. Sem isto, um teste que
 * dispara um alerta desliga silenciosamente o alerta dos testes seguintes (e um
 * teste que não pode falhar é um defeito). Mesmo padrão de
 * `__resetSiteDomainsCache` em `src/lib/oauth/origin.ts`. Não é usado por
 * código de produção.
 */
export function __resetSignatureAlertGuard(): void {
  lastSigAlertAt = 0
}

export interface ISignedRequestPayload {
  user_id: string
  algorithm: string
  issued_at: number
  expires?: number
}

export type SignedRequestResult =
  | { ok: true; payload: ISignedRequestPayload; raw: string }
  | { ok: false; status: 400 | 200 }

function fromBase64Url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

/** Lê o corpo com corte rígido; `null` = acima do teto (o reader é cancelado). */
async function readBodyCapped(req: Request): Promise<string | null> {
  const body = req.body
  if (!body) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
}

function parseSignedRequestField(text: string): string | null {
  try {
    const fromForm = new URLSearchParams(text).get('signed_request')
    if (fromForm) return fromForm
  } catch { /* not urlencoded */ }
  try {
    const json = JSON.parse(text) as { signed_request?: unknown }
    if (typeof json.signed_request === 'string') return json.signed_request
  } catch { /* not JSON */ }
  return null
}

async function alertSignatureMismatch(
  supabase: ServiceClient,
  route: 'deauthorize' | 'data-deletion',
): Promise<void> {
  const now = Date.now()
  if (now - lastSigAlertAt < SIG_ALERT_GUARD_MS) return
  lastSigAlertAt = now
  const { data } = await supabase.rpc('ops_alert_claim', {
    p_key: `signature_alert:${route}`,
    p_min_interval: '1 day',
  })
  if (data !== true) return
  Sentry.captureMessage('signed_request signature mismatch', {
    level: 'warning',
    tags: { route, component: 'instagram-signed-request' },
    fingerprint: ['instagram-signed-request-signature'],
  })
  // REGRA-PII-NTFY (§0): nem `title` nem `body` carregam handle, ids ou tokens.
  await sendNtfyAlert({
    title: 'Instagram callback signature mismatch',
    body: 'Check Sentry for the route and secret tag.',
    priority: 'default',
    tags: ['warning'],
    click: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/cms/settings/instagram`,
  })
}

/**
 * Passos 1–5 de §3.1 na ordem exata: nenhuma etapa roda se a anterior falhou, e
 * o anti-replay (passo 6) só é alcançado pelo chamador DEPOIS deste retorno.
 */
export async function readSignedRequest(
  req: Request,
  supabase: ServiceClient,
  route: 'deauthorize' | 'data-deletion',
): Promise<SignedRequestResult> {
  // 2 — tamanho
  const declared = req.headers.get('content-length')
  if (declared !== null) {
    const n = Number(declared)
    if (!Number.isInteger(n) || n < 0 || n > MAX_BODY_BYTES) return { ok: false, status: 400 }
  }
  const text = await readBodyCapped(req)
  if (text === null) return { ok: false, status: 400 }

  // 3 — parse
  const raw = parseSignedRequestField(text)
  if (!raw) return { ok: false, status: 400 }

  const dot = raw.indexOf('.')
  if (dot <= 0) return { ok: false, status: 400 }
  const sigPart = raw.slice(0, dot)
  const payloadPart = raw.slice(dot + 1)

  let payload: ISignedRequestPayload
  try {
    payload = JSON.parse(fromBase64Url(payloadPart).toString('utf8')) as ISignedRequestPayload
  } catch {
    return { ok: false, status: 400 }
  }
  if (!payload || typeof payload !== 'object' || payload.algorithm !== 'HMAC-SHA256') {
    return { ok: false, status: 400 }
  }

  // 4 — assinatura
  const sigBuf = fromBase64Url(sigPart)
  if (sigBuf.length !== 32) {
    await alertSignatureMismatch(supabase, route)
    return { ok: false, status: 400 }
  }
  const secrets: string[] = []
  if (process.env.INSTAGRAM_APP_SECRET) secrets.push(process.env.INSTAGRAM_APP_SECRET)
  if (
    process.env.META_APP_SECRET &&
    process.env.INSTAGRAM_ALLOW_META_SECRET_FALLBACK === '1' &&
    Date.now() < META_SECRET_FALLBACK_DEADLINE_MS
  ) {
    secrets.push(process.env.META_APP_SECRET)
  }
  let matched = false
  for (const secret of secrets) {
    const expected = createHmac('sha256', secret).update(payloadPart).digest()
    if (expected.length === sigBuf.length && timingSafeEqual(expected, sigBuf)) matched = true
  }
  if (!matched) {
    await alertSignatureMismatch(supabase, route)
    return { ok: false, status: 400 }
  }

  // 5 — janela temporal e forma do id
  const nowS = Math.floor(Date.now() / 1000)
  const issuedAt = payload.issued_at
  const issuedOk =
    typeof issuedAt === 'number' && Number.isFinite(issuedAt) &&
    issuedAt >= nowS - ISSUED_AT_MAX_AGE_S && issuedAt <= nowS + ISSUED_AT_SKEW_S
  const expiresOk =
    typeof payload.expires !== 'number' || payload.expires <= 0 || payload.expires >= nowS
  if (!issuedOk || !expiresOk) {
    const now = Date.now()
    if (now - lastSigAlertAt >= SIG_ALERT_GUARD_MS) {
      lastSigAlertAt = now
      Sentry.captureMessage('signed_request outside the accepted time window', {
        level: 'warning',
        tags: { route, component: 'instagram-signed-request' },
      })
    }
    return { ok: false, status: 400 }
  }
  if (typeof payload.user_id !== 'string' || !USER_ID_RE.test(payload.user_id)) {
    Sentry.captureMessage('signed_request user_id malformed', {
      level: 'warning',
      tags: { route, component: 'instagram-signed-request' },
    })
    return { ok: false, status: 200 }
  }

  return { ok: true, payload, raw }
}

/**
 * Alcance dos callbacks: `ig_user_id` OU `ig_professional_id`. Seguro por
 * construção — `user_id` já casou `^[0-9]{1,32}$` (alfabeto sem `,`/`(`/`)`/`"`).
 * O chamador conjuga com `.eq('ig_user_id_source','oauth')`: linhas `legacy`
 * NUNCA casam (o id delas veio de outro app — §3.1 passo 7).
 */
export function matchedAccountsFilter(userId: string): string {
  return `ig_user_id.eq.${userId},ig_professional_id.eq.${userId}`
}
