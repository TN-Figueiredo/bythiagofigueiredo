// SERVER-ONLY. Importa @tn-figueiredo/social/vault (=> node:crypto).
// MUST NOT ser importado de nenhum arquivo 'use client' — as frases da UI
// vivem em ./status-text.ts, que é isomórfico de propósito.
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { decrypt, encrypt } from '@tn-figueiredo/social/vault'
import { redactSecrets } from '@/lib/redact-secrets'
import { GRAPH_API_BASE, instagramErrorFromResponse } from './api-client'

/** Re-export exigido por §3.2 — `p_reason` chega sempre redigido. */
export const redact = redactSecrets

export class VaultUnavailableError extends Error {
  constructor() {
    super('SOCIAL_MASTER_KEY missing or malformed')
    this.name = 'VaultUnavailableError'
  }
}

// O regex roda ANTES do Buffer.from: `Buffer.from('zz…','hex')` não lança, só
// devolve um buffer curto/vazio, e a checagem de comprimento depois fecha o
// caso residual.
const HEX_64 = /^[0-9a-fA-F]{64}$/

export function getVaultKeyOrNull(): Buffer | null {
  const hex = process.env.SOCIAL_MASTER_KEY
  if (!hex || !HEX_64.test(hex)) return null
  const buf = Buffer.from(hex, 'hex')
  return buf.length === 32 ? buf : null
}

/**
 * MUST NOT throw. A marcação da conta é do CHAMADOR:
 *  - vault caído (getVaultKeyOrNull() === null) => não toca a conta;
 *  - row.access_token != null e token === null => markTokenInvalid('decrypt_failed');
 *  - row.access_token == null => "not connected".
 */
export function readAccessToken(row: { access_token: string | null }): {
  token: string | null
  legacy: boolean
} {
  const raw = row.access_token
  if (raw == null) return { token: null, legacy: false }
  // `v1:` é marcador de FORMATO, não domínio criptográfico (§8).
  if (!raw.startsWith('v1:')) return { token: raw, legacy: true }
  const key = getVaultKeyOrNull()
  if (key === null) return { token: null, legacy: false }
  try {
    return { token: decrypt(raw.slice(3), key), legacy: false }
  } catch {
    return { token: null, legacy: false }
  }
}

export function writeAccessToken(plain: string): string {
  const key = getVaultKeyOrNull()
  if (key === null) throw new VaultUnavailableError()
  return `v1:${encrypt(plain, key)}`
}

// ── Classificação de erro ────────────────────────────────────────────────────

export type ErrorClass = 'infra' | 'transient' | 'permanent'

interface IErrorShape {
  code?: unknown
  error_subcode?: unknown
  type?: unknown
  httpStatus?: unknown
  is_transient?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
}

const TRANSIENT_CODES = new Set([1, 2, 4, 17, 32, 341, 613])
const PERMANENT_CODES = new Set([10, 102, 190])

function isPostgrestShape(err: unknown): boolean {
  if (!err || typeof err !== 'object' || err instanceof Error) return false
  const o = err as Record<string, unknown>
  return typeof o.code === 'string' && ('details' in o || 'hint' in o)
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof TypeError) return true
  const name = err instanceof Error ? err.name : ''
  if (name === 'AbortError' || name === 'TimeoutError') return true
  const msg = err instanceof Error ? err.message : ''
  return /fetch failed|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(msg)
}

/**
 * Sequência ORDENADA (MUST): avaliada de cima para baixo, devolve no primeiro
 * casamento. Nenhuma cláusula vence por prosa.
 */
export function classifyInstagramError(err: unknown): ErrorClass {
  const e = (err && typeof err === 'object' ? err : {}) as IErrorShape
  const message = typeof e.message === 'string' ? e.message : String(err)
  const type = typeof e.type === 'string' ? e.type : ''
  const numericCode = typeof e.code === 'number' ? e.code : undefined
  const httpStatus = typeof e.httpStatus === 'number' ? e.httpStatus : undefined

  const result = ((): ErrorClass => {
    // (1) infra — bug nosso, nunca token do usuário. Vem ANTES do permanente
    // para tornar o modo de falha "nome de campo errado marca a frota inteira"
    // estruturalmente impossível.
    if (
      e.code === '23505' ||
      /duplicate key value/i.test(message) ||
      /PGRST/.test(String(e.code ?? '')) ||
      /PGRST/.test(message) ||
      isPostgrestShape(err) ||
      (numericCode === 100 && /nonexisting field|tried accessing nonexisting/i.test(message))
    ) return 'infra'

    // (2) transient — inclui 5xx/429 SOB OAuthException, por estar antes de (3).
    if (
      (numericCode !== undefined && TRANSIENT_CODES.has(numericCode)) ||
      e.is_transient === true ||
      /less than 24 hours|too soon|rate limit|too many calls/i.test(message) ||
      (httpStatus !== undefined && (httpStatus >= 500 || httpStatus === 429)) ||
      isNetworkFailure(err)
    ) return 'transient'

    // (3) permanent
    if (
      type === 'OAuthException' ||
      httpStatus === 401 ||
      httpStatus === 403 ||
      (numericCode !== undefined &&
        (PERMANENT_CODES.has(numericCode) || (numericCode >= 200 && numericCode <= 299))) ||
      (numericCode === 100 &&
        /access.?token|does not exist|unsupported get request/i.test(message) &&
        !/nonexisting field/i.test(message)) ||
      /invalidated|expired|revoked|invalid.*token|decrypt_failed|No Instagram user ID|No access token/i.test(message)
    ) return 'permanent'

    // (4) default
    return 'transient'
  })()

  // Telemetria de calibração (MUST, §3.2): a tupla, redigida, sem token.
  try {
    Sentry.addBreadcrumb({
      category: 'instagram.classify',
      level: 'info',
      message: redact(message).slice(0, 200),
      data: {
        code: typeof e.code === 'string' || typeof e.code === 'number' ? e.code : null,
        error_subcode:
          typeof e.error_subcode === 'string' || typeof e.error_subcode === 'number'
            ? e.error_subcode
            : null,
        type: type || null,
        httpStatus: httpStatus ?? null,
        result,
      },
    })
  } catch {
    // telemetria nunca altera o desfecho da classificação
  }

  return result
}

// ── Episódio de token (C2) ───────────────────────────────────────────────────

export interface IMarkTokenInvalidOpts {
  /** false = abre episódio transitório (nunca grava token_error). */
  fatal: boolean
  /** true = sobrescreve o motivo e re-arma o alerta (só Meta: deauthorize / data-deletion). */
  forceReason?: boolean
  mode?: 'daily' | 'token_refresh'
}

export class MarkTokenInvalidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MarkTokenInvalidError'
  }
}

export async function markTokenInvalid(
  supabase: SupabaseClient,
  account: { id: string; site_id: string },
  reason: string,
  opts: IMarkTokenInvalidOpts,
): Promise<void> {
  const pReason = redact(String(reason)).slice(0, 500)

  const { error } = await supabase.rpc('instagram_mark_token_invalid', {
    p_account: account.id,
    p_site: account.site_id,
    p_reason: pReason,
    p_fatal: opts.fatal,
    p_force_reason: opts.forceReason ?? false,
    p_mode: opts.mode ?? null,
  })

  if (!error) return

  // `error` (a RPC não existe / permissão / coluna faltando) é diferente de
  // "0 linhas casadas": aqui o episódio é FORÇADO por update direto para que a
  // conta não morra em silêncio, e o throw faz o cron contar step_errors.
  Sentry.captureException(
    new Error(`instagram_mark_token_invalid failed: ${error.message}`),
    { tags: { component: 'instagram-token', account_id: account.id } },
  )
  await supabase
    .from('instagram_accounts')
    .update({
      token_error: opts.fatal ? pReason : null,
      token_error_at: new Date().toISOString(),
      token_error_mode: opts.mode ?? null,
      token_alert_sent_at: null,
      token_alert_attempt_at: null,
      token_reprobe_at: null,
    })
    .eq('id', account.id)
    .eq('site_id', account.site_id)

  throw new MarkTokenInvalidError(error.message)
}

const STREAK_WINDOW_MS = 4 * 24 * 60 * 60 * 1000
const STREAK_DAYS_REQUIRED = 3

function utcDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

/**
 * Avaliada POR MODO. Um `completed` de `daily` prova que a LEITURA funciona,
 * não que a RENOVAÇÃO funciona — deixá-lo zerar a sequência do `token_refresh`
 * reintroduz exatamente a morte silenciosa de §1.
 * Predicado semântico em TS (select largo + filtro), conforme a nota de execução.
 */
export async function evaluateTransientStreak(
  supabase: SupabaseClient,
  account: { id: string; site_id: string },
  mode: 'daily' | 'token_refresh',
): Promise<boolean> {
  const since = new Date(Date.now() - STREAK_WINDOW_MS).toISOString()

  const { data, error } = await supabase
    .from('instagram_sync_log')
    .select('started_at, mode, status, error_message')
    .eq('account_id', account.id)
    .in('mode', ['daily', 'token_refresh'])
    .in('status', ['completed', 'failed'])
    .gt('started_at', since)

  if (error) throw new Error(`transient streak query failed: ${error.message}`)

  const rows = (data ?? []) as Array<{
    started_at: string
    mode: string
    status: string
    error_message: string | null
  }>

  // Só linhas `failed` com prefixo `transient:` contam. As demais não contam
  // NEM zeram.
  const failures = rows.filter(
    (r) =>
      r.mode === mode &&
      r.status === 'failed' &&
      (r.error_message ?? '').startsWith('transient:'),
  )
  if (failures.length === 0) return false

  const days = new Set(failures.map((r) => utcDay(r.started_at)))
  if (days.size < STREAK_DAYS_REQUIRED) return false

  const oldestFailure = failures.reduce((a, b) => (a.started_at <= b.started_at ? a : b)).started_at
  const recovered = rows.some(
    (r) => r.mode === mode && r.status === 'completed' && r.started_at > oldestFailure,
  )
  if (recovered) return false

  await markTokenInvalid(supabase, account, 'transient', { fatal: false, mode })
  return true
}

/**
 * Sonda de VIDA do token — nenhum campo de perfil. É ela que dá a detecção em
 * ≤ 24 h (§3.4): roda para TODA conta com token, com timeout duro de 10 s, e
 * nunca lança (um throw aqui mataria o run e perderia os alertas do dia).
 */
export async function probeToken(
  token: string,
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    const res = await fetch(`${GRAPH_API_BASE}/me?fields=id&access_token=${token}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: await instagramErrorFromResponse(res) }
  } catch (err) {
    return { ok: false, error: err }
  }
}
